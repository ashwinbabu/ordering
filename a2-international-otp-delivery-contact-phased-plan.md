# Storefront Direct MSG91 OTP and Delivery Contact Plan

**Status:** Approved implementation source of truth

**Scope:** Storefront authentication, international phone support, saved delivery contact, checkout delivery-contact snapshots, and customer order display.

## Architecture contract

The active storefront authentication flow is:

```text
MSG91 widget
→ MSG91 sends and verifies the OTP
→ customer-auth-msg91 verifies the MSG91 access token
→ Supabase session is returned and installed
```

Supabase Auth is the session and identity layer. It is not the OTP provider for this flow.

The active storefront must not use:

- `supabase.auth.signInWithOtp()`;
- `supabase.auth.verifyOtp()` from the browser;
- Supabase phone-provider OTP configuration;
- `send-sms-hook` for storefront authentication;
- an MSG91 SMS template ID for storefront authentication.

The `customer-auth-msg91` Edge Function is active architecture and must not be deprecated in this work. MSG91 request IDs, access tokens, widget verification, and replay semantics remain intentional.

The ownership boundaries are:

- MSG91: OTP generation, delivery, and OTP verification;
- `customer-auth-msg91`: server-side verification of the MSG91 access token, customer linking, and session issuance;
- Supabase Auth: session persistence and authenticated identity;
- saved address: delivery-recipient phone and contact method;
- order snapshot: immutable historical delivery contact.

## Progress log

### 2026-08-21 — Phase 0 completed: live backend synchronization

- Confirmed the working tree is clean on the `bob` branch before implementation.
- Confirmed the live project contains the international delivery-contact migrations and country-aware V2 address RPC overloads.
- Added repository mirrors for:
  - `20260821062458_international_delivery_contact_foundation`;
  - `20260821062538_international_delivery_contact_rpc_reads`;
  - `20260821105502_add_delivery_contact_country_metadata`.
- Mirrored the currently deployed `customer-auth-msg91` implementation into the repository.
- Mirrored `send-sms-hook` for backend consistency only. It remains outside the active storefront authentication path and still has its separate template-based contract.
- Regenerated the storefront and admin Supabase database types from the previously synchronized live schema source.
- Re-ran live type generation with the Supabase CLI and confirmed both generated files match the live output exactly.
- Phase 0 validation passed: storefront typecheck, admin production build, and `git diff --check`.
- Live state verified during this phase:
  - `customer-auth-msg91` is active;
  - `checkout_cart_v2` is present;
  - country-aware V2 address RPC overloads are present;
  - delivery-contact order snapshot columns are present.

### Phase 0 deviation

The repository was behind the live project because the previous work was committed on another branch. The live database was not recreated or modified during synchronization. The repository now records the live feature source before storefront behavior changes begin.

The live `private.normalize_delivery_phone` compatibility helper still accepts legacy ten-digit values by mapping them to `+91`. This is retained as existing backend compatibility behavior; new storefront/domain code must never depend on it or send national-only values.

## Phase 1 — India-only direct MSG91 regression baseline

Use the existing India-only phone UI and prove the complete direct path before adding international behavior:

```text
existing India UI
→ MSG91 widget sendOtp
→ MSG91 widget verifyOtp
→ customer-auth-msg91
→ Supabase session installation
→ customer session hydration
```

Acceptance checks:

- no storefront request reaches `/auth/v1/otp`;
- no browser `signInWithOtp()` or Supabase SMS `verifyOtp()` path exists;
- MSG91 widget configuration is present and live;
- `customer-auth-msg91` verifies the access token server-side;
- replayed access tokens are rejected;
- the authenticated customer row is loaded after session installation;
- India login works before international phone changes.

Record test results and any provider or environment deviation here before continuing.

### 2026-08-21 — Phase 1 live-send checkpoint

- Opened the local storefront account flow using the existing India-only UI.
- Entered the approved Indian test number and confirmed MSG91 accepted the send.
- The UI transitioned to the six-digit MSG91 verification step and displayed the masked number.
- No request to `/auth/v1/otp` was observed in the active storefront path.
- Entered the configured test OTP and completed the direct MSG91 verification flow.
- The account screen loaded with the verified E.164 phone and the authenticated customer data, confirming Supabase session installation and customer hydration.
- Phase 1 India-only direct MSG91 proof is complete on the allowed local origin `http://localhost:5173`.
- Corrected the session-hydration race that could reopen a fresh verification sheet while the newly installed session was still loading its customer row.
- Re-ran the India flow after the fix; the account screen loaded with the verified phone and no duplicate verification sheet remained mounted.

