-- Adds a customer preferred visit time and lets the owner reschedule through an owner-only RPC.
-- Apply after the current appointment workflow migrations (including 010_hadad_live_home.sql).

alter table public.appointments
  add column if not exists preferred_appointment_at timestamptz;

create or replace function public.create_hadad_appointment(
  p_customer_name text,
  p_whatsapp text,
  p_email text,
  p_product_ids uuid[],
  p_notes text,
  p_idempotency_key uuid,
  p_confirmation_token text,
  p_preferred_appointment_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_appointment_id uuid;
  v_confirmation_hash text;
begin
  if p_preferred_appointment_at is null
     or p_preferred_appointment_at <= now()
     or p_preferred_appointment_at > now() + interval '30 days'
     or extract(minute from p_preferred_appointment_at)::integer % 5 <> 0
     or date_trunc('minute', p_preferred_appointment_at) <> p_preferred_appointment_at then
    raise exception 'Choose a preferred appointment time within the next 30 days in 5-minute increments.';
  end if;

  v_result := public.create_hadad_appointment(
    p_customer_name, p_whatsapp, p_email, p_product_ids, p_notes,
    p_idempotency_key, p_confirmation_token
  );
  v_appointment_id := (v_result ->> 'id')::uuid;
  v_confirmation_hash := encode(sha256(convert_to(p_confirmation_token, 'UTF8')), 'hex');

  update public.appointments
     set preferred_appointment_at = p_preferred_appointment_at
   where id = v_appointment_id
     and idempotency_key = p_idempotency_key
     and confirmation_token_hash = v_confirmation_hash;
  if not found then
    raise exception 'The preferred time could not be saved for this request.';
  end if;

  return v_result || jsonb_build_object('preferred_appointment_at', p_preferred_appointment_at);
end;
$$;

revoke all on function public.create_hadad_appointment(text, text, text, uuid[], text, uuid, text, timestamptz) from public;
grant execute on function public.create_hadad_appointment(text, text, text, uuid[], text, uuid, text, timestamptz) to anon, authenticated;

create or replace function public.get_hadad_appointment_confirmation(
  p_reference text,
  p_confirmation_token text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reference', appointment.booking_reference,
    'customer_name', appointment.customer_name,
    'services', appointment.services,
    'total_price', appointment.total_price,
    'duration_minutes', appointment.duration_minutes,
    'appointment_at', appointment.appointment_at,
    'preferred_appointment_at', appointment.preferred_appointment_at,
    'deposit_amount', appointment.deposit_amount,
    'deposit_status', appointment.deposit_status,
    'booking_status', appointment.booking_status,
    'customer_feedback', appointment.customer_feedback,
    'created_at', appointment.created_at
  )
  from public.appointments as appointment
  where appointment.booking_reference = p_reference
    and appointment.archived_at is null
    and appointment.confirmation_token_hash =
      encode(sha256(convert_to(p_confirmation_token, 'UTF8')), 'hex')
    and p_confirmation_token is not null
    and p_confirmation_token ~ '^[0-9a-f]{64}$';
$$;
revoke all on function public.get_hadad_appointment_confirmation(text, text) from public;
grant execute on function public.get_hadad_appointment_confirmation(text, text) to anon, authenticated;

create or replace function public.set_hadad_appointment_time(
  p_appointment_id uuid,
  p_appointment_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  if not public.is_hadad_owner() then
    raise exception 'Owner authorization is required.';
  end if;
  if p_appointment_at is null
     or p_appointment_at <= now()
     or extract(minute from p_appointment_at)::integer % 5 <> 0
     or date_trunc('minute', p_appointment_at) <> p_appointment_at then
    raise exception 'Choose a future appointment time in 5-minute increments.';
  end if;

  update public.appointments
     set appointment_at = p_appointment_at
   where id = p_appointment_id
     and booking_status not in ('completed', 'cancelled', 'rejected')
   returning * into v_appointment;
  if not found then
    raise exception 'The appointment was not found or can no longer be rescheduled.';
  end if;
  return v_appointment;
end;
$$;

revoke all on function public.set_hadad_appointment_time(uuid, timestamptz) from public;
grant execute on function public.set_hadad_appointment_time(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
