# A2 Storefront — International OTP + Delivery Contact
## Phased Execution Plan for Codex

**Status:** Revised after repository and live Supabase diagnosis. This document is the implementation source of truth. Do not begin implementation until this revised plan has been reviewed and approved.

**Target:** A2 Ordering storefront + `ordering dev` Supabase backend  
**Goal:** Support customers with international phone numbers through the same Supabase + MSG91 SMS OTP flow as Indian customers, while letting customers choose the best way for the restaurant/rider to contact them for delivery: **WhatsApp, Telegram, or Phone call**.

**Important:** Some backend work has already been applied directly to the live `ordering dev` Supabase project. This plan therefore begins with **repository synchronization**, not by recreating the backend from scratch. The current storefront MSG91 browser widget and `customer-auth-msg91` bridge are legacy and must be replaced by Supabase Auth OTP before international OTP UI work begins.

## Plan update log

### 2026-08-21 — Approved corrections incorporated

- Added persisted `recipient_phone_country_iso2` metadata to the saved-address model and V2 RPC contract.
- Kept E.164 authoritative and explicitly excluded a redundant dial-code column.
- Clarified safe handling of existing rows and ambiguous `+1` numbers.
- Removed architectural dependence on a specific Send SMS Hook version; the repository must mirror the currently deployed implementation.
- Split rollout gates into: auth migration and India proof, shared phone foundation and India proof, then international OTP proof.
- Added the rule that future implementation progress and accomplished work must be recorded in this document.

### 2026-08-21 — Implementation progress: repository/backend synchronization

- Regenerated the storefront and admin Supabase TypeScript types from the live `core,ordering` schemas in `ordering dev`.
- Added the repository mirrors for the two already-live international delivery-contact migrations and the live country-metadata follow-up migration (`20260821105502_add_delivery_contact_country_metadata`).
- Preserved the existing V2 address RPCs and recorded the additive country-aware overloads using the live `customer_business_id` contract and UUID return type.
- Mirrored the currently deployed `send-sms-hook` implementation into `supabase/functions/send-sms-hook/index.ts`; the plan does not attach architectural significance to its current deployment version.

### 2026-08-21 — Implementation progress: auth architecture and phone foundation

- Replaced storefront runtime use of the MSG91 browser widget with `supabase.auth.signInWithOtp()` → `send-sms-hook` → `supabase.auth.verifyOtp()`.
- Kept `customer-auth-msg91` and its legacy browser modules in the repository as compatibility/decommissioning follow-up material; they are not used by the new storefront auth path.
- Added the shared `InternationalPhoneField` and `libphonenumber-js`-based E.164 normalization/validation, with selected ISO2 country preserved through the customer and delivery-address domain models.
- Kept India as the default while removing runtime assumptions that prepend `+91` or require ten-digit numbers.

### 2026-08-21 — Implementation progress: delivery contact and checkout/history reads

- Added saved-address contact method and Telegram username handling, including ISO2 metadata persistence and guest/pending-address hydration fields.
- Switched storefront checkout to `checkout_cart_v2`; confirmation, tracking, history, and order details now parse the live `delivery_contact`/`deliveryContact` snapshots.
- Added `locationPhone` to storefront settings and exposed the restaurant-call fallback after repeated OTP trouble.
- Admin contact actions remain outside this release, as required by the plan.

### 2026-08-21 — Validation checkpoint

- Confirmed live Supabase state contains the country metadata column, country-aware V2 address RPC overload, and `checkout_cart_v2`.
- Storefront TypeScript validation and production build pass.
- Admin production build and existing rendered-HTML test pass.
- Real SMS end-to-end verification with one Indian and one international number remains an operational release test; no production OTP was generated during repository validation.

---

# 0. Product outcome

The final experience should feel like one universal checkout.

## Indian customer

```text
Enter +91 number
→ SMS OTP
→ verify
→ choose/store delivery contact preference
→ order
```

## International customer

```text
Select country code
→ enter international number
→ SMS OTP through MSG91
→ verify
→ choose WhatsApp / Telegram / Phone for delivery contact
→ order
```

There must be **no separate “foreign customer” flow**.

The user should never be told that international customers are unusual.

---

# 1. Core product principles

## 1.1 India is the default, not the requirement

New phone fields should default to:

```text
🇮🇳 +91
```

but `+91` must be selectable.

Do not build validation around:

- exactly 10 digits;
- Indian-only prefixes;
- hard-coded `+91`;
- assumptions that every mobile number is Indian.

