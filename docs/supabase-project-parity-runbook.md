# Supabase Project Parity Runbook

## Purpose

This is the operational runbook for making the ordering platform reproducible
across Supabase environments. It is written primarily for Codex, Claude, and
other engineering agents, but it should also let a human reviewer understand
what is being changed and why.

The immediate objective is to reproduce the legacy source project's intended
system in a new Supabase account: first in Dev and later in Production. The
long-term objective is that Git remains the source of truth for deployable
database and Edge Function behaviour, so new environments and future releases
do not depend on undocumented dashboard changes.

This document is safe to commit. It may contain non-secret identifiers such as
project refs, function names, bucket names, and secret *names*. It must never
contain secret values, connection strings, API keys, private webhook URLs,
customer data, database dumps, or Storage object manifests.

## Read this first: intent before execution

The original request was framed narrowly as copying tables, schema, RPCs, and
Edge Functions. The actual reason was to create a new production-ready
Supabase setup in a different account. Treating the narrow request as the full
goal would have missed Storage, Auth, secrets, scheduled work, data, dashboard
configuration, external webhooks, and cutover safety.

### Required agent behaviour

When asked to "copy", "migrate", "sync", "reconcile", or "move" Supabase,
an agent must determine the underlying outcome before making changes. At a
minimum, establish:

1. Why the transfer is needed and whether the target is Dev, Production, or
   both.
2. Whether the user needs only deployable code/schema, or also real data,
   Auth users, Storage files, external integrations, and dashboard settings.
3. Whether the source project is still receiving writes and what the rollback
   expectation is.
4. Whether the task is a clean new-environment bootstrap or a live production
   cutover.
5. Which actions are safe to automate and which need an explicit user decision
   (especially data, Auth users, payments, secrets, and production writes).

An agent should explain any material gaps between the stated request and the
actual outcome, propose a safe plan, and record accepted exclusions. This is
not an approval gate for ordinary work; it is intent discovery that prevents a
technically correct partial transfer from becoming an operational failure.

## Desired end state

Two separate things must be true:

1. **Reproducibility:** a new empty Supabase project can receive the Git
   blueprint and become a working empty environment.
2. **Parity:** the new Dev or Production project has the intended equivalent
   schema, functions, configuration, data, files, and integrations for that
   environment.

Equivalent does not mean byte-for-byte identical. Project refs, URLs,
Supabase-generated API keys, JWT/signing material, active sessions, and
environment-specific third-party credentials must differ between Dev and
Production.

## Ownership model

| Category | Source of truth | In Git? | Notes |
| --- | --- | --- | --- |
| Tables, schemas, RPCs, triggers, RLS, grants | SQL migrations | Yes | New changes must use tracked migrations. |
| Edge Function code and JWT behaviour | `supabase/functions/` and `supabase/config.toml` | Yes | Deploy from Git; do not use dashboard-only code edits. |
| Extensions, bucket definitions, Storage policies, cron definitions | Migrations or reviewed deployment configuration | Yes | Must be target-safe and idempotent. |
| Auth/dashboard settings and external registrations | Sanitized runbook + environment configuration | Names/instructions only | Apply separately per project. |
| Secret and Vault values | Supabase secret/Vault store or CI secret store | No | Only names and ownership are documented. |
| Business data, Auth records, Storage objects | Controlled export/import process | No | One-time transfer and deliberate backups, never routine Git deployment. |

## How this should have been prevented from the beginning

1. Make migrations the sole way to change durable application schema, RPCs,
   policies, and triggers.
2. Keep every Edge Function source package and its auth setting in Git, and
   deploy functions through a repeatable CLI/CI process.
3. Avoid dashboard-only database or function edits. If emergency work occurs,
   immediately reconcile it back to Git before the next release.
4. Keep a name-only runtime configuration inventory for secrets, Auth, Storage,
   cron jobs, and external webhooks.
5. Treat application data and uploaded files as operational data, not
   migrations. Back them up and transfer them through a deliberate data plan.
6. Use Dev first, verify it, then deploy the same Git revision to Production.

## Current source and Git state

| Item | Current finding | Status |
| --- | --- | --- |
| Source project | Legacy Dev project ref `qzdpohytpvjkidxgvzkd` | Read-only audit source |
| Remote migration ledger | 60 historical records | Intentionally not reproduced as target history |
| Active Git migrations | One clean baseline migration | Recreates the current application schema |
| Legacy Git migrations | 38 archived files | Historical reference only; not deployed to new projects |
| Application object parity | 43 tables, 137 routines, 63 policies, 83 triggers | Verified against local baseline |
| Edge Functions | 10 deployed source functions and JWT settings recovered to Git | Verified |
| Source Storage | Five public buckets, 11 objects, 600,287 bytes | Transfer inventory still needs a private object manifest |
| Storage policies | Six policies | Need target-safe migration/configuration plan |
| Scheduled work | Three active cron jobs | Need target-safe recreation plan |
| Realtime | Supabase-managed message publication observed | Do not manually copy platform-managed partitions |
| Secrets | 9 Edge Function secret names and 6 Vault secret names | Name-only Git inventory still required |
| Data/Auth/dashboard config | Not yet transferred | Requires deliberate plan and decisions |

