# HADAD Supabase setup and security

## 1. Configure the app

Set the Supabase **Project URL** and **public anon/publishable key** in the root `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Only the public URL and public anon/publishable key belong in frontend configuration. Never place a service-role key, database password, or other secret in a `VITE_` variable.

## 2. Apply migrations to the prepared project

For the existing HADAD project, inspect the live schema, RLS policies, and migration history in Supabase before running SQL. Apply reviewed migrations in order if they are not already present:

1. `supabase/migrations/003_hadad_live_integration.sql`
2. `supabase/migrations/004_hadad_contact_settings.sql`
3. `supabase/migrations/005_hadad_appointments.sql`
4. `supabase/migrations/006_fix_hadad_appointment_rpc.sql`
5. `supabase/migrations/007_hadad_deposit_workflow.sql`

Do not run the legacy `001_hadad_schema.sql`, `002_hadad_security.sql`, or `setup.sql` against the prepared project. Migration 005 preserves table data but replaces policies on `public.appointments` with owner-only reads, revokes direct public writes, and exposes narrowly scoped confirmation/status RPCs. Migration 006 reconciles the booking RPC to the current frontend signature and requests a PostgREST schema-cache reload. If an `appointments` table already exists, stop and review its schema and data before applying migration 005; `create table if not exists` does not reconcile a different existing schema.

The appointment RPC accepts active product IDs, validates prices against trusted `public.products` data, snapshots those services, and fixes the deposit at 50 EGP. Customers do not select an appointment date or time when submitting a request; the owner contacts them to arrange a visit. The legacy nullable `appointment_at` column is retained so applying the migration does not discard any previously recorded appointment times.

Migration 007 moves requests to `pending_review` with deposit status `not_requested`. The owner can accept and request the deposit, moving both to `awaiting_payment`; only after the owner marks receipt `payment_verified` can the request be moved to `confirmed`. A verified deposit can be marked `refunded` only after cancellation or rejection. The database validates these transitions; the owner verifies payment manually.

Public users can create requests and retrieve a limited confirmation only with the high-entropy token held by the submitting browser. They cannot list, read directly, update, or delete customer records. Only the server-claimed HADAD owner can read customer data and change appointment or deposit statuses through the owner RPC. Customers see no payment instructions and are explicitly told that payment is not due during initial submission. The owner sends InstaPay or Vodafone Cash payment instructions directly through WhatsApp after reviewing and accepting a request.

The legacy product and image policies from migration 003 remain: visitors can read active products and public bucket images; only an authenticated owner can manage products or upload, replace, and delete product images.

The booking RPC signature is `public.create_hadad_appointment(text, text, text, uuid[], text, uuid, text)`, with arguments `p_customer_name`, `p_whatsapp`, `p_email`, `p_product_ids`, `p_notes`, `p_idempotency_key`, and `p_confirmation_token`. It is `SECURITY DEFINER` with a fixed `search_path`; execute permission is granted only to `anon` and `authenticated`, while direct appointment-row reads remain restricted by the owner policy. If PostgREST reports that the function cannot be found, confirm migrations 005 and 006 completed and inspect the live function before retrying:

```sql
select
  p.oid::regprocedure as identity,
  p.proargnames,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_hadad_appointment';
```

## 3. Create and authorize the owner account

The dashboard uses Supabase Auth; a browser-side static password is not an authorization mechanism. Create the owner's email/password user in **Supabase Dashboard → Authentication → Users**. In the SQL Editor, mark that exact account as the owner (replace the email):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"hadad_owner": true}'::jsonb
where email = 'owner@example.com';
```

Confirm the update affected exactly the intended owner account. Sign out and back in after changing the claim so the user's JWT includes `app_metadata.hadad_owner = true`. The RLS policies check this server-issued app metadata; user-editable profile metadata is not used for authorization. Do not expose Supabase admin credentials in the app.

## 4. Product images and legacy booking behavior

The owner dashboard uses file inputs to upload a main image and optional package gallery images to Storage, then saves their public URLs with the product. The database also validates required text, integer prices, supported categories, and image-count limits.

Customers only submit their contact information and selected product IDs. The database RPC rejects invalid contact data, duplicate or inactive product IDs, and totals below the 50 EGP deposit. It creates the product snapshots and all totals from current database prices, rather than trusting values sent by the browser.

Bookings retain the product title and price snapshots even if a product is later edited or deleted. Hidden products stay in the database with `active = false` and are excluded from public catalog reads.

The Vercel deployment uses the root `vercel.json` rewrite to serve the React app for client-side routes such as `/dashboard`. For other hosts, enable their equivalent SPA fallback.

## 5. Appointment behavior

The public appointment form requires name, WhatsApp number, email, and at least one active service. Customers submit a request without choosing a date or time; HADAD contacts them on WhatsApp to arrange a visit. Appointment creation fails clearly when Supabase is unavailable; the confirmation screen appears only after the database RPC returns the saved request. A browser-persisted idempotency key makes retries of an ambiguous network request return the original booking instead of duplicating it. The confirmation token is stored locally to permit secure confirmation restoration after a refresh in the same browser.

Appointment requests start as `pending_review` with deposit `not_requested`. Customers are told no payment is due initially. Owners review and contact customers over WhatsApp; accepting a request changes it to `awaiting_payment` and requests the 50 EGP deposit. The owner sends the payment instructions (InstaPay or Vodafone Cash) manually and marks receipt `payment_verified` only after checking it. The owner can confirm only after payment verification, then complete or cancel the appointment. Refund status is available only after cancellation or rejection. Idempotency and token-based confirmation restoration remain enabled.
