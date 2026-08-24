# New-account schema baseline

This directory is a read-only declarative export of the legacy Supabase project (`qzdpohytpvjkidxgvzkd`) captured on 2026-08-24.

It is the source for the new Supabase account's clean baseline. It contains database definitions only: application schemas, tables, indexes, constraints, RLS policies, views, triggers, PostgreSQL/RPC functions, default privileges, and required extensions. It does not contain application data or secret values.

`auth/tables/users.sql` contains the trigger that synchronizes Auth-user phone changes into the application customer record. It does not export Auth users or sessions.

The active `supabase/migrations/` directory is intentionally empty while the legacy migration chain remains archived in `supabase/legacy-migrations/pre-new-account-baseline/`.

The executable baseline generated from this export is `supabase/migrations/20260824005041_legacy_project_baseline.sql`. It was created through a read-only migration diff against the legacy project and applied successfully twice to a blank local Supabase database on 2026-08-24.

The baseline includes the custom `auth.users` → `core.customers` sync trigger but does not contain Auth accounts or sessions. Data, Edge Function secrets, and cron-job records are separate transfer concerns and must not be inferred from this schema migration.

Do not use migration-mode `supabase db pull` against the legacy project unless a source migration-history update is explicitly authorized.
