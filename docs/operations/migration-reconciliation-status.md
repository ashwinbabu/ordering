# Migration reconciliation status

## Current state

The connected project reports 58 applied migration records. The recovery branch currently
contains 39 SQL migration files, including the migration recovered from `origin/dev`.
The remote migration inventory is recorded in `remote-migrations-20260823.txt`.

## Git-only decision

No migration has been applied, repaired, renamed in the remote history, or pushed to Supabase.
The recovery branch contains only the SQL that was available from Git history plus documentation.

## Unrecoverable-from-metadata items

Supabase's migration list provides version and name metadata, but not the original SQL body.
The remaining remote-only migration bodies therefore cannot be recreated safely from the list
alone. They require either a historical Git commit, a reviewed schema diff, or an owner-supplied
source migration.

## Required review before adding SQL

- Compare the remote schema with a fresh database built from the recovery branch.
- A read-only declarative export was captured under `supabase/schemas/` using Supabase CLI
  2.115.0 with `remoteHistoryUpdated: false` and secrets redacted.
- The CLI migration-shadow diff could not run in this environment because Docker Desktop is
  unavailable. No remote SQL was executed by the failed diff command.
- Identify whether each missing migration is already represented by a differently timestamped
  or renamed local migration.
- Recover only additive, reviewed SQL for genuine schema gaps.
- Do not use migration-history repair as a substitute for source recovery.
- Do not run `db push`, migration repair, or any DDL against the connected project as part of
  this Git-only task.

## Status

Migration recovery is intentionally incomplete rather than guessed. The Git branch is safe to
review, but it is not yet a proof that a clean database can be recreated from Git.
