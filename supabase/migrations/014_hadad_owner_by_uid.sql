-- Identify the HADAD owner by Supabase Auth user ID instead of a JWT app_metadata claim.
--
-- Every owner policy and owner RPC (products, contact settings, home settings,
-- appointments, bookings, product-images storage) already calls
-- public.is_hadad_owner(), so replacing its body moves all of them to the
-- UID check at once without touching any policy or data.

create table if not exists public.hadad_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Only the security-definer function below reads this table; clients get no access.
alter table public.hadad_owners enable row level security;
revoke all privileges on table public.hadad_owners from public, anon, authenticated;

-- The owner account: mohamed7adad1@gmail.com.
insert into public.hadad_owners (user_id)
values ('3ddd90cd-faf9-4ef2-9d4b-92518c38dde8')
on conflict (user_id) do nothing;

create or replace function public.is_hadad_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hadad_owners where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_hadad_owner() from public;
grant execute on function public.is_hadad_owner() to anon, authenticated;
