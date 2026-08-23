# Remote schema baseline

Captured read-only from `ordering dev` (`qzdpohytpvjkidxgvzkd`) on 2026-08-23.
No DDL, DML, migration repair, or configuration change was performed.

## Inventory summary

- Non-system schemas: 15
- Core tables: 8 (all RLS-enabled)
- Ordering tables: 28 (all RLS-enabled)
- Notifications tables: 7 (all RLS-enabled)
- Public tables: none reported by `pg_tables`
- Policies: core 9, cron 2, ordering 54, realtime 2, storage 6
- Trigger events: core 5, notifications 5, ordering 73
- Routines: core 11, ordering 56, private 54, public 15
- Security-definer routines: core 11, ordering 45, private 28, public 15

## Schemas observed

`auth`, `core`, `cron`, `extensions`, `graphql`, `graphql_public`, `net`,
`notifications`, `ordering`, `private`, `public`, `realtime`, `storage`,
`supabase_migrations`, and `vault`.

## Important observations

- The application schemas (`core`, `ordering`, and `notifications`) have RLS enabled
  on every table reported in the baseline.
- `ordering` has a substantial runtime surface: 28 tables, 56 routines, 54 policies,
  and 73 trigger events. This is why migration SQL should not be invented from names.
- The notifications schema is server-oriented and has seven RLS-enabled tables.
- Vault metadata is intentionally excluded from this schema snapshot; only secret names
  are documented in `supabase-secrets-inventory.md`.

## Fingerprint scope

Column-level fingerprints were queried for all `core`, `ordering`, and `notifications`
tables. They should be regenerated after any future read-only schema export and compared
before adding recovery migrations. A fingerprint mismatch identifies a table requiring
SQL-level review; it does not itself prove that a migration is missing.

## Next Git-only action

Use this baseline to compare a local clean-database schema once a Supabase CLI/schema
export is available. Do not apply the resulting SQL to the connected project. Add only
reviewed, additive recovery migrations to Git.
