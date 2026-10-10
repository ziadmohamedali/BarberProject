-- Repair the appointment feedback/archive objects expected by the current app.
-- Apply after the existing appointment and deposit migrations. All additions
-- are nullable or have defaults so existing requests remain intact.

begin;

alter table public.appointments
  add column if not exists customer_feedback text,
  add column if not exists archived_at timestamptz;

create index if not exists appointments_active_created_idx
  on public.appointments (created_at desc)
  where archived_at is null;

create table if not exists public.hadad_appointment_private_notes (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 4000),
  updated_at timestamptz not null default now()
);

alter table public.hadad_appointment_private_notes enable row level security;
revoke all on public.hadad_appointment_private_notes from public, anon, authenticated;
grant select, insert, update, delete on public.hadad_appointment_private_notes to authenticated;
drop policy if exists "HADAD owner manages private appointment notes"
  on public.hadad_appointment_private_notes;
create policy "HADAD owner manages private appointment notes"
  on public.hadad_appointment_private_notes for all to authenticated
  using (public.is_hadad_owner())
  with check (public.is_hadad_owner());

-- Preserve the existing confirmation-token protection while exposing feedback.
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

create or replace function public.update_hadad_appointment_notes(
  p_appointment_id uuid,
  p_customer_feedback text,
  p_internal_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_hadad_owner() then
    raise exception 'Owner authorization is required.';
  end if;
  if char_length(coalesce(p_customer_feedback, '')) > 2000
     or char_length(coalesce(p_internal_note, '')) > 4000 then
    raise exception 'Notes are too long.';
  end if;

  update public.appointments
     set customer_feedback = coalesce(p_customer_feedback, '')
   where id = p_appointment_id
     and archived_at is null;
  if not found then
    raise exception 'Appointment was not found.';
  end if;

  insert into public.hadad_appointment_private_notes (appointment_id, note, updated_at)
  values (p_appointment_id, coalesce(p_internal_note, ''), now())
  on conflict (appointment_id) do update
    set note = excluded.note,
        updated_at = now();
end;
$$;
revoke all on function public.update_hadad_appointment_notes(uuid, text, text) from public;
grant execute on function public.update_hadad_appointment_notes(uuid, text, text) to authenticated;

create or replace function public.archive_hadad_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_hadad_owner() then
    raise exception 'Owner authorization is required.';
  end if;

  update public.appointments
     set archived_at = now()
   where id = p_appointment_id
     and archived_at is null;
  if not found then
    raise exception 'Appointment was not found or already archived.';
  end if;
end;
$$;
revoke all on function public.archive_hadad_appointment(uuid) from public;
grant execute on function public.archive_hadad_appointment(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