## 1.2 Authentication phone and delivery contact are different concepts

This distinction must remain explicit throughout the implementation.

### Authentication phone

The phone verified by Supabase Auth.

Stored conceptually as:

```text
core.customers.phone_e164
```

Example:

```text
+919839495843
```

### Delivery contact

How the restaurant/rider should contact the recipient for a particular saved address/order.

Example:

```text
Recipient: Sofia
Phone: +447911123456
Method: WhatsApp
```

A logged-in customer must be able to order for someone else without authenticating that recipient's phone.

## 1.3 International customers should feel welcome

Avoid copy such as:

- “Foreign number”
- “Non-Indian number”
- “International user”
- “Use an Indian number”
- “International numbers may fail”

Prefer neutral copy:

```text
Mobile number
```

```text
Best way to reach you
```

```text
Messaging is usually easiest for delivery updates
and avoids international call charges.
```

## 1.4 OTP failure must never become a dead end

Recovery hierarchy:

1. OTP sent.
2. Countdown.
3. Resend code.
4. Check/change number.
5. Resend again.
6. After repeated trouble, show **Call restaurant / Call A2**.
7. Preserve the cart and checkout state throughout.

Calling the restaurant is **support**, not an authentication bypass.

---

# 2. Current backend state — already implemented in `ordering dev`

The following changes are already live in Supabase.

Codex must treat these as the starting point.

## 2.1 Existing migrations already applied remotely

The database migration history contains:

```text
20260821062458_international_delivery_contact_foundation
20260821062538_international_delivery_contact_rpc_reads
```

These may not yet exist in the local Git repository.

### Codex task

Before writing application code:

- inspect local migrations;
- inspect remote migration history;
- bring the local repo into sync;
- do not blindly create duplicate database changes.

Git should eventually contain the source for every live migration.

---

# 3. Current customer identity model — already international-ready

Table:

```text
core.customers
```

Already contains:

```text
phone_e164
```

with E.164 validation.

Examples already valid:

```text
+919839495843
+447911123456
+4915112345678
```

It is explicitly the verified phone identity used by Supabase Auth.

Also already present:

```text
preferred_contact_phone_e164
preferred_contact_method
```

The global customer contact method currently supports:

```text
phone
whatsapp
```

### Decision for this feature

Do **not** make the customer-level contact preference authoritative.

The saved delivery address is the source of truth for fulfillment contact.

Do not block this implementation on adding Telegram globally to `core.customers`.

---

# 4. Current auth sync trigger — no change needed

Existing trigger/function:

```text
private.sync_customer_from_auth_user()
```

already normalizes Supabase Auth phones to:

```text
+[digits]
```

It has no hard-coded `+91`.

### Codex task

Do not rewrite this function for international OTP support.

Only modify it if repository inspection reveals an unrelated correctness issue.

---

# 5. Saved address schema — already extended remotely

Table:

```text
core.customer_business_addresses
```

Existing legacy field:

```text
recipient_phone
```

New fields already added:

```text
recipient_phone_e164
preferred_contact_method
telegram_username
```

Additional field required by this revised plan and not part of the already-live foundation migrations:

```text
recipient_phone_country_iso2
```

This stores the ISO 3166-1 alpha-2 country selected by the customer, for example:

```text
recipient_phone_e164 = +447911123456
recipient_phone_country_iso2 = GB

recipient_phone_e164 = +14165551234
recipient_phone_country_iso2 = CA
```

`recipient_phone_e164` remains the authoritative phone value. Do not add a redundant country-dial-code column. The ISO2 metadata makes editing, prefilling, and analytics deterministic, especially for shared dialing prefixes such as `+1`.

Existing rows should only be backfilled when the selected country is known or unambiguous. Never infer `US` or `CA` solely from a `+1` E.164 value. The initial rollout may keep this metadata nullable for legacy rows while requiring it for all V2 writes.

## 5.1 Semantics

### `recipient_phone_e164`

Canonical delivery-contact phone.

Examples:

```text
+919839495843
+447911123456
```

### `preferred_contact_method`

Allowed values:

```text
phone
whatsapp
telegram
```

### `telegram_username`

Stored **without** `@`.

Example database value:

```text
viggoa
```

UI:

```text
@viggoa
```

## 5.2 Existing address data is already backfilled

Verified remote state:

```text
Total saved addresses: 28
Valid E.164 addresses: 28
Addresses with contact method: 28
```

Legacy Indian 10-digit numbers were normalized to `+91...`.

Example:

```text
9839495843
→ +919839495843
```

