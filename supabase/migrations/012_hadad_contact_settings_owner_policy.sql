-- Reconcile Contact Settings permissions to the intended public-read,
-- server-claimed-owner-update rules.
begin;

alter table public.hadad_contact_settings enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'hadad_contact_settings'
  loop
    execute format('drop policy %I on public.hadad_contact_settings', existing_policy.policyname);
  end loop;
end;
$$;

revoke all privileges on table public.hadad_contact_settings from public, anon, authenticated;
grant select on table public.hadad_contact_settings to anon, authenticated;
grant update on table public.hadad_contact_settings to authenticated;

create policy "HADAD public reads contact settings"
  on public.hadad_contact_settings
  for select to anon, authenticated
  using (true);

create policy "HADAD owner updates contact settings"
  on public.hadad_contact_settings
  for update to authenticated
  using (public.is_hadad_owner())
  with check (public.is_hadad_owner());

insert into public.hadad_contact_settings (id)
values ('public')
on conflict (id) do nothing;

commit;
