# HADAD Barber Shop

A one-owner barber service catalog and booking app built with React, Vite, and Supabase.

## Supabase setup

1. Copy `.env.example` to `.env.local` and fill in the project URL and publishable (or legacy anon) key. Find both in the Supabase project dashboard under **Project Settings → API Keys**. Use the project URL shown in **Project Settings → API**. Neither value is a service-role/secret key.
2. In the SQL Editor for the intended project, inspect the current `public.products`, `public.bookings`, `public.hadad_contact_settings`, `storage.buckets`, and policies. The live `products` table and public `product-images` bucket are reused; do not run the legacy `001_hadad_schema.sql`, `002_hadad_security.sql`, or `setup.sql` against the prepared project.
3. Review and run `supabase/migrations/003_hadad_live_integration.sql` if it has not already been applied. It adds the owner-check function, bookings table/RPC, and required product/storage policies without dropping policies or recreating the existing products table or storage bucket.
4. Review and run `supabase/migrations/004_hadad_contact_settings.sql`. It adds the single-row public contact/payment settings table, permits public reads, and restricts updates to an authenticated HADAD owner. It does not modify products, bookings, or Storage.
5. Inspect the live schema and policies, then review and run `supabase/migrations/005_hadad_appointments.sql`. If `public.appointments` already exists, stop and reconcile its schema before applying; the migration never deletes appointment rows. It creates the appointment table and owner-only read policy. Customers submit service requests without a date or time, and the owner arranges the visit.
6. Run `supabase/migrations/006_fix_hadad_appointment_rpc.sql` after migration 005. It reconciles the RPC signature and grants for public booking, preserves the booking reference, idempotency, active-product and trusted-price checks, and tells PostgREST to reload its schema cache.
7. Run `supabase/migrations/007_hadad_deposit_workflow.sql` after migration 006. It maps prior request/deposit states to the owner-review workflow, requires a verified deposit before appointment confirmation, and allows refunds only after cancellation or rejection.
8. The single owner Auth account uses the static sign-in email `mohamedhadad@hadad.invalid` (it does not need to be a real mailbox). At the dashboard, enter `MohamedHadad` as the username; the app maps it to this Auth account. Set or change the password directly in Supabase Auth; do not put the password into SQL, source files, or browser configuration.
9. Grant the owner claim to that exact Auth account from the SQL Editor and verify exactly one account was changed:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
     || '{"hadad_owner": true}'::jsonb
   where email = 'mohamedhadad@hadad.invalid';
   ```

10. Set Supabase Auth’s minimum password length to at least 8 characters. The dashboard password form requires the current password and matching valid new passwords; Supabase Auth stores the password hash and the update persists across sessions and deployments.

The app uses Supabase Auth plus Postgres and Storage RLS as its authorization boundary. Never add write policies for all `anon` or `authenticated` users, and never put the service-role/secret key in frontend code or any `VITE_` variable. Public visitors can read active products, public contact/payment details, and public bucket images; only a session with server-issued `app_metadata.hadad_owner=true` can manage products, bookings, contact settings, or product images.

## Catalog and owner dashboard

The public catalog reads active haircuts and packages from `public.products`. The owner dashboard can create, edit, reorder, hide, and delete either category. Every product supports a main image and up to four additional gallery images. Product changes and uploaded images persist in Supabase.

The owner dashboard's **Contact Settings** section manages the public WhatsApp/contact phone numbers, Instagram and Facebook URLs, and InstaPay payment details. Public pages read these values from `public.hadad_contact_settings`; optional contact links and payment instructions are hidden when their values are empty.

## Development

```sh
npm install
npm run dev
```

For Vercel, use `npm run build` as the build command and `dist` as the output directory. The included `vercel.json` sends client-side routes such as `/dashboard` to the app entry point, so directly visiting or refreshing those routes works.

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's Environment Variables for each required deployment environment, then redeploy after adding or changing them. Vite embeds these values at build time. Without them, the deployed app stays in preview mode and bookings/dashboard data will not work. These are browser-visible public connection settings; do not configure a service-role or secret key for this Vite frontend.

Build and lint:

```sh
npm run build
npm run lint
```
