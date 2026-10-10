-- Owner workflow enhancements for existing guest bookings.
-- Apply after 007_hadad_deposit_workflow.sql. This keeps booking public and
-- adds only feedback, archive, and owner-private notes.

alter table public.appointments
  add column if not exists customer_feedback text not null default '',
  add column if not exists archived_at timestamptz;

create index if not exists appointments_active_created_idx
  on public.appointments (created_at desc) where archived_at is null;

create table if not exists public.hadad_appointment_private_notes (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 4000),
  updated_at timestamptz not null default now()
);
alter table public.hadad_appointment_private_notes enable row level security;
revoke all on public.hadad_appointment_private_notes from public, anon, authenticated;
grant select, insert, update, delete on public.hadad_appointment_private_notes to authenticated;
drop policy if exists "HADAD owner manages private appointment notes" on public.hadad_appointment_private_notes;
create policy "HADAD owner manages private appointment notes"
  on public.hadad_appointment_private_notes for all to authenticated
  using (public.is_hadad_owner()) with check (public.is_hadad_owner());

-- Re-establish owner appointment reads; all mutations remain RPC gated.
drop policy if exists "HADAD owner reads appointments" on public.appointments;
create policy "HADAD owner reads appointments"
  on public.appointments for select to authenticated
  using (public.is_hadad_owner());

