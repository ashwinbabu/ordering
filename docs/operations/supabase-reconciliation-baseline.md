# Supabase reconciliation baseline

Captured 2026-08-23 for the `ordering dev` project (`qzdpohytpvjkidxgvzkd`).

## Git baseline

- Recovery branch: `codex/supabase-reconciliation`
- Starting commit: `6cf9e16d4e6ab66bfda57033869fc784e9327a1d`
- Worktree was clean before the recovery branch was created.
- Git remote: `origin` (`https://github.com/ashwinbabu/ordering.git`)
- Remote branches fetched: `origin/dev`, `origin/vig`
- Tracked migration files at the starting commit: 38
- Tracked function files at the starting commit: 41

The fetched branches do not contain the missing deployed function directories. `origin/dev`
contains one additional migration file, `20260823083717_menu_category_deletion_and_product_images.sql`,
but neither fetched branch contains the complete deployed migration history.

## Connected Supabase baseline

- Project name: `ordering dev`
- Project ref: `qzdpohytpvjkidxgvzkd`
- Region: `ap-south-1`
- Database status: `ACTIVE_HEALTHY`
- Applied migration records: 58
- Deployed Edge Functions: 10

The remote migration list and deployed function metadata were read through the Supabase
management connector. No schema, function, secret, or database data was changed during this
baseline capture.

## Known migration drift

- 35 applied remote migration versions do not have a matching local filename.
- 15 local migration filenames are not present in the remote applied-version list.
- Some differences appear to be timestamp/name replacements rather than independent schema
  changes. They must be compared by SQL effect before any migration-history repair.

## Known function drift

Remote-only deployed functions:

- `seed-product-image` (version 5)
- `seed-one-product-image` (version 5)
- `notification-react-email-spike` (version 4)

Tracked functions whose deployed entrypoint differs from the checked-in entrypoint:

- `send-sms-hook` (deployed version 5)
- `start-online-payment` (deployed version 3)
- `verify-online-payment` (deployed version 2)
- `razorpay-webhook` (deployed version 2)
- `notification-dispatcher` (deployed version 5)

The remaining tracked/deployed entrypoints checked during the baseline were:

- `customer-auth-msg91` (deployed version 13; entrypoint matched)
- `telegram-webhook` (deployed version 2; entrypoint matched)

Entrypoint equality does not by itself prove that all bundled shared files are equal; full
function package comparison remains a required recovery step.

## Secret metadata baseline

The following names were visible in the project's Vault metadata. Values were not queried:

- `razorpay_key_secret:a2_arambol:test`
- `razorpay_webhook_secret:a2_arambol:test`
- `notification-dispatcher-auth`
- `notifications-resend-api-key`
- `telegram_webhook_secret`
- `telegram_bot_token`

The repository also references Edge Function environment names such as `MSG91_AUTHKEY`,
`MSG91_TEMPLATE_ID`, `MSG91_OTP_VARIABLE_NAME`, `SEND_SMS_HOOK_SECRET`, and
`STOREFRONT_ALLOWED_ORIGINS`. This file intentionally does not assert that those names are
currently configured remotely; a separate non-sensitive Edge Function secret inventory is
required.

## Safety status

- No database migration was applied.
- No Edge Function was deployed or deleted.
- No secret value was read, changed, or written.
- No migration history was repaired.
