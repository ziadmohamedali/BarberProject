# HADAD Supabase setup and security

## 1. Configure the app

Set the Supabase **Project URL** and **public anon/publishable key** in the root `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://xjxcporjtskrwppsvcsp.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Never place a service-role key, database password, or private credential in a `VITE_` variable.

## 2. Dashboard owner login

The dashboard signs in with Supabase Auth (email and password). After sign-in the app calls `public.is_hadad_owner()` and only opens the dashboard when the signed-in user's ID is listed in `public.hadad_owners` (migration 014). Other accounts are signed out again. The session persists in `localStorage` across browser restarts until the owner logs out, and is refreshed automatically. Visiting the dashboard route without an owner session redirects to `/owner-login`.

**Password recovery.** *Forgot password?* on the login form emails a reset link. The link opens `/owner-login`, where the owner sets a new password (minimum 8 characters) and lands in the dashboard. For the link to return to the app, add each site origin under **Authentication → URL Configuration → Redirect URLs**, for example `http://localhost:5174/**` and the production domain followed by `/**`.

Set up the owner once in the Supabase dashboard:

1. **Authentication → Users**: the owner account is `mohamed7adad1@gmail.com`. If it has no password, use *Forgot password?* on the login form to set one; verifying the reset link also confirms the email address.
2. Apply `supabase/migrations/014_hadad_owner_by_uid.sql`, which registers that account's user ID as the owner. To register a different account, insert its ID: `insert into public.hadad_owners (user_id) values ('<user id>');`

Supabase RLS remains enabled and requires this authenticated owner for protected reads and writes. Do not add anonymous write policies.

## 3. Apply migrations

For a new, empty project, first review and apply `supabase/migrations/000_hadad_fresh_project_products.sql`. It creates the current `products` schema and public image bucket used by migration 003. Then apply reviewed migrations in order:

