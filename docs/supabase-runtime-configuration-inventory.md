# Supabase Runtime Configuration Inventory

## Purpose and handling

This is the Git-safe configuration inventory for the legacy source project.
It supports the [Supabase Project Parity Runbook](supabase-project-parity-runbook.md)
and is intentionally limited to names, behaviour, and setup requirements.

Never add secret values, connection strings, customer data, raw dumps, Storage
object paths, or private webhook URLs to this document.

**Source audited:** legacy Dev project `qzdpohytpvjkidxgvzkd`

**Snapshot date:** 2026-08-24 UTC

**Status:** Phase 1 inventory in progress; Auth dashboard and third-party
registration inventory remain outstanding.

## Edge Functions

| Function | `verify_jwt` | Runtime role |
| --- | ---: | --- |
| `seed-product-image` | Yes | Seed catalog image assets |
| `seed-one-product-image` | Yes | Seed a single catalog image asset |
| `customer-auth-msg91` | No | Customer authentication through MSG91 |
| `send-sms-hook` | No | Supabase Auth SMS hook |
| `start-online-payment` | Yes | Start an online payment |
| `verify-online-payment` | Yes | Verify an online payment |
| `razorpay-webhook` | No | Receive Razorpay webhook events |
| `notification-react-email-spike` | No | Notification email rendering spike |
| `notification-dispatcher` | No | Dispatch queued notifications |
| `telegram-webhook` | No | Receive Telegram webhook events |

All source packages and these JWT settings are represented in Git under
`supabase/functions/` and `supabase/config.toml`.

## Storage

All five source buckets are public:

| Bucket | Intended use |
| --- | --- |
| `admin-order-sounds` | Per-location admin new-order alert sounds |
| `alarm-sounds` | Shared alarm sound assets |
| `business-logos` | Business logo assets |
| `catalog-product-images` | Managed catalog image assets |
| `product-images` | Product image assets |

The source has six Storage object policies:

- `business_logos_owners_admins_delete`
- `business_logos_owners_admins_update`
- `business_logos_owners_admins_write`
- `business_logos_public_read`
- `catalog managers can delete product images`
- `catalog managers can upload product images`

Bucket creation and the six policy definitions are recreated by
`supabase/migrations/20260824033236_storage_runtime_foundation.sql` and were
verified against the source policy hashes in the local database. The object
manifest is kept outside Git under the ignored `supabase/.parity/` workspace
during transfer.

## Database extensions

The source uses these installed extensions:

- `pgcrypto` in `extensions`
- `pg_stat_statements` in `extensions`
- `pg_net` in `public`
- `supabase_vault` in `vault`
- `uuid-ossp` in `extensions`
- `pg_cron` in `pg_catalog`

Target projects must verify extension availability before enabling them. Do not
assume every extension is enabled by default. Use
`supabase/scripts/verify-runtime-foundation.sql` after provisioning the target;
the local Docker database intentionally lacks `pg_net` and `pg_cron`.

## Scheduled jobs

| Job | Schedule | Purpose | Target setup rule |
| --- | --- | --- | --- |
| `notification-dispatcher-sweep` | Every minute | Dispatch notification work | Use target URL and target authentication material |
| `waiting-order-events-sweep` | Every minute | Process waiting-order events | Use target URL and target authentication material |
| `daily-sales-summary-sweep` | Every 15 minutes | Generate/retry sales-summary work | Use target URL and target authentication material |

The old cron command text must not be copied verbatim. It can include
old-project URLs or authentication material.

## Realtime and database webhooks

- The source has Supabase-managed realtime message partitions under
  `supabase_realtime_messages_publication`. Do not manually copy those
  partitions; the target platform manages its own.
- No database-trigger webhook definitions were found in the source audit.
- Re-check application table membership if Postgres Changes is enabled in a
  future release; current realtime use may rely on Broadcast rather than
  publication membership.

## Auth configuration

**Audited read-only:** 2026-08-24 UTC

| Setting | Source configuration | Target requirement |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | Set an environment-appropriate target URL. |
| Redirect URLs | None | Add only required target application URLs. |
| New-user signups | Enabled | Recreate intentionally. |
| Manual identity linking | Disabled | Preserve unless product requirements change. |
| Anonymous sign-ins | Disabled | Preserve unless product requirements change. |
| Email confirmation | Enabled | Preserve unless product requirements change. |
| Enabled providers | Email and Phone | Configure both in the target. |
| Third-party/custom OAuth/OIDC providers | None | No provider credentials to transfer. |
| Custom SMTP | Disabled | Default Supabase email templates are in use. |
| CAPTCHA protection | Disabled | Make an explicit target decision; do not assume this is a security recommendation. |

### Phone Auth and SMS hook

- Phone Auth is enabled and phone confirmations are required.
- The SMS hook is enabled and targets the `send-sms-hook` Edge Function. This
  hook takes precedence over the dashboard SMS provider configuration.
- SMS OTP expiry is 60 seconds and OTP length is 6 digits.
- The dashboard SMS message is the default `Your code is {{ .Code }}`.
- No test phone-number/OTP pairs were configured in the dashboard at audit
  time.

### Rate limits

- Sending SMS: 30
- Token refreshes: 150
- Token verifications: 30
- Anonymous users: 30
- Sign-ups/sign-ins: 30
- Web3 sign-ups/sign-ins: 30
- Sending email: no explicit custom value was displayed; retain the target
  platform default unless a deliberate rate is chosen.
- IP-address forwarding is disabled.

### MFA

- TOTP/App Authenticator MFA is enabled, with up to 10 factors per user.
- SMS MFA is disabled.
- The enhanced MFA setting that limits AAL1 sessions is enabled; users must
  verify an MFA factor within 15 minutes of initial sign-in.

## Auth user transfer decision

The approved transfer scope is **existing Auth users and identities**. Active
sessions, refresh tokens, MFA challenges, and other session state are excluded.
Users will need to sign in again in the new project.

Exact Auth counts and this transfer decision are retained only in the ignored
private transfer manifest during the migration.

## Secret names and ownership

### Edge Function secrets currently present in the source project

- `MSG91_AUTHKEY`
- `SEND_SMS_HOOK_SECRET`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_JWKS`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_SECRET_KEYS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

### Vault secret names currently present in the source project

- `notification-dispatcher-auth`
- `notifications-resend-api-key`
- `razorpay_key_secret:a2_arambol:test`
- `razorpay_webhook_secret:a2_arambol:test`
- `telegram_bot_token`
- `telegram_webhook_secret`

### Additional function configuration names referenced in code

- `STOREFRONT_ALLOWED_ORIGINS`
- `MSG91_OTP_VARIABLE_NAME`
- `MSG91_TEMPLATE_ID`

For each target environment, record the owning system and set values through
Supabase secrets/Vault or the approved CI secret store. Never copy
Supabase-generated API/JWT material from the source project; generate or use
the target project's values.

## Still required to complete the Phase 1 inventory

1. External registrations in Razorpay, Telegram, MSG91, and Resend: enabled
   feature, owner, callback domain/path, and target secret name only.
2. A final repeat of this inventory immediately before final data export or
   cutover.

## Access dependency

The Auth dashboard inventory was completed from a read-only Owner/Admin
dashboard session on 2026-08-24 UTC. Future inventory work requires the same
level of source-project access.
