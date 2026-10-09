-- Appointment requests use trusted product data and owner-only management.
-- Apply after 003_hadad_live_integration.sql and 004_hadad_contact_settings.sql.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  idempotency_key uuid not null unique,
  confirmation_token_hash text not null unique,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  whatsapp text not null check (char_length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) between 8 and 15),
  email text not null default '' check (email = '' or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  service_ids uuid[] not null check (cardinality(service_ids) > 0),
  services jsonb not null check (jsonb_typeof(services) = 'array' and jsonb_array_length(services) > 0),
  total_price integer not null check (total_price >= 50),
  duration_minutes integer not null check (duration_minutes between 1 and 720),
  appointment_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  deposit_amount integer not null default 50 check (deposit_amount = 50),
  deposit_status text not null default 'unpaid'
    check (deposit_status in ('unpaid', 'pending_verification', 'verified')),
  booking_status text not null default 'pending'
    check (booking_status in ('pending', 'confirmed', 'completed', 'cancelled', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments alter column appointment_at drop not null;

create index if not exists appointments_date_idx
  on public.appointments (appointment_at);
create index if not exists appointments_status_date_idx
  on public.appointments (booking_status, appointment_at);
create index if not exists appointments_phone_idx
  on public.appointments (whatsapp);
create index if not exists appointments_customer_name_idx
  on public.appointments (lower(customer_name));

create or replace function public.touch_hadad_appointment_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hadad_appointments_updated_at on public.appointments;
create trigger hadad_appointments_updated_at
before update on public.appointments
for each row execute function public.touch_hadad_appointment_updated_at();

alter table public.appointments enable row level security;
revoke all privileges on table public.appointments from public, anon, authenticated;
grant select on table public.appointments to authenticated;
revoke all on function public.touch_hadad_appointment_updated_at() from public;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
      from pg_policies
     where schemaname = 'public' and tablename = 'appointments'
  loop
    execute format('drop policy %I on public.appointments', existing_policy.policyname);
  end loop;
end;
$$;

create policy "HADAD owner reads appointments"
on public.appointments for select to authenticated
using (public.is_hadad_owner());

drop function if exists public.create_hadad_appointment(text, text, text, uuid[], timestamptz, text, uuid, text);

create or replace function public.create_hadad_appointment(
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
    'deposit_amount', appointment.deposit_amount,
    'deposit_status', appointment.deposit_status,
    'booking_status', appointment.booking_status,
    'created_at', appointment.created_at
  )
    from public.appointments as appointment
   where appointment.booking_reference = p_reference
     and appointment.confirmation_token_hash =
       encode(sha256(convert_to(p_confirmation_token, 'UTF8')), 'hex')
     and p_confirmation_token ~ '^[0-9a-f]{64}$'
$$;

revoke all on function public.get_hadad_appointment_confirmation(text, text) from public;
grant execute on function public.get_hadad_appointment_confirmation(text, text) to anon, authenticated;

create or replace function public.update_hadad_appointment(
  p_appointment_id uuid,
  p_booking_status text default null,
  p_deposit_status text default null
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
  if p_booking_status is null and p_deposit_status is null then
    raise exception 'Choose an appointment or deposit status to update.';
  end if;
  if p_booking_status is not null
     and p_booking_status not in ('pending', 'confirmed', 'completed', 'cancelled', 'rejected') then
    raise exception 'Invalid appointment status.';
  end if;
  if p_deposit_status is not null
     and p_deposit_status not in ('unpaid', 'pending_verification', 'verified') then
    raise exception 'Invalid deposit status.';
  end if;

  select * into v_appointment
    from public.appointments
   where id = p_appointment_id
   for update;
  if not found then
    raise exception 'Appointment was not found.';
  end if;
  if p_booking_status is not null
     and p_booking_status <> v_appointment.booking_status
     and not (
       (v_appointment.booking_status = 'pending' and p_booking_status in ('confirmed', 'cancelled', 'rejected'))
       or (v_appointment.booking_status = 'confirmed' and p_booking_status in ('completed', 'cancelled'))
     ) then
    raise exception 'That appointment status change is not allowed.';
  end if;

  update public.appointments
     set booking_status = coalesce(p_booking_status, booking_status),
         deposit_status = coalesce(p_deposit_status, deposit_status)
   where id = p_appointment_id
   returning * into v_appointment;

  return v_appointment;
end;
$$;

revoke all on function public.update_hadad_appointment(uuid, text, text) from public;
grant execute on function public.update_hadad_appointment(uuid, text, text) to authenticated;