1. `supabase/migrations/003_hadad_live_integration.sql`
2. `supabase/migrations/004_hadad_contact_settings.sql`
3. `supabase/migrations/005_hadad_appointments.sql`
4. `supabase/migrations/006_fix_hadad_appointment_rpc.sql`
5. `supabase/migrations/007_hadad_deposit_workflow.sql`
6. `supabase/migrations/008_unified_customer_accounts.sql` (despite its legacy filename, this adds owner-only private appointment notes/archive support; it does not create customer accounts)
7. `supabase/migrations/009_appointment_feedback_compat.sql`
8. `supabase/migrations/010_hadad_live_home.sql`
9. `supabase/migrations/011_appointment_preference_owner_edit.sql`
10. `supabase/migrations/012_hadad_contact_settings_owner_policy.sql`
11. `supabase/migrations/013_hadad_owner_reads_product_images.sql` (lets the owner's image cleanup actually delete replaced files; Storage only deletes objects the caller can select)
12. `supabase/migrations/014_hadad_owner_by_uid.sql` (identifies the owner by Auth user ID instead of an `app_metadata` claim)

Do not run the legacy `001_hadad_schema.sql` or `002_hadad_security.sql` on a fresh project; their product schema uses obsolete column names. For an existing project, inspect its schema, RLS policies, Storage resources, and migration history first. Do not run the fresh-project bootstrap against it. Apply only migrations that are missing and compatible with the inspected schema.

Do not run the legacy `001_hadad_schema.sql`, `002_hadad_security.sql`, or `setup.sql` against the prepared project. Migration 005 preserves table data but replaces policies on `public.appointments` with owner-only reads, revokes direct public writes, and exposes narrowly scoped confirmation/status RPCs. Migration 006 reconciles the booking RPC to the current frontend signature and requests a PostgREST schema-cache reload. If an `appointments` table already exists, stop and review its schema and data before applying migration 005; `create table if not exists` does not reconcile a different existing schema.

The appointment RPC accepts active product IDs, validates prices against trusted `public.products` data, snapshots those services, and fixes the deposit at 50 EGP. Customers may submit a preferred date and time within 30 days; it is stored separately from `appointment_at`, which remains the owner-agreed time. A preference is not a confirmed slot. Migration 011 extends the token-protected booking RPC while preserving idempotency and owner-only access to appointment rows, and enforces the 30-day limit in the database.

Migration 007 moves requests to `pending_review` with deposit status `not_requested`. The owner can accept and request the deposit, moving both to `awaiting_payment`; only after the owner marks receipt `payment_verified` can the request be moved to `confirmed`. A verified deposit can be marked `refunded` only after cancellation or rejection. The database validates these transitions; the owner verifies payment manually.

Public users can create requests and retrieve a limited confirmation only with the high-entropy token held by the submitting browser. They cannot list, read directly, update, or delete customer records. Only the server-claimed HADAD owner can read customer data and change appointment or deposit statuses through the owner RPC. Customers see no payment instructions and are explicitly told that payment is not due during initial submission. The owner sends InstaPay or Vodafone Cash payment instructions directly through WhatsApp after reviewing and accepting a request.

Migration 010 creates the single-row `hadad_home_settings` table. Public reads expose homepage content and settings; updates require the server-claimed owner. Its `rules_en` and `rules_ar` columns were originally seeded with explanatory booking text, not working hours. The app preserves legacy plain-text values as the public warning and uses default hours until the owner saves from Live Home. New saves keep the bilingual warning text and separately typed opening/closing times together in these existing text columns; the homepage displays the saved warning alongside the formatted hours. No schema migration is needed for this representation. The migration inserts its defaults only when the singleton row does not already exist, so applying it does not replace existing values. Hero images reuse the existing public `product-images` bucket and its owner upload policies; no additional bucket or Storage policy is required. Do not apply migrations automatically from the app. Review the live schema and migration history first, then run only migrations that have not already been applied, in the order above.

The legacy product and image policies from migration 003 remain: visitors can read active products and public bucket images; only an authenticated owner can manage products or upload, replace, and delete product images.

After migration 011, the app calls `public.create_hadad_appointment(text, text, text, uuid[], text, uuid, text, timestamptz)`, adding `p_preferred_appointment_at` to the original seven arguments. The eight-argument overload is `SECURITY DEFINER` with a fixed `search_path`; execute permission is granted only to `anon` and `authenticated`, while direct appointment-row reads remain restricted by the owner policy. If PostgREST reports that the function cannot be found, confirm migrations 005, 006, and 011 completed and inspect the live function before retrying:

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

## 4. Supabase owner authorization

Do not grant anonymous write access. Products, contact settings, homepage settings, bookings, appointments, and Storage mutations remain protected by the RLS policies that require an authenticated user with the owner claim. The dashboard login described in section 2 provides that owner session.

Migration 012 reconciles all Contact Settings policies and table grants, preserving public reads while allowing updates only to authenticated users with the server-managed owner claim. Review the live schema and migration history before applying migrations.

## 5. Product images and legacy booking behavior

The owner dashboard uses file inputs to upload a main image and optional package gallery images to Storage, then saves their public URLs with the product. The database also validates required text, integer prices, supported categories, and image-count limits.

Customers only submit their contact information and selected product IDs. The database RPC rejects invalid contact data, duplicate or inactive product IDs, and totals below the 50 EGP deposit. It creates the product snapshots and all totals from current database prices, rather than trusting values sent by the browser.

Bookings retain the product title and price snapshots even if a product is later edited or deleted. Hidden products stay in the database with `active = false` and are excluded from public catalog reads.

The Vercel deployment uses the root `vercel.json` rewrite to serve the React app for client-side routes such as `/dashboard`. For other hosts, enable their equivalent SPA fallback.

## 5. Appointment behavior

The public appointment form requires name, WhatsApp number, email, and at least one active service. Customers can optionally submit a preferred date and time, clearly labeled as a request that must be confirmed by HADAD. Appointment creation fails clearly when Supabase is unavailable; the confirmation screen appears only after the database RPC returns the saved request. A browser-persisted idempotency key makes retries of an ambiguous network request return the original booking instead of duplicating it. The confirmation token is stored locally to permit secure confirmation restoration after a refresh in the same browser.

Appointment requests start as `pending_review` with deposit `not_requested`. Customers are told no payment is due initially. Owners review and contact customers over WhatsApp; accepting a request changes it to `awaiting_payment` and requests the 50 EGP deposit. The owner sends the payment instructions (InstaPay or Vodafone Cash) manually and marks receipt `payment_verified` only after checking it. The owner can confirm only after payment verification, then complete or cancel the appointment. Refund status is available only after cancellation or rejection. Idempotency and token-based confirmation restoration remain enabled.
