# Deployed function snapshots

These files are read-only recovery snapshots retrieved from the `ordering dev` project on 2026-08-23.
They are not deployed by the application and must not be imported as runtime source.

The snapshots preserve the currently deployed packages for tracked functions whose deployed
entrypoints differ from Git. They exist so the deployed implementation can be reviewed before
deciding whether Git should adopt it, retain the checked-in version, or retire the function.

Functions included:

- send-sms-hook (deployed version 5)
- start-online-payment (deployed version 3)
- verify-online-payment (deployed version 2)
- razorpay-webhook (deployed version 2)
- notification-dispatcher (deployed version 5)

Do not delete these snapshots until each function has an explicit reconciliation decision.