## Source inventory already observed

### Edge Functions

The source project currently has these ten active functions, all recovered into
Git with their current `verify_jwt` setting in `supabase/config.toml`:

- `customer-auth-msg91`
- `notification-dispatcher`
- `notification-react-email-spike`
- `razorpay-webhook`
- `seed-one-product-image`
- `seed-product-image`
- `send-sms-hook`
- `start-online-payment`
- `telegram-webhook`
- `verify-online-payment`

### Storage

| Bucket | Public | Objects | Bytes |
| --- | --- | ---: | ---: |
| `admin-order-sounds` | Yes | 4 | 388,172 |
| `alarm-sounds` | Yes | 1 | 176,444 |
| `business-logos` | Yes | 0 | 0 |
| `catalog-product-images` | Yes | 0 | 0 |
| `product-images` | Yes | 6 | 35,671 |

### Scheduled jobs

| Job | Schedule | Purpose |
| --- | --- | --- |
| `notification-dispatcher-sweep` | Every minute | Dispatch queued notifications |
| `waiting-order-events-sweep` | Every minute | Process waiting-order events |
| `daily-sales-summary-sweep` | Every 15 minutes | Generate/retry sales-summary work |

### Required extension inventory

- `pgcrypto`
- `pg_stat_statements`
- `pg_net`
- `supabase_vault`
- `uuid-ossp`
- `pg_cron`

### Secret inventory (names only)

Edge Function secret names observed in the source project:

