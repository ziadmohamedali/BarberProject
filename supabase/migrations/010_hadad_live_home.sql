-- HADAD Live Home settings.
-- Public reads are allowed; only the server-claimed HADAD owner may update.
-- This migration is additive and does not alter appointments, products, or auth.

begin;

-- Older installations normally get this function from 001_hadad_schema.sql.
-- Create it only when absent; do not replace a shared function on a live project.
do $$
begin
  if to_regprocedure('public.set_hadad_updated_at()') is null then
    execute $function$
      create function public.set_hadad_updated_at()
      returns trigger
      language plpgsql
      set search_path = pg_catalog
      as $body$
      begin
        new.updated_at := pg_catalog.now();
        return new;
      end;
      $body$
    $function$;
  end if;
end;
$$;

create table if not exists public.hadad_home_settings (
  id text primary key default 'public' check (id = 'public'),
  heading_en text not null,
  heading_ar text not null,
  description_en text not null,
  description_ar text not null,
  image_url text not null default '',
  rules_en text not null default '',
  rules_ar text not null default '',
  updated_at timestamptz not null default pg_catalog.now()
);

drop trigger if exists hadad_home_settings_set_updated_at on public.hadad_home_settings;
create trigger hadad_home_settings_set_updated_at
  before update on public.hadad_home_settings
  for each row execute function public.set_hadad_updated_at();

alter table public.hadad_home_settings enable row level security;

-- Remove any earlier policies on this one table before installing the intended
-- rules. This prevents an unexpected permissive policy from widening access.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'hadad_home_settings'
  loop
    execute format('drop policy %I on public.hadad_home_settings', existing_policy.policyname);
  end loop;
end;
$$;

revoke all privileges on table public.hadad_home_settings from public, anon, authenticated;
grant select on table public.hadad_home_settings to anon, authenticated;
grant update on table public.hadad_home_settings to authenticated;

create policy "HADAD public reads home settings"
  on public.hadad_home_settings
  for select to anon, authenticated
  using (true);

create policy "HADAD owner updates home settings"
  on public.hadad_home_settings
  for update to authenticated
  using (public.is_hadad_owner())
  with check (public.is_hadad_owner());

-- Insert defaults only when the singleton row does not already exist. A rerun
-- never overwrites homepage text or image settings customized by the owner.
insert into public.hadad_home_settings (
  id, heading_en, heading_ar, description_en, description_ar, image_url, rules_en, rules_ar
)
values (
  'public',
  E'Sharp cuts.\nClean style.',
  U&'\0642\0635\0629 \0645\0645\064a\0632\0629.\000A\0623\0646\0627\0642\0629 \062a\062f\0648\0645.',
  'Premium barbering for gentlemen who want a sharp finish, a relaxed experience, and a look that lasts beyond the chair.',
  U&'\062e\062f\0645\0627\062a \062d\0644\0627\0642\0629 \0645\0645\064a\0632\0629 \0644\0644\0631\062c\0644 \0627\0644\0639\0635\0631\064a\060c \0628\062a\062c\0631\0628\0629 \0645\0631\064a\062d\0629 \0648\0625\0637\0644\0627\0644\0629 \0623\0646\064a\0642\0629 \062a\062f\0648\0645.',
  '',
  'Booking requests are preferences. We will confirm availability with you on WhatsApp.',
  U&'\0645\0648\0627\0639\064a\062f \0627\0644\062d\062c\0632 \0637\0644\0628\0627\062a \0645\0628\062f\0626\064a\0629\060c \0648\0633\0646\0624\0643\062f \0627\0644\062a\0648\0641\0631 \0645\0639\0643 \0639\0628\0631 \0648\0627\062a\0633\0627\0628.'
)
on conflict (id) do nothing;

commit;