### Codex task

Do not run another naive backfill.

Confirm the local migration source matches the already-applied remote state.

---

# 6. New address RPCs — live, with country metadata extension required

New RPCs:

```text
core.create_customer_business_address_v2(...)
core.update_customer_business_address_v2(...)
```

These accept:

```text
p_recipient_phone_e164
p_recipient_phone_country_iso2
p_preferred_contact_method
p_telegram_username
```

plus the existing address fields.

The existing ownership/security checks remain.

The implementation must add `p_recipient_phone_country_iso2` to both V2 RPC signatures and persist it with the address. This is an additive feature migration; do not recreate or replace the already-live V2 RPCs.

### Legacy RPCs still exist

```text
core.create_customer_business_address(...)
core.update_customer_business_address(...)
```

These remain for backward compatibility.

### Codex task

The new storefront should switch to the V2 RPCs.

Do not remove the old RPCs during the first rollout.

---

# 7. Order schema — already extended remotely

Table:

```text
ordering.orders
```

New fields already added:

```text
delivery_contact_phone_snapshot
delivery_contact_method_snapshot
delivery_contact_telegram_username_snapshot
```

These are immutable fulfillment snapshots.

They are intentionally separate from:

```text
customer_phone_snapshot
```

## 7.1 Meaning of the two phone concepts

Example:

```text
Authenticated customer:
+919839495843

Delivery recipient:
+447911123456

Preferred method:
WhatsApp
```

The order can correctly contain:

```text
customer_phone_snapshot
= +919839495843
```

and:

```text
delivery_contact_phone_snapshot
= +447911123456
```

## 7.2 Existing delivery orders already backfilled

Verified:

```text
Delivery orders: 27
With delivery phone snapshot: 27
With delivery method snapshot: 27
```

### Codex task

Do not modify historical values merely to make them look like new WhatsApp/Telegram orders.

Historical snapshots should remain historically accurate.

Do not add the selected country ISO2 to the order snapshot in this feature. The immutable E.164 delivery phone is sufficient for order history and admin fulfillment unless a later product requirement needs the original UI metadata.

---

# 8. Checkout V2 — already live

New RPC:

```text
ordering.checkout_cart_v2(...)
```

This exists so the new storefront can move onto the delivery-contact model without rewriting the existing checkout path.

The original:

```text
ordering.checkout_cart(...)
```

still exists for backward compatibility.

### Why this matters

The old checkout historically sourced the contact phone from the customer profile.

The new flow needs delivery-contact information from the selected delivery address.

### Codex task

After the new address UI is wired and tested:

```text
switch storefront checkout
from checkout_cart
to checkout_cart_v2
```

Do not switch early before address V2 data is reliably being written.

---

# 9. Order read RPCs — already extended remotely

The live backend has already been updated so contact information can be read from customer-facing order APIs.

Relevant RPCs include:

```text
ordering.get_order(...)
ordering.list_customer_orders(...)
```

The new frontend should consume the delivery-contact fields/snapshot returned by these APIs.

### Codex task

Inspect the exact live JSON contract and update frontend parsers/types accordingly.

Do not invent a parallel client-only shape if the backend already exposes one.

---

# 10. Storefront location phone — already exposed remotely

Existing RPC:

```text
ordering.get_storefront_settings(...)
```

now returns:

```text
locationPhone
```

For A2 Arambol the live value is configured.

The Morjim location currently has no phone configured.

### Required frontend behavior

```text
locationPhone exists
→ show Call restaurant / Call A2 recovery action

locationPhone is null
→ do not render a broken call action
```

Never hard-code A2's phone in React.

---

# 11. SMS Edge Function — already upgraded remotely

Active Edge Function:

```text
send-sms-hook
```

Current deployed version:

```text
v4
```

At the time this plan was written, the deployed implementation was version v4. The version number is not architecturally significant; future work must mirror whichever implementation is currently deployed.

This function is the Supabase Auth Send SMS Hook.

Its purpose is:

```text
Supabase generates OTP
→ Send SMS Hook receives OTP + phone
→ MSG91 delivers SMS
```

It is not the authentication authority.

Supabase still owns:

- OTP generation;
- OTP verification;
- authenticated session.

## 11.1 International phone behavior already supported

The hook accepts canonical E.164 phone values such as:

```text
+919839495843
+447911123456
+4915112345678
```

It passes MSG91 a country-code-qualified destination.

There is no deliberate `+91` hard-code in the active path.

## 11.2 E.164 validation has already been hardened

