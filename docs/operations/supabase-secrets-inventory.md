# Supabase secret/configuration inventory

This is a names-and-purpose inventory only. Secret values must remain in Supabase
Edge Function Secrets, Supabase Vault, CI secret storage, or ignored local files.

## Edge Function environment names referenced by the repository

| Name | Consumer | Classification |
|---|---|---|
| MSG91_AUTHKEY | customer-auth-msg91, send-sms-hook | provider credential |
| MSG91_TEMPLATE_ID | send-sms-hook | provider configuration |
| MSG91_OTP_VARIABLE_NAME | send-sms-hook | provider configuration |
| SEND_SMS_HOOK_SECRET | send-sms-hook | webhook authentication secret |
| STOREFRONT_ALLOWED_ORIGINS | payment/auth functions | origin configuration |
| SUPABASE_URL | server-side functions | platform-provided configuration |
| SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS | server-side functions | privileged platform credential |
| SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEYS | user-scoped functions | public platform credential |

The presence of a name in this file does not assert that it is configured in every
environment. Configuration presence must be verified separately without printing values.

## Vault secret names observed in ordering dev

| Vault name | Consumer/purpose |
|---|---|
| razorpay_key_secret:a2_arambol:test | Razorpay test provider credential |
| razorpay_webhook_secret:a2_arambol:test | Razorpay test webhook verification |
| notification-dispatcher-auth | dispatcher inbound authentication |
| notifications-resend-api-key | Resend transactional email |
| telegram_webhook_secret | Telegram webhook request authentication |
| telegram_bot_token | Telegram Bot API |

Only Vault metadata was queried during reconciliation. Decrypted values were not queried.
Vault IDs are intentionally omitted because they are project-specific and are not a
portable secret identity.

## Required follow-up

- Verify the actual Edge Function Secret name set with the Supabase secrets-management
  command or Dashboard, without revealing values.
- Assign an owner and rotation procedure to every provider credential.
- Add secret scanning to CI.
- Keep this file updated when a new secret name is introduced.
