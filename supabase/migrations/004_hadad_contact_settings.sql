-- Public contact/payment destinations with owner-only updates.
-- This is additive and does not change products, bookings, or Storage.
create table if not exists public.hadad_contact_settings (
  id text primary key default 'public' check (id = 'public'),
  whatsapp_phone text not null default ''
    check (
      whatsapp_phone = ''
      or (
        whatsapp_phone ~ '^\+?[0-9][0-9 ()-]{6,22}$'
        and char_length(regexp_replace(whatsapp_phone, '[^0-9]', '', 'g')) between 8 and 15
      )
    ),
  contact_phone text not null default ''
    check (
      contact_phone = ''
      or (
        contact_phone ~ '^\+?[0-9][0-9 ()-]{6,22}$'
        and char_length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) between 8 and 15
      )
    ),
  instagram_url text not null default ''
    check (instagram_url = '' or instagram_url ~* '^https://(www\.)?instagram\.com(/|$)'),
  facebook_url text not null default ''
    check (facebook_url = '' or facebook_url ~* '^https://(www\.|m\.)?facebook\.com(/|$)'),
  instapay_address text not null default '' check (char_length(instapay_address) <= 120),
  instapay_mobile text not null default ''
    check (
      instapay_mobile = ''
      or (
        instapay_mobile ~ '^\+?[0-9][0-9 ()-]{6,22}$'
        and char_length(regexp_replace(instapay_mobile, '[^0-9]', '', 'g')) between 8 and 15
      )
    )
);

alter table public.hadad_contact_settings enable row level security;
revoke all privileges on table public.hadad_contact_settings from public, anon, authenticated;
grant select on table public.hadad_contact_settings to anon, authenticated;
grant update on table public.hadad_contact_settings to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hadad_contact_settings'
      and policyname = 'HADAD public reads contact settings'
  ) then
    create policy "HADAD public reads contact settings"
      on public.hadad_contact_settings for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hadad_contact_settings'
      and policyname = 'HADAD owner updates contact settings'
  ) then
    create policy "HADAD owner updates contact settings"
      on public.hadad_contact_settings for update to authenticated
      using (public.is_hadad_owner())
      with check (public.is_hadad_owner());
  end if;
end;
$$;

insert into public.hadad_contact_settings (id)
values ('public')
on conflict (id) do nothing;