-- Existing RPC signature from migration 006. Keep its token/idempotency behavior,
-- but bind the new row to auth.uid(); old guest rows stay unlinked.
create or replace function public.create_hadad_appointment(
  p_customer_name text, p_whatsapp text, p_email text, p_product_ids uuid[],
  p_notes text, p_idempotency_key uuid, p_confirmation_token text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_product_count integer; v_total numeric; v_duration bigint;
  v_services jsonb; v_service_ids uuid[]; v_appointment public.appointments%rowtype;
  v_reference text; v_confirmation_hash text; v_services_valid boolean;
begin
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 80 then raise exception 'Enter a name between 1 and 80 characters.'; end if;
  if p_whatsapp is null or char_length(regexp_replace(p_whatsapp, '[^0-9]', '', 'g')) not between 8 and 15 then raise exception 'Enter a valid WhatsApp number.'; end if;
  if p_email is not null and p_email <> '' and p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  if p_product_ids is null or cardinality(p_product_ids) = 0 or cardinality(p_product_ids) > 8 then raise exception 'Select at least one active service.'; end if;
  if (select count(distinct x) from unnest(p_product_ids) x) <> cardinality(p_product_ids) then raise exception 'A service can only be selected once.'; end if;
  if p_notes is not null and char_length(p_notes) > 1000 then raise exception 'Notes must be 1000 characters or fewer.'; end if;
  if p_idempotency_key is null or p_confirmation_token is null or p_confirmation_token !~ '^[0-9a-f]{64}$' then raise exception 'The booking request could not be verified.'; end if;
  v_confirmation_hash := encode(sha256(convert_to(p_confirmation_token, 'UTF8')), 'hex');
  select * into v_appointment from public.appointments where idempotency_key = p_idempotency_key;
  if found then
    if v_appointment.confirmation_token_hash is distinct from v_confirmation_hash then raise exception 'The booking request could not be verified.'; end if;
    return jsonb_build_object('id',v_appointment.id,'reference',v_appointment.booking_reference,'customer_name',v_appointment.customer_name,'services',v_appointment.services,'total_price',v_appointment.total_price,'duration_minutes',v_appointment.duration_minutes,'appointment_at',v_appointment.appointment_at,'deposit_amount',v_appointment.deposit_amount,'deposit_status',v_appointment.deposit_status,'booking_status',v_appointment.booking_status,'created_at',v_appointment.created_at);
  end if;
  select count(*), coalesce(sum(p.price),0), coalesce(sum(coalesce(p.duration_minutes,30)),0),
    coalesce(bool_and(p.price > 0 and (p.duration_minutes is null or p.duration_minutes between 1 and 720)),false),
    coalesce(array_agg(p.id order by p.display_order,p.created_at),'{}'::uuid[]),
    coalesce(jsonb_agg(jsonb_build_object('product_id',p.id,'title',p.name,'price',p.price,'duration_minutes',coalesce(p.duration_minutes,30)) order by p.display_order,p.created_at),'[]'::jsonb)
  into v_product_count,v_total,v_duration,v_services_valid,v_service_ids,v_services
  from public.products p where p.id=any(p_product_ids) and p.is_active=true;
  if v_product_count <> cardinality(p_product_ids) then raise exception 'One or more selected services are unavailable.'; end if;
  if not v_services_valid or v_duration not between 1 and 720 or v_total < 50 then raise exception 'Selected services are invalid.'; end if;
  loop v_reference := 'HAD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)); exit when not exists(select 1 from public.appointments where booking_reference=v_reference); end loop;
  insert into public.appointments(booking_reference,idempotency_key,confirmation_token_hash,customer_name,whatsapp,email,service_ids,services,total_price,duration_minutes,appointment_at,notes,deposit_amount)
  values(v_reference,p_idempotency_key,v_confirmation_hash,btrim(p_customer_name),btrim(p_whatsapp),coalesce(btrim(p_email),''),v_service_ids,v_services,v_total::integer,v_duration::integer,null,coalesce(p_notes,''),50)
  returning * into v_appointment;
  return jsonb_build_object('id',v_appointment.id,'reference',v_appointment.booking_reference,'customer_name',v_appointment.customer_name,'services',v_appointment.services,'total_price',v_appointment.total_price,'duration_minutes',v_appointment.duration_minutes,'appointment_at',v_appointment.appointment_at,'deposit_amount',v_appointment.deposit_amount,'deposit_status',v_appointment.deposit_status,'booking_status',v_appointment.booking_status,'created_at',v_appointment.created_at);
end;
$$;
revoke all on function public.create_hadad_appointment(text,text,text,uuid[],text,uuid,text) from public;
grant execute on function public.create_hadad_appointment(text,text,text,uuid[],text,uuid,text) to anon, authenticated;

-- A booking reference alone is not enough: the random confirmation token is
-- required to retrieve the customer's own public confirmation and feedback.
create or replace function public.get_hadad_appointment_confirmation(p_reference text,p_confirmation_token text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
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
    'customer_feedback', appointment.customer_feedback,
    'created_at', appointment.created_at
  )
  from public.appointments appointment
  where appointment.booking_reference=p_reference
    and appointment.archived_at is null
    and appointment.confirmation_token_hash=encode(sha256(convert_to(p_confirmation_token,'UTF8')),'hex')
    and p_confirmation_token is not null
    and p_confirmation_token ~ '^[0-9a-f]{64}$';
$$;
revoke all on function public.get_hadad_appointment_confirmation(text,text) from public;
grant execute on function public.get_hadad_appointment_confirmation(text,text) to anon,authenticated;

create or replace function public.update_hadad_appointment_notes(p_appointment_id uuid,p_customer_feedback text,p_internal_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_hadad_owner() then raise exception 'Owner authorization is required.'; end if;
  if char_length(coalesce(p_customer_feedback,'')) > 2000 or char_length(coalesce(p_internal_note,'')) > 4000 then raise exception 'Notes are too long.'; end if;
  update public.appointments set customer_feedback=coalesce(p_customer_feedback,'') where id=p_appointment_id and archived_at is null;
  if not found then raise exception 'Appointment was not found.'; end if;
  insert into public.hadad_appointment_private_notes(appointment_id,note,updated_at) values(p_appointment_id,coalesce(p_internal_note,''),now())
  on conflict(appointment_id) do update set note=excluded.note,updated_at=now();
end; $$;
revoke all on function public.update_hadad_appointment_notes(uuid,text,text) from public;
grant execute on function public.update_hadad_appointment_notes(uuid,text,text) to authenticated;

create or replace function public.archive_hadad_appointment(p_appointment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_hadad_owner() then raise exception 'Owner authorization is required.'; end if;
  update public.appointments set archived_at=now() where id=p_appointment_id and archived_at is null;
  if not found then raise exception 'Appointment was not found or already archived.'; end if;
end; $$;
revoke all on function public.archive_hadad_appointment(uuid) from public;
grant execute on function public.archive_hadad_appointment(uuid) to authenticated;

notify pgrst, 'reload schema';