The deployed hook now rejects malformed phone destinations before calling MSG91.

### Codex task

Mirror the currently deployed `send-sms-hook` implementation into the repository. At the time of this plan, that implementation was version v4.

Do not overwrite the deployed version with an older local copy.

## 11.3 Provider diagnostics already improved

MSG91 failures are now classified/logged more cleanly.

### Codex task

Keep user-facing errors generic and safe.

Do not expose:

- MSG91 raw payloads;
- credentials;
- internal provider response details.

---

# 12. Legacy `customer-auth-msg91` Edge Function

Remote function still exists:

```text
customer-auth-msg91
```

This belongs to the older MSG91-widget-based auth bridge.

The new intended flow is:

```text
supabase.auth.signInWithOtp()
→ send-sms-hook
→ MSG91
→ supabase.auth.verifyOtp()
```

### Codex task

Treat the current storefront usage as legacy. The storefront currently calls this function through the MSG91 widget path, so it must first migrate to the Supabase Auth flow described above.

After the new Supabase Auth OTP flow is proven end-to-end:

- leave `customer-auth-msg91` deployed and untouched;
- mark it as a later deprecation candidate;
- do not delete it or remove its backend migration in this feature.

Do not run both authentication architectures in production for the same storefront flow.

---

# 13. Remaining external dependency — real international SMS delivery

The backend architecture is international-capable.

The remaining external unknown is whether the current MSG91 account/template/routing will successfully deliver OTPs to every destination country we care about.

### Before completing the rollout

Test at least one real international number.

Ideal smoke test:

```text
UK +44 number
→ Supabase signInWithOtp
→ send-sms-hook
→ MSG91 accepts request
→ SMS arrives
→ Supabase verifyOtp
→ session created
→ core.customers.phone_e164 stores +44...
```

If MSG91 requires a different template/route for international SMS, isolate the provider-specific change inside the Send SMS Hook.

Do not create a separate authentication architecture.

---

# PHASE 0 — Synchronize the repository with the live backend

## Goal

Prevent Codex from accidentally overwriting working remote backend changes with stale local files.

## Tasks

- [ ] Inspect local Supabase migrations.
- [ ] Inspect remote migration list.
- [ ] Confirm whether these files exist locally:
  - `20260821062458_international_delivery_contact_foundation.sql`
  - `20260821062538_international_delivery_contact_rpc_reads.sql`
- [ ] If missing, recreate/mirror the live schema changes in local migration source.
- [ ] Inspect local `supabase/functions/send-sms-hook`.
- [ ] Compare it with the currently deployed `send-sms-hook` implementation.
- [ ] Update local function source to match the currently deployed implementation.
- [ ] Confirm local source does not contain an older implementation.
- [ ] Regenerate Supabase TypeScript types after local schema synchronization.
- [ ] Regenerate and verify types for both `apps/storefront` and `apps/admin`.
- [ ] Commit this synchronization separately before changing storefront behavior.

## Important

Do not solve migration drift by dropping/recreating live columns.

The live DB is already correct.

This phase is about making the **repo catch up to Supabase**.

---

# PHASE 1 — Replace legacy storefront authentication and audit phone assumptions

## Goal

Move the storefront onto the already-deployed Supabase Auth Send SMS Hook path before adding international OTP UI, then find every place that assumes an Indian number.

## Authentication migration prerequisite

Replace the current browser MSG91 widget and `customer-auth-msg91` calls with:

```text
supabase.auth.signInWithOtp({ phone: phoneE164 })
→ send-sms-hook
→ MSG91
→ supabase.auth.verifyOtp({ phone: phoneE164, token, type: "sms" })
```

Supabase Auth must own OTP generation, verification, and session creation. Do not carry forward MSG91 request IDs, MSG91 access tokens, browser-side provider verification, or the custom session exchange.

The existing `customer-auth-msg91` Edge Function remains deployed and untouched until this new path has passed the full Indian and international end-to-end tests.

## Search for

- [ ] literal `+91`
- [ ] 10-digit regexes
- [ ] `.slice(-10)`
- [ ] manually prepending `91`
- [ ] manually stripping country codes
- [ ] Indian-only placeholders
- [ ] phone masks built specifically for 10 digits
- [ ] auth helper functions that accept only national numbers
- [ ] address form phone handling
- [ ] checkout phone handling
- [ ] account login phone handling
- [ ] OTP display/masking logic

## Deliverables