### Phase 1 deviations and follow-up

- A first attempt on local port `5175` could send the OTP but could not post the token exchange because the deployed `customer-auth-msg91` CORS allowlist does not include that port. The same flow succeeded on the already-allowed `5173` origin. This is a local test-origin configuration issue, not an authentication architecture change.
- The verification-sheet reopening issue was caused by the customer-session loading boundary and is now fixed. The post-fix India regression no longer reproduces it.

### 2026-08-21 — Phase 2 completed: shared phone foundation

- Added `libphonenumber-js` to the storefront workspace and lockfile.
- Replaced the India-only phone domain rules with a shared model retaining ISO2 country metadata, calling code, national display value, and canonical E.164.
- Added the shared flag-focused phone field with an app-styled, portaled country list that remains above bottom sheets.
- Implemented the curated country order: India, United Kingdom, Russia, Germany, France, United States, Canada, Australia, Israel, United Arab Emirates, Netherlands, Portugal, and Ireland, with the remaining parser-supported countries behind `Other countries`.
- Updated authentication and customer-session hydration to preserve the selected country metadata.
- Removed the auth-flow fixed ten-digit validation and runtime country-code concatenation.
- Kept the direct MSG91 send, verify, access-token exchange, and Supabase session installation path unchanged.
- Re-ran India through the shared field and completed MSG91 verification successfully.
- Verified parser behavior for India (`9940376914` → `+919940376914`) and the United Kingdom (`07911123456` → `+447911123456`), including the UK's leading national `0` handling.
- Phase 2 validation passed: storefront typecheck, storefront production build, parser checks, and `git diff --check`.

### Phase 2 note

The phone parser can identify Crown Dependency numbering ranges such as Guernsey within the shared `+44` plan. For national-number entry, the customer's selected ISO2 remains authoritative metadata; pasted international E.164 values may resolve to the specific parsed country.

### 2026-08-21 — Phase 2 UI correction

The shared phone field initially kept the old two-column grid while rendering three inline elements: country selector, dial code, and national-number input. The input therefore wrapped below the selector. The phone input grid now allocates three columns so all controls remain on one row.

The dial code is now grouped inside the number-entry area rather than rendered as a separate outer grid cell. The country selector still controls it, while the customer edits only the national-number input.

### 2026-08-21 — Menu product-card layout follow-up

Adjusted only the list-view product-card arrangement so the existing product image and its existing action control stack vertically, with the action control slightly overlapping the image. Existing dimensions, proportions, radii, typography, and control styling were left unchanged.

Aligned image-less list-view cards by giving their action wrapper the same responsive column width as image-bearing cards. This changes only horizontal positioning; button and image dimensions remain unchanged.

## Phase 2 — Shared phone foundation

Create one phone domain model and one shared phone field for authentication and saved addresses.

The model must retain:

- selected ISO2 country;
- selected country dial code;
- national-number display value;
- canonical E.164 value.

The selected country is responsible for **normalizing the entered national number into canonical E.164 using the selected country**. Do not implement this as unconditional string concatenation. National prefixes, including the United Kingdom's leading `0`, must be handled by a proper phone-number parser/validator.

Rules:

- E.164 is authoritative at API and persistence boundaries;
- ISO2 is metadata for display, editing, and prefill;
- no runtime `+91` prepend;
- no fixed ten-digit validation;
- no reconstruction from `defaultCountryCode`;
- country code is controlled by the selector, not editable inside the national-number input;
- pasted international values should be parsed into country plus national display state;
- changing country must revalidate and recalculate E.164.

The closed selector should remain compact and flag-focused. The expanded app-styled list should show flag, country name, and dial code.

Initial country ordering:

1. India;
2. United Kingdom;
3. Russia;
4. Germany;
5. France;
6. United States;
7. Canada;
8. Australia;
9. Israel;
10. United Arab Emirates;
11. Netherlands;
12. Portugal;
13. Ireland.

Prove India again after the shared field replaces the India-only input.

