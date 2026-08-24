# Archived Supabase migrations

These migrations belonged to the legacy Supabase project and are preserved for audit and recovery.

They are intentionally outside `supabase/migrations/` so they cannot be replayed against the new Supabase account. The legacy project has migration-history drift: its remote migration ledger contains entries that were not present as local SQL files.

The new account will start from one verified schema/RPC baseline migration in `supabase/migrations/`. Future schema, RLS, RPC, trigger, and extension changes should be added as new migrations after that baseline.

No production or application data is stored in this directory.