- Create a short implementation note listing all files/assumptions found.
- Confirm all auth surfaces use the shared Supabase Auth phone flow.
- Confirm no storefront runtime path calls the MSG91 widget or `customer-auth-msg91`.

Do not modify unrelated code during the audit.

---

# PHASE 2 — Build one shared InternationalPhoneField

## Goal

Use one phone component everywhere rather than implementing international behavior independently on each screen.

## Suggested behavior

Default:

```text
Mobile number

[ 🇮🇳 +91 ▾ ] [ 98394 95843 ]
```

International:

```text
Mobile number

[ 🇬🇧 +44 ▾ ] [ 7911 123456 ]
```

## Requirements

- [ ] India default.
- [ ] Country selector.
- [ ] Search by country name.
- [ ] Search by dial code.
- [ ] Support pasted `+44...` values.
- [ ] Normalize output to E.164.
- [ ] Expose both the canonical E.164 value and the selected country/national display state needed to edit and display the number correctly.
- [ ] Use a proper phone library such as `libphonenumber-js` if no equivalent exists.
- [ ] Revalidate on country change.
- [ ] Do not use `number.length === 10`.
- [ ] Correct mobile keyboard.
- [ ] Preserve accessibility labels.
- [ ] Avoid horizontal overflow on narrow screens.

## Test countries

At minimum:

```text
India +91
United Kingdom +44
United States +1
Germany +49
Israel +972
Australia +61
```

---

# PHASE 3 — Update Add/Edit Address UX and switch to V2 RPCs

## Goal

Make saved delivery contact the authoritative fulfillment contact.

The frontend/domain model must preserve:

- canonical `recipientPhoneE164`;
- selected `recipientPhoneCountryIso2` for display/editing;
- `preferredContactMethod`;
- optional `telegramUsername`.

Do not store only national digits and reconstruct the country later from `defaultCountryCode`.

## New layout

```text
Name
[ Vig                              ]

Mobile number
[ 🇮🇳 +91 ▾ ][ 98394 95843         ]

Best way to reach you
[ WhatsApp ] [ Phone call ] [ Telegram ]

Messaging is usually easiest for delivery updates
and avoids international call charges.
```

## Contact method behavior

### WhatsApp

Require:

```text
recipient_phone_e164
```

### Phone

Require:

```text
recipient_phone_e164
```

### Telegram

Reveal:

```text
Telegram username
@ [ viggoa ]
```

Store:

```text
viggoa
```

not:

```text
@viggoa
```

## Backend wiring

Add the persisted `recipient_phone_country_iso2` column and extend the V2 address migration/RPC contracts with:

```text
p_recipient_phone_e164
p_recipient_phone_country_iso2
p_preferred_contact_method
p_telegram_username
```

Validate the ISO2 value against the selected/parsed phone country at the application boundary, and retain database validation for the canonical E.164 value. The country ISO2 is metadata; it must not replace or override E.164.

Switch:

```text
create_customer_business_address
→ create_customer_business_address_v2
```

and:

```text
update_customer_business_address
→ update_customer_business_address_v2
```

## Critical rule

Editing the delivery phone must **not** update:

```text
core.customers.phone_e164
```

Guest/pending addresses must retain all of this E.164/contact data through OTP, session hydration, address materialization, and checkout.

---

# PHASE 4 — Prefill auth phone intelligently

## Goal

Avoid asking a first-time customer to type the same phone twice.

Scenario:

```text
Guest enters delivery phone:
+447911123456
```

Then taps Place order.

The auth sheet should open already populated with:

```text
🇬🇧 +44 | 7911 123456
```

The customer should only need to tap:

```text
Continue
```

## Rules

- [ ] Preserve selected country.
- [ ] Preserve normalized E.164.
- [ ] Do not reset to +91.
- [ ] If user is already authenticated, do not show OTP.
- [ ] Do not OTP a different recipient phone for a logged-in customer.
- [ ] Pass the complete E.164 value into Supabase Auth; never rebuild it from a national number plus `defaultCountryCode`.

---

# PHASE 5 — Internationalize all login phone sheets

## Relevant surfaces

At minimum:

### Checkout

```text
CHECKOUT
Welcome
Enter your phone number to continue.
```

### Account/details

```text
YOUR DETAILS
Welcome
Enter your phone number to view your orders and saved details.
```

Both should use the shared InternationalPhoneField.

Do not build separate auth components.

---

# PHASE 6 — Verify the Supabase + MSG91 international OTP path

## Goal

Prove the external dependency before relying on international login in production.

## Test

Use a real international phone.

Perform:

