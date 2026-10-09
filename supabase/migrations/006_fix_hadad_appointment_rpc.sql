-- Reconcile the public booking RPC signature with the current frontend.
-- Apply after 005_hadad_appointments.sql.

drop function if exists public.create_hadad_appointment(text, text, text, uuid[], timestamptz, text, uuid, text);
drop function if exists public.create_hadad_appointment(text, text, text, uuid[], text, uuid, text);

create function public.create_hadad_appointment(
  p_customer_name text,
  p_whatsapp text,
  p_email text,
  p_product_ids uuid[],
  p_notes text,
  p_idempotency_key uuid,
  p_confirmation_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_count integer;
  v_total numeric;
  v_duration bigint;
  v_services jsonb;
  v_service_ids uuid[];
  v_appointment public.appointments%rowtype;
  v_reference text;
  v_confirmation_hash text;
  v_services_valid boolean;
  v_deposit constant integer := 50;
begin
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 80 then
    raise exception 'Enter a name between 1 and 80 characters.';
  end if;
  if p_whatsapp is null or char_length(regexp_replace(p_whatsapp, '[^0-9]', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid WhatsApp number.';
  end if;
  if p_email is not null and p_email <> '' and p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    raise exception 'Select at least one active service.';
  end if;
  if cardinality(p_product_ids) > 8
     or (select count(distinct product_id) from unnest(p_product_ids) as selected(product_id)) <> cardinality(p_product_ids) then
    raise exception 'The selected services are invalid. Refresh and select them again.';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Notes must be 1000 characters or fewer.';
  end if;
  if p_idempotency_key is null or p_confirmation_token is null
     or p_confirmation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'The booking request could not be verified. Please refresh and try again.';
  end if;

  v_confirmation_hash := encode(sha256(convert_to(p_confirmation_token, 'UTF8')), 'hex');

  select * into v_appointment
    from public.appointments
   where idempotency_key = p_idempotency_key;
  if found then
    if v_appointment.confirmation_token_hash <> v_confirmation_hash then
      raise exception 'The booking request could not be verified. Please refresh and try again.';
    end if;
    return jsonb_build_object(
      'id', v_appointment.id,
      'reference', v_appointment.booking_reference,
      'customer_name', v_appointment.customer_name,
      'services', v_appointment.services,
      'total_price', v_appointment.total_price,
      'duration_minutes', v_appointment.duration_minutes,
      'appointment_at', v_appointment.appointment_at,
      'deposit_amount', v_appointment.deposit_amount,
      'deposit_status', v_appointment.deposit_status,
      'booking_status', v_appointment.booking_status,
      'created_at', v_appointment.created_at
    );
  end if;

  select count(*), coalesce(sum(product.price), 0),
         coalesce(sum(coalesce(product.duration_minutes, 30)), 0),
         coalesce(bool_and(
           product.price > 0
           and (product.duration_minutes is null or product.duration_minutes between 1 and 720)
         ), false),
         coalesce(array_agg(product.id order by product.display_order, product.created_at), '{}'::uuid[]),
         coalesce(jsonb_agg(jsonb_build_object(
           'product_id', product.id,
           'title', product.name,
           'price', product.price,
           'duration_minutes', coalesce(product.duration_minutes, 30)
         ) order by product.display_order, product.created_at), '[]'::jsonb)
    into v_product_count, v_total, v_duration, v_services_valid, v_service_ids, v_services
    from public.products as product
   where product.id = any(p_product_ids)
     and product.is_active = true;

  if v_product_count <> cardinality(p_product_ids) then
    raise exception 'One or more selected services are unavailable. Refresh and select again.';
  end if;
  if not v_services_valid or v_duration not between 1 and 720 then
    raise exception 'One or more selected services have an invalid duration or price.';
  end if;
  if v_total < v_deposit then
    raise exception 'Selected services total is below the deposit minimum.';
  end if;
  if v_total <> trunc(v_total) or v_total > 2147483647 then
    raise exception 'Selected services have an invalid total.';
  end if;

  loop
    v_reference := 'HAD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (select 1 from public.appointments where booking_reference = v_reference);
  end loop;

  insert into public.appointments (
    booking_reference, idempotency_key, confirmation_token_hash,
    customer_name, whatsapp, email, service_ids, services, total_price,
    duration_minutes, appointment_at, notes, deposit_amount
  ) values (
    v_reference, p_idempotency_key, v_confirmation_hash,
    btrim(p_customer_name), btrim(p_whatsapp), coalesce(btrim(p_email), ''),
    v_service_ids, v_services, v_total::integer,
    v_duration::integer, null, coalesce(p_notes, ''), v_deposit
  )
  returning * into v_appointment;

  return jsonb_build_object(
    'id', v_appointment.id,
    'reference', v_appointment.booking_reference,
    'customer_name', v_appointment.customer_name,
    'services', v_appointment.services,
    'total_price', v_appointment.total_price,
    'duration_minutes', v_appointment.duration_minutes,
    'appointment_at', v_appointment.appointment_at,
    'deposit_amount', v_appointment.deposit_amount,
    'deposit_status', v_appointment.deposit_status,
    'booking_status', v_appointment.booking_status,
    'created_at', v_appointment.created_at
  );
end;
$$;

revoke all on function public.create_hadad_appointment(text, text, text, uuid[], text, uuid, text) from public;
grant execute on function public.create_hadad_appointment(text, text, text, uuid[], text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