- `MSG91_AUTHKEY`
- `SEND_SMS_HOOK_SECRET`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_JWKS`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_SECRET_KEYS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Vault secret names observed in the source project:

- `notification-dispatcher-auth`
- `notifications-resend-api-key`
- `razorpay_key_secret:a2_arambol:test`
- `razorpay_webhook_secret:a2_arambol:test`
- `telegram_bot_token`
- `telegram_webhook_secret`

Environment values referenced by function code must also be documented during
Phase 1, including `STOREFRONT_ALLOWED_ORIGINS`, `MSG91_OTP_VARIABLE_NAME`,
and `MSG91_TEMPLATE_ID`. Presence in code does not prove a value is currently
configured in Supabase.

## Phase plan

### Phase 1 — Freeze and inventory the source project

**Goal:** create a reliable packing list before any data or runtime transfer.

1. Capture a dated, private transfer manifest with exact table row counts,
   sequence values, and Storage object paths/sizes/checksums.
2. Commit a sanitized configuration inventory: object names, policies,
   extensions, function configuration, secret names, and cron purpose/schedule.
3. Capture Auth dashboard configuration: site URL, redirect URLs, OTP/SMS
   settings/templates, providers, SMTP, rate limits, and hooks.
4. Capture external registration details from Razorpay, Telegram, MSG91, and
   Resend: enabled feature, owner, callback path/domain, and target secret
   name. Do not record tokens or signing values.
5. Decide whether existing Auth users and identities must transfer. Never plan
   to preserve active sessions or tokens across projects.
6. Re-run the inventory immediately before a final data export or production
   cutover and record any changes.

**Complete when:** every source dependency is labelled **transfer**,
**recreate**, **intentionally exclude**, or **platform-managed**.

### Phase 2 — Finalize the Git blueprint

**Goal:** make Git sufficient to create an empty, working environment.

1. Review and commit the clean baseline migration, archived legacy migrations,
   declarative schema export, all function source, and this runbook.
2. Add tracked, target-safe migrations/configuration for bucket definitions,
   Storage policies, required extensions, and application-owned scheduled work.
3. Keep secret values, real data, and object files out of Git.
4. Reset the local Supabase database from Git and verify schema/function
   parity.

**Complete when:** a new empty project can be built from a single reviewed Git
revision plus environment-specific secrets/configuration.

### Phase 3 — Build and configure the new Dev project

**Goal:** create an empty but working new Dev environment.

1. Create/link the target project and enable verified extensions.
2. Apply migrations and deploy all Edge Functions from Git.
3. Set new Dev secrets and Vault values from a secure store.
4. Configure Auth, SMTP, Realtime, Storage, and dashboard-level settings.
5. Register only Dev/test external webhooks and credentials.

**Complete when:** the target passes schema/function/configuration checks before
real data is imported.

### Phase 4 — Transfer data, Auth decision, and Storage objects

**Goal:** make the new Dev environment hold the intended equivalent data.

1. Import application data into the migration-built target. Do not restore a
   full old schema dump over it.
2. Import Auth users/identities only if the Phase 1 decision requires it;
   require users to sign in again.
3. Copy Storage objects only after target buckets/policies exist. Do not import
   `storage.objects` metadata separately if the copy tool creates it.
4. Reset sequences and compare exact row counts/object manifests.

**Complete when:** data and files match the Phase 1 manifest and access behaves
correctly.

### Phase 5 — End-to-end verification in Dev

**Goal:** prove equivalent behaviour, not merely equivalent files.

1. Compare schema, functions, extensions, Storage, cron jobs, secret names,
   and relevant configuration.
2. Test storefront, admin, Auth/OTP, images, notifications, scheduled work,
   payment test flow, and webhook verification.
3. Record accepted intentional differences, such as project URLs, generated
   keys, and invalidated sessions.

**Complete when:** a written parity report passes and all differences are
intentional.

### Phase 6 — Production build and controlled cutover

**Goal:** promote the verified Dev blueprint safely to Production.

1. Create Production from the same committed Git revision.
2. Repeat project-specific configuration and secure secret setup.
3. Perform initial data/Storage transfer, then schedule a short source write
   freeze for the final delta.
4. Repoint application configuration and external webhook registrations.
5. Run post-cutover smoke tests and keep the old project read-only during an
   agreed rollback window.

**Complete when:** Production is live, verified, and rollback conditions are
documented.

### Phase 7 — Ongoing deployment discipline

**Goal:** prevent drift from returning.

1. Change schema/RPCs/policies/triggers only through committed migrations.
2. Change Edge Functions only in Git and deploy from CI/CLI.
3. Update this runbook when a runtime dependency, secret name, or external
   integration changes.
4. Deploy the same Git revision to Dev before Production.
5. Use data migrations only for deliberate, reviewed application-data changes;
   do not treat ordinary customer/order data as migrations.

## Standard deployment model

For a **new** project, deployment has two layers:

1. **Bootstrap once:** deploy Git blueprint, apply environment configuration,
   set secrets, transfer intended data/files, and verify.
2. **Deploy routinely:** apply new migrations and deploy Edge Functions from a
   reviewed Git revision. Do not copy all data, files, or secrets on every
   release.

The Supabase CLI commands are conceptually:

```bash
supabase db push --project-ref <target-project-ref>
supabase functions deploy --project-ref <target-project-ref>
```

Use a CI deployment script for routine releases. It should obtain target refs
and secret values from a secure CI secret store, not from Git. Per-function JWT
behaviour is controlled by `supabase/config.toml`; do not apply one global
`--no-verify-jwt` setting to all functions.

## Verification and evidence

Use these repository artifacts as evidence:

- [Baseline migration](../supabase/migrations/20260824005041_legacy_project_baseline.sql)
- [Legacy migration archive](../supabase/legacy-migrations/pre-new-account-baseline/README.md)
- [Declarative schema export README](../supabase/schemas/README.md)
- [Function deployment configuration](../supabase/config.toml)

Known comparison note: the schema diff tool reports a formatting-only
drop-and-recreate of `ordering.orders_rate_snapshots_check`. Direct constraint
definitions in the legacy source and local baseline were verified identical;
this is a pg-delta normalization false positive, not schema drift.

## Activity log

Add only meaningful milestones, outcomes, decisions, and links to evidence.
Do not log secrets, commands containing credentials, personal data, or raw
database/file dumps.

| Date | Phase | Milestone / outcome | Evidence / follow-up |
| --- | --- | --- | --- |
| 2026-08-23 | 2 | Archived 38 active historical migrations; retained them as reference while preparing a clean baseline. | `supabase/legacy-migrations/pre-new-account-baseline/` |
| 2026-08-24 | 2 | Generated and locally reset a single clean baseline. Application objects matched the legacy source: 43 tables, 137 routines, 63 policies, 83 triggers. | Baseline migration and local reset verification |
| 2026-08-24 | 2 | Recovered all 10 deployed Edge Functions and matching per-function JWT configuration into Git. | `supabase/functions/`, `supabase/config.toml` |
| 2026-08-24 | 1 | Performed read-only source audit of Storage, cron jobs, extensions, secret names, Realtime, and source data estimates. | Phase 1 remains incomplete until private manifest, Auth/external inventory, and Auth decision are completed. |
| Pending | 1 | Create sanitized runtime configuration inventory and private transfer manifest. | Next active milestone |

## Agent handoff checklist

Before changing any Supabase environment, an agent must:

1. Read this runbook and inspect Git status.
2. State the target project/environment and whether the action is read-only,
   local-only, Dev, or Production.
3. Confirm the relevant phase and its completion condition.
4. Preserve unrelated worktree changes and never commit/push without explicit
   user instruction.
5. Keep values of secrets and customer data out of Git, logs, and chat output.
6. After meaningful work, update the activity log with a concise outcome and
   evidence link.