```text
signInWithOtp()
→ Send SMS Hook
→ MSG91
→ receive SMS
→ verifyOtp()
→ Supabase session
```

## Confirm

- [ ] full E.164 reaches Supabase;
- [ ] full country code reaches MSG91;
- [ ] OTP arrives;
- [ ] verify succeeds;
- [ ] session persists;
- [ ] customer row contains international `phone_e164`;
- [ ] returning user does not need OTP again unnecessarily.

If provider routing fails, modify only provider-delivery logic.

Do not invent:

```text
if India → Supabase
else → custom auth
```

---

# PHASE 7 — Build the OTP retry/recovery state machine

## Goal

Prevent checkout abandonment when SMS delivery is slow or fails.

## States

Adapt this state machine to Supabase Auth semantics. Do not model MSG91 request IDs, MSG91 access tokens, one-shot widget tokens, or custom token-exchange states. A resend creates a new Supabase Auth OTP attempt; verification uses the current phone and OTP token.

Implement explicit states such as:

```text
sending
sent_waiting
resend_available
verifying
verified
send_failed
rate_limited
expired
```

Avoid a collection of unrelated booleans if possible.

## Initial state

```text
One last step

We sent a 6-digit code to
+44 79••• ••456

[ OTP inputs ]

Didn't get the code? Resend in 20s

Change phone number
```

## First resend

After timer:

```text
Resend code
```

After first resend:

```text
Still waiting for the code?

Check that +44 7911 123456 is correct.

[ Change phone number ]
```

## Repeated trouble

After initial send + one resend without verification, show:

```text
Still not getting the code?

Call A2 and we'll help you complete your order.

[ Call A2 ]
```

Continue to allow resend when allowed.

Do not replace resend with call support.

---

# PHASE 8 — Implement “Call restaurant” fallback

## Backend dependency already ready

Use:

```text
get_storefront_settings().locationPhone
```

Add `locationPhone` to the storefront settings domain model and parser before rendering this action.

Do not hard-code A2's number.

## Action

```text
tel:<locationPhone>
```

## Behavior

Calling the restaurant must not:

- authenticate the customer;
- mark OTP verified;
- place an order;
- create a fake order;
- clear the cart.

## State preservation

After returning from the phone app/browser switch:

- cart remains;
- address remains;
- payment method remains;
- OTP sheet remains recoverable.

## Null location phone

If:

```text
locationPhone = null
```

do not show a broken Call button.

---

# PHASE 9 — Update cart contact summary

## Goal

Before Place order, show the customer that A2 knows how to contact the recipient.

Recommended card:

```text
Hotel · Default                         Change

sdvvsd, Mandrem, North Goa

WhatsApp · +44 7911 ••••56
Edit
```

or:

```text
Telegram · @viggoa
```

Do not add a large new standalone checkout section.

Keep contact information part of the delivery-address card.

---

# PHASE 10 — Update Saved Addresses and address picker

## Address cards

Prefer:

```text
Hotel · Default

Vig
sdvvsd
Mandrem, North Goa

WhatsApp · +44 7911 123456
```

instead of raw unlabeled phone numbers.

Read and display the stored E.164/contact fields. Do not derive the country from the current authenticated customer phone.

## Legacy rows

All current DB rows already have contact-method/E.164 backfill.

Still keep frontend parsing defensive.

---

# PHASE 11 — Switch checkout to `checkout_cart_v2`

## Prerequisite

Do this only after:

- address V2 create works;
- address V2 edit works;
- contact method is consistently stored;
- new E.164 phone is consistently stored.
- guest/pending address state survives authentication and session hydration with the same E.164/contact values.

## Change

```text
ordering.checkout_cart
```

→

```text
ordering.checkout_cart_v2
```

The checkout request must pass the saved address identity and let the backend populate immutable delivery-contact snapshots. Do not use the authenticated customer phone as a substitute for the saved delivery contact.

## Regression areas

Retest carefully:

- cart attachment after OTP;
- session hydration;
- COD;
- Razorpay online payment;
- duplicate order prevention;
- 42501 cart access errors;
- converted cart behavior.

This project has already had checkout identity race-condition fixes.

Do not regress them.

---

# PHASE 12 — Consume immutable delivery-contact order snapshots

## Surfaces

Update:

- order confirmation;
- order tracking;
- order detail;
- order history.

Read the order snapshot, not the current address.

Parse the backend’s existing contracts directly:

- `get_order.delivery_contact`;
- `list_customer_orders[].deliveryContact`.

