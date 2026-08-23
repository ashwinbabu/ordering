# Migration equivalence map

Compared local migration filenames with the remote applied migration inventory on 2026-08-23.
This is a filename/name heuristic only; it is not proof that the SQL bodies are equivalent.

## Same version and name

24 remote migrations have an exact matching local filename.

## Same descriptive suffix, different version

The following 13 pairs may represent the same migration renamed or re-timestamped:

| Remote applied filename | Local filename | Required proof |
|---|---|---|
| 20260816124517_business_logo | 20260816120000_business_logo | SQL/schema comparison |
| 20260816124610_storefront_menu_logo | 20260816120100_storefront_menu_logo | SQL/schema comparison |
| 20260816130020_orders_queue_date_range_filter | 20260816140000_orders_queue_date_range_filter | SQL/schema comparison |
| 20260816185859_orders_queue_operator_statuses_only | 20260817200000_orders_queue_operator_statuses_only | SQL/schema comparison |
| 20260817095256_backfill_order_realtime_broadcast | 20260817210000_backfill_order_realtime_broadcast | SQL/schema comparison |
| 20260818174926_payment_provider_resolver_and_webhook_config | 20260818180000_payment_provider_resolver_and_webhook_config | SQL/schema comparison |
| 20260818180255_seed_a2_arambol_razorpay_provider_pending | 20260818181000_seed_a2_arambol_razorpay_provider_pending | SQL/schema/data review |
| 20260820115312_notifications_domain | 20260820070000_notifications_domain | SQL/schema review |
| 20260820121827_notifications_dispatcher_cron | 20260820073000_notifications_dispatcher_cron | SQL/cron review |
| 20260821065201_notifications_telegram_domain | 20260821060000_notifications_telegram_domain | SQL/schema review |
| 20260821065957_notifications_telegram_webhook_dedup | 20260821063000_notifications_telegram_webhook_dedup | SQL/schema review |
| 20260821071801_notifications_telegram_connection_status_bot_username | 20260821064500_notifications_telegram_connection_status_bot_username | SQL/schema review |
| 20260821085405_notifications_matrix_expansion | 20260821090000_notifications_matrix_expansion | SQL/schema review |

## Remote-only with no same-name local file

20 remote migration names have no matching local suffix. Their SQL bodies are not present
in any fetched Git branch and must be recovered from a reviewed schema diff or another
historical source before Git can claim clean-environment reproducibility.

These include storefront context/customer contact, checkout payment-method, customer
order/realtime broadcast, location payment routing, provider-auth, temporary storage access,
and order-alert-duration changes.

## Decision

Do not duplicate or rename the 13 probable equivalents yet. Keep both the applied remote
filename and local filename in this map until SQL effects are verified.
