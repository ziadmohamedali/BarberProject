-- Move booking requests to owner review before requesting or verifying payment.
-- Apply after migrations 005 and 006.

alter table public.appointments
  drop constraint if exists appointments_booking_status_check,
  drop constraint if exists appointments_deposit_status_check;

update public.appointments
   set booking_status = case booking_status
     when 'pending' then 'pending_review'
     else booking_status
   end,
   deposit_status = case deposit_status
     when 'unpaid' then 'not_requested'
     when 'pending_verification' then 'awaiting_payment'
     when 'verified' then 'payment_verified'
     else deposit_status
   end;

alter table public.appointments
  alter column booking_status set default 'pending_review',
  alter column deposit_status set default 'not_requested',
  add constraint appointments_booking_status_check
    check (booking_status in ('pending_review', 'awaiting_payment', 'confirmed', 'completed', 'cancelled', 'rejected')),
  add constraint appointments_deposit_status_check
    check (deposit_status in ('not_requested', 'awaiting_payment', 'payment_verified', 'refunded'));

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
  v_next_booking_status text;
begin
  if not public.is_hadad_owner() then
    raise exception 'Owner authorization is required.';
  end if;
  if p_booking_status is null and p_deposit_status is null then
    raise exception 'Choose an appointment or deposit status to update.';
  end if;
  if p_booking_status is not null
     and p_booking_status not in ('pending_review', 'awaiting_payment', 'confirmed', 'completed', 'cancelled', 'rejected') then
    raise exception 'Invalid appointment status.';
  end if;
  if p_deposit_status is not null
     and p_deposit_status not in ('not_requested', 'awaiting_payment', 'payment_verified', 'refunded') then
    raise exception 'Invalid deposit status.';
  end if;

  select * into v_appointment
    from public.appointments
   where id = p_appointment_id
   for update;
  if not found then
    raise exception 'Appointment was not found.';
  end if;

  v_next_booking_status := coalesce(p_booking_status, v_appointment.booking_status);

  if p_booking_status is not null
     and p_booking_status <> v_appointment.booking_status
     and not (
       (v_appointment.booking_status = 'pending_review' and p_booking_status in ('awaiting_payment', 'cancelled', 'rejected'))
       or (v_appointment.booking_status = 'awaiting_payment' and p_booking_status in ('confirmed', 'cancelled', 'rejected'))
       or (v_appointment.booking_status = 'confirmed' and p_booking_status in ('completed', 'cancelled'))
     ) then
    raise exception 'That appointment status change is not allowed.';
  end if;

  if p_booking_status = 'awaiting_payment'
     and v_appointment.booking_status <> 'awaiting_payment'
     and p_deposit_status is distinct from 'awaiting_payment'
     and v_appointment.deposit_status <> 'payment_verified' then
    raise exception 'Accepting a request also requires requesting its deposit.';
  end if;

  if p_booking_status = 'confirmed'
     and v_appointment.booking_status <> 'confirmed'
     and v_appointment.deposit_status <> 'payment_verified' then
    raise exception 'Appointment confirmation requires a verified deposit.';
  end if;

  if p_deposit_status is not null
     and p_deposit_status <> v_appointment.deposit_status
     and not (
       (v_appointment.deposit_status = 'not_requested' and p_deposit_status = 'awaiting_payment')
       or (v_appointment.deposit_status = 'awaiting_payment' and p_deposit_status = 'payment_verified')
       or (v_appointment.deposit_status = 'payment_verified'
           and p_deposit_status = 'refunded'
           and v_next_booking_status in ('cancelled', 'rejected'))
     ) then
    raise exception 'Invalid deposit status transition.';
  end if;

  if p_deposit_status = 'awaiting_payment'
     and v_next_booking_status <> 'awaiting_payment' then
    raise exception 'Request the deposit only after accepting the request.';
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

notify pgrst, 'reload schema';