Do not invent a parallel client-only contact shape or fall back to the current saved address for historical orders.

## Example

```text
Delivery contact
WhatsApp · +44 7911 ••••56
```

or:

```text
Delivery contact
Telegram · @viggoa
```

If the user edits their saved address tomorrow, yesterday's order must not change.

---

# PHASE 13 — Clarify Account phone semantics

## Current issue

The Account screen saying:

```text
Phone number
```

can imply that it controls rider contact.

## Change label

Prefer:

```text
Verified phone number
```

Supporting copy:

```text
This number is used to securely access your account.
```

Delivery contact remains under saved addresses.

Do not turn Account into a global delivery-contact settings screen in this phase.

---

# PHASE 14 — Update admin/staff order contract

This is a separate follow-up release after the storefront rollout. It should use the same immutable order snapshots.

Eventually staff should see:

## WhatsApp

```text
Vig
+44 7911 123456

Preferred contact: WhatsApp

[ Message on WhatsApp ]
```

## Telegram

```text
Vig
@viggoa

Preferred contact: Telegram

[ Open Telegram ]
```

## Phone

```text
Vig
+91 98394 95843

Preferred contact: Phone

[ Call customer ]
```

### Backend task

Update operator order list/detail RPC responses if the new contact snapshots are not yet returned there.

Likely candidates:

```text
ordering.list_orders(...)
ordering.list_orders_for_location(...)
```

Do this without changing the storefront release path if admin work is scheduled separately.

The current operator order RPC responses do not yet expose the same delivery-contact object as the customer-facing order RPCs, so extending `ordering.list_orders(...)` and `ordering.list_orders_for_location(...)` is required for this release.

---

# PHASE 15 — Analytics and diagnostics

## Goal

Know whether international OTP is harming conversion.

Existing analytics already includes:

```text
otp_failed
```

Useful metadata:

```json
{
  "schema_version": 1,
  "phone_country": "GB",
  "is_international": true,
  "stage": "send",
  "attempt_number": 2,
  "error_category": "provider_send_failed"
}
```

Never store:

- OTP;
- full phone number;
- provider secret.

## Useful metrics

Track:

- OTP request country;
- verification success;
- resend rate;
- send failure;
- expiry;
- wrong-code rate;
- Call restaurant fallback exposure;
- Call restaurant click;
- checkout abandonment at OTP;
- checkout completion after resend.

Do not block release on perfect analytics taxonomy.

---

# PHASE 16 — Test matrix

## Phone input

| Scenario | Expected |
|---|---|
| +91 Indian number | Valid |
| +44 UK number | Valid |
| +1 US number | Valid |
| +49 Germany | Valid |
| +972 Israel | Valid |
| +61 Australia | Valid |
| Invalid short number | Error |
| Change country after entry | Revalidate |
| Paste E.164 | Parse correctly |
| +44 selected + Indian-format digits | Do not silently assume India |

## Delivery contact

| Method | Validation |
|---|---|
| WhatsApp | E.164 phone required |
| Phone | E.164 phone required |
| Telegram | Telegram username required |
| `@viggoa` input | Normalize to `viggoa` |
| Telegram → WhatsApp | Telegram field becomes inactive |

## Auth

Test:

- Indian OTP;
- real international OTP;
- wrong OTP;
- expired OTP;
- resend;
- provider rejection;
- rate limit.

## Checkout persistence

Critical regression flow:

```text
Guest
→ cart
→ international address
→ Place order
→ OTP
→ resend
→ change number
→ verify
→ session hydration
→ cart remains
→ checkout
→ order exactly once
```

## Returning customer

```text
session restored
→ no OTP
→ saved international address works
→ different delivery phone allowed
→ auth identity unchanged
```

## Call restaurant

Test:

- recovery threshold;
- correct locationPhone;
- `tel:` link;
- return to browser;
- checkout state intact;
- null phone hides CTA.

---

# PHASE 17 — Rollout order

## Release 1 — Repository/backend synchronization

No customer-visible behavior.

Ship:

- remote migrations mirrored locally;
- currently deployed `send-sms-hook` implementation mirrored locally;
- generated types updated.

Regenerate and verify both storefront and admin Supabase types.

## Release 2 — Migrate authentication architecture

Ship only the replacement of the legacy MSG91 browser widget/custom exchange with Supabase Auth OTP.

Prove the existing India-only `+91` login flow works exactly as before:

```text
existing India-only UI
→ signInWithOtp
→ send-sms-hook
→ MSG91
→ verifyOtp
→ session/customer hydration
```

