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

The policy definitions and bucket creation must be recreated in a target-safe,
reviewed migration or deployment configuration. The object manifest is kept
outside Git under the ignored `supabase/.parity/` workspace during transfer.

## Database extensions

The source uses these installed extensions:

- `pgcrypto` in `extensions`
- `pg_stat_statements` in `extensions`
- `pg_net` in `public`
- `supabase_vault` in `vault`
- `uuid-ossp` in `extensions`
- `pg_cron` in `pg_catalog`

Target projects must verify extension availability before enabling them. Do not
assume every extension is enabled by default.

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

1. Auth dashboard settings: site URL, redirect URLs, SMS/OTP settings and
   templates, providers, SMTP, rate limits, and hooks.
2. External registrations in Razorpay, Telegram, MSG91, and Resend: enabled
   feature, owner, callback domain/path, and target secret name only.
3. A decision about transferring Auth users/identities. Active sessions and
   tokens must not be transferred as valid sessions.
4. A final repeat of this inventory immediately before final data export or
   cutover.