## Phase 3 — International direct MSG91 proof

Test real OTP delivery through the direct architecture using:

- India;
- United Kingdom;
- at least one additional supported international country.

For every test, confirm:

- the widget receives the country-qualified identifier;
- MSG91 sends and verifies the OTP;
- the access token reaches `customer-auth-msg91` only after MSG91 verification;
- the Edge Function resolves the verified phone correctly;
- `core.customers.phone_e164` is canonical E.164;
- Supabase session installation and refresh work;
- the customer profile hydrates correctly.

Do not add a second authentication architecture for international numbers.

## Phase 4 — Saved delivery contact and V2 address RPCs

Keep authentication phone and delivery-recipient phone separate.

Persist on saved addresses:

- `recipient_phone_e164`;
- `recipient_phone_country_iso2`;
- `preferred_contact_method`;
- optional `telegram_username`.

The address form must use:

- `core.create_customer_business_address_v2`;
- `core.update_customer_business_address_v2`.

The legacy address RPCs remain for compatibility and are not removed in this release.

Contact methods:

- `phone`: requires E.164 recipient phone;
- `whatsapp`: requires E.164 recipient phone;
- `telegram`: requires a valid username, stored without `@`.

Editing an address must never update `core.customers.phone_e164`.

## Phase 5 — Pending address and session hydration

Preserve the complete pending address/contact object through:

```text
guest address entry
→ MSG91 OTP
→ customer-auth-msg91
→ Supabase session installation
→ customer hydration
→ address materialization
```

The object must retain E.164, ISO2, contact method, and Telegram username. Do not replace the selected country with the default country during hydration.

Authentication phone may be prefilled from the pending delivery phone, but the two concepts remain distinct.

## Phase 6 — Checkout V2

Only after V2 address create/edit and post-auth materialization are proven:

- switch storefront checkout from `checkout_cart` to `checkout_cart_v2`;
- preserve cart identity and idempotency behavior;
- keep COD and Razorpay behavior intact;
- let the backend snapshot saved-address delivery contact;
- never substitute the authenticated customer phone for the recipient contact.

## Phase 7 — Immutable order-contact reads

Update confirmation, tracking, history, and order details to consume the live backend contracts:

- `get_order.delivery_contact`;
- `list_customer_orders[].deliveryContact`.

Use the order snapshot, not the current saved address. Do not add country ISO2 to order snapshots unless a later product requirement needs the original UI metadata.

## Phase 8 — MSG91 recovery and location fallback

Retain MSG91-specific request state where required:

- widget request identifier;
- resend/retry behavior;
- one-shot access-token exchange;
- replay protection;
- session installation retry without repeating the MSG91 exchange.

After repeated OTP trouble, show a `Call restaurant` / `Call A2` action using `locationPhone` from storefront settings. It must not authenticate, place an order, or clear cart state. Hide it when no location phone exists.

## Phase 9 — Separate admin follow-up

Admin contact actions are outside this release. A later release may extend operator order RPC contracts to expose immutable delivery-contact snapshots and provide phone, WhatsApp, and Telegram actions.

## Validation matrix

### Phone input

- India, UK, and one additional international country;
- pasted E.164;
- national input with a leading national prefix;
- country change and revalidation;
- invalid/short input;
- no accidental leading zero for Indian numbers;
- no default-country reconstruction.

### Authentication

- India real OTP;
- UK real OTP;
- one additional international real OTP;
- wrong code;
- expired code;
- resend;
- provider rejection;
- rate limit;
- replayed MSG91 access token;
- session refresh and reload.

### Delivery and checkout

- address create/edit with all three contact methods;
- guest/pending address through authentication;
- authenticated customer editing another recipient's phone;
- `checkout_cart_v2` only after upstream proof;
- COD and Razorpay;
- duplicate checkout prevention;
- immutable contact snapshot in confirmation/history/tracking.

## Release order

1. Phase 0 repository/live synchronization;
2. Phase 1 India-only direct MSG91 proof;
3. Phase 2 shared phone foundation and India proof;
4. Phase 3 international OTP proof;
5. Phase 4 V2 address contact;
6. Phase 5 pending/session hydration;
7. Phase 6 checkout V2;
8. Phase 7 order snapshots;
9. Phase 8 recovery and Call restaurant;
10. Phase 9 admin follow-up.