If this release fails, diagnose the authentication migration before adding international phone behavior.

## Release 3 — Shared international phone foundation

Ship the shared phone/domain foundation while preserving the current India-first UI.

Prove `+91` again after the phone component and E.164/domain changes land.

## Release 4 — Address contact preference

Ship:

- V2 address RPC usage;
- E.164 storage;
- selected country ISO2 metadata;
- WhatsApp/Telegram/Phone preference.

## Release 5 — OTP international UI + recovery

Ship:

- Supabase Auth OTP flow using `signInWithOtp` and `verifyOtp`;
- international phone auth sheets;
- resend state machine;
- Call restaurant fallback.

Then prove `+44` and at least one additional international test country end-to-end.

## Release 6 — Checkout V2

Switch to:

```text
checkout_cart_v2
```

after upstream data is proven.

## Release 7 — Order snapshot UI

Ship contact details on:

- confirmation;
- tracking;
- history/details.

## Release 8 — Staff/admin contact actions

Use immutable order contact snapshots.

---

# 18. Explicit non-goals

Do not include in this project unless required to unblock it:

- Google SSO;
- Telegram login;
- Telegram OTP;
- WhatsApp OTP;
- custom auth for non-Indian users;
- international delivery addresses outside the restaurant service area;
- automatic WhatsApp detection;
- Telegram lookup by phone number;
- staff bypass of Supabase Auth;
- major cart redesign;
- payment architecture redesign.

---

# 19. Definition of done

The project is complete when:

- [ ] Repo accurately mirrors live Supabase migrations.
- [ ] Repo contains the currently deployed `send-sms-hook` implementation.
- [ ] Storefront authentication uses Supabase Auth OTP; the browser MSG91 widget is no longer on the runtime path.
- [ ] `customer-auth-msg91` remains deployed and untouched until end-to-end proof is complete.
- [ ] Both storefront and admin generated Supabase types are synchronized.
- [ ] No storefront flow assumes all numbers are Indian.
- [ ] India remains the convenient default.
- [ ] International phone values are canonical E.164.
- [ ] Saved addresses persist the selected `recipient_phone_country_iso2` metadata.
- [ ] Frontend/domain state preserves country information needed for display and editing.
- [ ] First-time international customers receive Supabase OTP through MSG91.
- [ ] Supabase session is created normally after verification.
- [ ] Returning users do not unnecessarily OTP again.
- [ ] Saved addresses own fulfillment contact preferences.
- [ ] WhatsApp / Telegram / Phone are supported.
- [ ] Telegram username is stored separately.
- [ ] Auth phone is never overwritten by a delivery-recipient phone.
- [ ] Address UI uses V2 RPCs.
- [ ] Checkout uses `checkout_cart_v2`.
- [ ] Orders preserve immutable contact snapshots.
- [ ] Cart shows the selected contact method before order placement.
- [ ] Order confirmation/tracking/history show the order snapshot.
- [ ] Repeated OTP trouble exposes resend, change-number, and Call A2.
- [ ] Call A2 uses location settings and is not an auth bypass.
- [ ] Cart and checkout state survive OTP recovery.
- [ ] Guest/pending address contact data survives OTP and session hydration.
- [ ] Real +91 OTP is tested.
- [ ] At least one real international OTP is tested.
- [ ] COD still works.
- [ ] Razorpay still works.
- [ ] Realtime order tracking still works.
- [ ] No cart/session hydration regression is introduced.

---

# 20. Final customer experience

A tourist in Goa should experience:

```text
Mobile number
[ 🇬🇧 +44 ▾ ] [ 7911 123456 ]

Best way to reach you
[ WhatsApp ] [ Phone call ] [ Telegram ]
```

Then:

```text
One last step

We sent a 6-digit code to
+44 79••• ••456
```

If delivery is delayed:

```text
Still waiting for the code?

[ Resend code ]
[ Change phone number ]
```

After repeated trouble:

```text
Still not getting the code?

Call A2 and we'll help you complete your order.

[ Call A2 ]
```

The implementation should make this feel like a normal A2 checkout—not a special accommodation for an international customer.

---

# 21. Pre-implementation review checkpoint

Before writing application or database code, review this revised plan against:

- the current storefront auth implementation;
- the local migration and Edge Function source state;
- the live `ordering dev` migration/function/RPC contracts;
- the generated storefront and admin database types;
- the current checkout/session/cart hydration path.

Do not begin implementation until this checkpoint confirms that the execution order still matches the repository and live Supabase state.
