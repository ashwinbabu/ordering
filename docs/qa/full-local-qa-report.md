# A2 Ordering — Full Local QA Report

**Run date:** 22 August 2026  
**Scope:** Local Admin, Storefront, Supabase development backend, Realtime, COD, Razorpay Test Mode, persistence, and focused security review  
**Rule followed:** Product defects were investigated and reported, not fixed. Only reusable QA infrastructure was added.

## 1. Executive summary

| Item                   | Result                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Branch                 | `bob`                                                                                   |
| Commit tested          | `8e372eb8aae7eadee171c939ae040fd67a02c3d6`                                              |
| Overall confidence     | Moderate in COD delivery and realtime; low for release as a complete restaurant product |
| Release recommendation | **DO NOT RELEASE**                                                                      |
| Scored scenarios       | **82**                                                                                  |
| PASS                   | **70**                                                                                  |
| FAIL                   | **6**                                                                                   |
| PARTIAL                | **4**                                                                                   |
| BLOCKED                | **2**                                                                                   |
| P0 / P1 / P2 / P3 bugs | **0 / 5 / 8 / 2**                                                                       |

The delivery COD golden path, database totals, cross-app live order arrival, bidirectional lifecycle updates, cancellation, reconnect convergence, cart persistence, addresses, and customer/order RLS all worked. The largest release risks are a broken Pickup checkout, personal details that claim to save but do not persist, incorrect vegetarian labels on meat/egg/seafood products, missing product-image upload, and hardcoded Admin operational information. Razorpay provider-order creation and modal cancellation worked in Test Mode, but successful/failed provider payments and webhook replay remain blocked by the external provider interaction.

No production deployment or real payment occurred. Notifications were set to `off` before order mutations and restored after testing to email `redirect` / Telegram `live`. Arambol ordering was restored and verified `ON`.

## 2. Environment

| Item                | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| OS                  | macOS 14.6.1, arm64                                                      |
| Project Node        | 24.19.0 (`.nvmrc`)                                                       |
| npm                 | 11.17.0                                                                  |
| Playwright          | 1.62.1                                                                   |
| Chromium            | 151 (Playwright)                                                         |
| WebKit              | Playwright v2251; unusable on this macOS host (see blocked coverage)     |
| Storefront          | `http://localhost:5173`                                                  |
| Admin               | `http://localhost:5174`                                                  |
| Supabase project    | `ordering dev` (`qzdpohytpvjkidxgvzkd`, `ap-south-1`, PostgreSQL 17.6.1) |
| Razorpay            | Test Mode; provider reported ready                                       |
| Admin QA account    | `ashwinbabu007@gmail.com` (password redacted)                            |
| Customer QA account | `+919940376914` (OTP redacted)                                           |
| A2 business ID      | `71667212-8437-4a40-a6fa-de869ca8f1b5`                                   |
| Arambol location ID | `23ca53d8-5e39-42af-acfb-b2e5c50b3c8b`                                   |

The Admin session, Storefront RPC context, and created orders were independently verified against the same business and Arambol location IDs. Both apps ran concurrently on their required ports with Node 24.19.0.

## 3. Repository checks

| Check                   | Command                                    | Result  | Notes                                                                                                     |
| ----------------------- | ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------- |
| Dependencies            | `npm ls --depth=0`                         | PASS    | Dependency tree resolved.                                                                                 |
| Format                  | `npm run format`                           | FAIL    | 37 pre-existing files require formatting. QA files were formatted during the run.                         |
| Lint                    | `npm run lint`                             | FAIL    | 10 errors and 12 warnings, including hook/ref issues and Deno notification files.                         |
| Storefront typecheck    | Storefront configured TypeScript check     | PASS    | No Storefront TypeScript error.                                                                           |
| Admin unit test         | `node --test tests/rendered-html.test.mjs` | PASS    | Existing rendered HTML test passed.                                                                       |
| Storefront build        | `npm run build --workspace @a2/storefront` | PASS    | 757 kB chunk-size warning.                                                                                |
| Admin build             | `npm run build --workspace @a2/admin`      | PASS    | Production workspace build succeeded.                                                                     |
| Root build              | `npm run build`                            | FAIL    | Exit 69: root verifier requires GNU `timeout`, unavailable on stock macOS; both workspace builds pass.    |
| Existing DB tests       | Repository inspection                      | BLOCKED | No pgTAP suite and no installed Supabase CLI/Deno runtime. Focused live SQL/RLS checks were used instead. |
| E2E inventory           | `playwright test --list`                   | PASS    | 48 executable cases in 16 files after fixing QA project selection.                                        |
| Main Chromium E2E       | Targeted Playwright runs                   | MIXED   | Results are scored below; retained-on-failure trace/video/screenshot configured.                          |
| Storefront WebKit smoke | `--project=storefront-webkit`              | BLOCKED | Frozen WebKit/macOS protocol mismatch: `Page.overrideSetting: Unknown setting: PushAPIEnabled`.           |

The repository is an npm workspaces monorepo with `apps/storefront`, `apps/admin`, and `supabase` migrations/functions. Supabase Auth, tenant/location-scoped RPCs, Realtime broadcasts, notification Edge Functions, and Razorpay server-side order/verification/webhook boundaries were inspected before execution.

## 4. Full test matrix

### Admin menu

| Test ID      | Area       | Test                             | Status | DB Verified | Notes                                                                          |
| ------------ | ---------- | -------------------------------- | ------ | ----------- | ------------------------------------------------------------------------------ |
| ADM-CAT-001  | Categories | Add category                     | PASS   | Yes         | New ID, A2 ownership, sort order, and refresh persistence verified.            |
| ADM-CAT-002  | Categories | Rename category                  | PASS   | Yes         | Name changed on same row/ID.                                                   |
| ADM-CAT-003  | Categories | Duplicate category               | PASS   | Yes         | Independent ID; current behavior copies the category shell/name, not products. |
| ADM-CAT-004  | Categories | Availability                     | PASS   | Yes         | Seven 10:15–18:45 daily windows persisted.                                     |
| ADM-CAT-005  | Categories | Delete saved empty category      | FAIL   | Yes         | Delete control disabled for saved rows.                                        |
| ADM-CAT-006  | Categories | Rearrange                        | PASS   | Yes         | Sort order persisted and Storefront followed it.                               |
| ADM-PROD-001 | Products   | Veg product, no image            | PASS   | Yes         | Type, price, category, no-image state, Storefront verified.                    |
| ADM-PROD-002 | Products   | Non-Veg product, no image        | PASS   | Yes         | Type and Storefront marker verified.                                           |
| ADM-PROD-003 | Products   | Egg product, no image            | PASS   | Yes         | Type and Storefront marker verified.                                           |
| ADM-PROD-004 | Products   | Product with deterministic image | FAIL   | No mutation | Upload is explicitly disabled.                                                 |
| ADM-PROD-005 | Products   | Featured product                 | PASS   | Yes         | Featured flag and A2 favourites placement verified.                            |
| ADM-PROD-006 | Products   | Product group                    | PASS   | Yes         | Group relation and Storefront configurator verified.                           |
| ADM-PROD-007 | Products   | Group and priced options         | PASS   | Yes         | Small +₹10 / Large +₹40 and cart price effect verified.                        |
| ADM-PROD-008 | Products   | Restaurant-hours availability    | PASS   | Yes         | Mode persisted with zero custom windows.                                       |
| ADM-PROD-009 | Products   | Same time all days               | PASS   | Yes         | Seven 09:10–17:20 windows persisted.                                           |
| ADM-PROD-010 | Products   | Different time every weekday     | FAIL   | No mutation | UI exposes weekday selection but only one shared start/end pair.               |

### Admin orders and Order Details

| Test ID      | Area      | Test                                | Status | DB Verified | Notes                                                                     |
| ------------ | --------- | ----------------------------------- | ------ | ----------- | ------------------------------------------------------------------------- |
| ADM-ORD-001  | Orders    | Date selector                       | PASS   | Yes         | Local-day results matched timestamps; no off-by-one observed.             |
| ADM-ORD-002  | Orders    | Accepting orders ON                 | PASS   | Yes         | UI, refresh, DB and Storefront enabled state verified.                    |
| ADM-ORD-003  | Orders    | Accepting orders OFF                | PASS   | Yes         | Storefront blocked checkout and updated live; original ON state restored. |
| ADM-ORD-004  | Orders    | Search                              | PASS   | Yes         | Display order number and customer name; clearing restored queue.          |
| ADM-ORD-005  | Orders    | All tab                             | PASS   | Yes         | Expected status set.                                                      |
| ADM-ORD-006  | Orders    | New tab                             | PASS   | Yes         | Initial-status orders only.                                               |
| ADM-ORD-007  | Orders    | Preparing tab                       | PASS   | Yes         | UI maps backend `accepted` into Preparing.                                |
| ADM-ORD-008  | Orders    | Out for delivery tab                | PASS   | Yes         | Correct state only.                                                       |
| ADM-ORD-009  | Orders    | Delivered tab                       | PASS   | Yes         | Delivered only.                                                           |
| ADM-ORD-010  | Orders    | Cancelled tab                       | PASS   | Yes         | Cancelled only.                                                           |
| ADM-DET-001  | Details   | Customer information                | PASS   | Yes         | Customer name/phone matched order.                                        |
| ADM-DET-002  | Details   | Contact action                      | PASS   | N/A         | Phone link available.                                                     |
| ADM-DET-003  | Details   | Delivery address/instruction        | PASS   | Yes         | Snapshot and distinctive note matched DB.                                 |
| ADM-DET-004  | Details   | Items, modifiers, quantities        | PASS   | Yes         | QA option/quantity matched order items.                                   |
| ADM-DET-005  | Details   | Subtotal, fee, tax, total, payment  | PASS   | Yes         | ₹321 + ₹40 option, ₹30 delivery, ₹17.19 tax, ₹391 total.                  |
| ADM-DET-006  | Details   | State, timestamps, timeline         | PASS   | Yes         | Milestones matched persisted timestamps.                                  |
| ADM-DET-007  | Details   | Lifecycle actions                   | PASS   | Yes         | Accept, out-for-delivery and delivered exercised.                         |
| ADM-DET-008  | Details   | Cancel action                       | PASS   | Yes         | Admin cancellation persisted and propagated.                              |
| ADM-DET-009  | Details   | Back, deep-link, refresh            | PASS   | N/A         | Navigation and direct refresh stayed usable.                              |
| ADM-DET-010  | Details   | Copy address/order                  | PASS   | N/A         | Both controls invoked without page error.                                 |
| ADM-DET-011  | Details   | Print KOT and outlet identity       | FAIL   | Yes         | Print opens, but KOT prints `A2 · MANDREM` for Arambol.                   |
| ADM-LIFE-001 | Lifecycle | Full Storefront → delivered journey | PASS   | Yes         | UI/Realtime/DB at each transition; double-click safe.                     |

### Storefront

| Test ID         | Area       | Test                             | Status  | DB Verified | Notes                                                                                     |
| --------------- | ---------- | -------------------------------- | ------- | ----------- | ----------------------------------------------------------------------------------------- |
| STF-AUTH-001    | Auth       | Login route/session              | PASS    | Yes         | Explicit account intent honored; normal session persisted after token hydration.          |
| STF-MENU-001    | Menu       | Category navigation              | PASS    | Yes         | Selection/scroll and reselection worked.                                                  |
| STF-MENU-002    | Menu       | List/grid toggle                 | PASS    | N/A         | Product count unchanged; mobile layout usable.                                            |
| STF-MENU-003    | Menu       | Add simple/configured/multiple   | PASS    | Yes         | Options, prices, count and quantities verified.                                           |
| STF-MENU-004    | Menu       | Go to cart                       | PASS    | Yes         | Route, lines and persistence correct.                                                     |
| STF-CART-001    | Cart       | Edit configured product          | PASS    | Yes         | Updated in place, price changed, refresh persisted.                                       |
| STF-CART-002    | Cart       | Remove product                   | PASS    | Yes         | Count/totals/backend cart and refresh correct.                                            |
| STF-CART-003    | Cart       | Special instructions             | PASS    | Yes         | Distinctive note persisted into order and Admin.                                          |
| STF-FUL-001     | Fulfilment | Delivery                         | PASS    | Yes         | Address, ₹30 fee, totals, DB and Admin matched.                                           |
| STF-FUL-002     | Fulfilment | Pickup and switching             | FAIL    | Yes         | UI shows ₹0 but request retains delivery address; backend correctly rejects it.           |
| STF-PAY-COD-001 | Payments   | Complete COD order               | PASS    | Yes         | Exactly one order, pending COD payment, full data and live Admin arrival.                 |
| STF-PAY-RZP-001 | Payments   | Start Razorpay                   | PASS    | Yes         | Test modal, one provider order, ₹351 INR, no secret exposed.                              |
| STF-PAY-RZP-002 | Payments   | Successful test payment          | BLOCKED | No          | External provider credential/interaction not safely automated; no real payment attempted. |
| STF-PAY-RZP-003 | Payments   | Close modal/recover              | PASS    | Yes         | No false success; “Payment cancelled” and retry available.                                |
| STF-PAY-RZP-004 | Payments   | Failed provider payment          | BLOCKED | No          | Requires reliable external Razorpay Test UI failure path.                                 |
| STF-PAY-RZP-005 | Payments   | Callback/webhook idempotency     | PARTIAL | Yes         | One payment/provider order per internal order; replay was not executed.                   |
| STF-PAY-RZP-006 | Payments   | Browser disappears after payment | PARTIAL | Code only   | Webhook reconciliation exists; no successful provider payment was available to interrupt. |
| STF-ACC-001     | Account    | Edit personal details            | FAIL    | Yes         | UI claims save; refresh and DB revert.                                                    |
| STF-ACC-002     | Account    | Sign out/re-login                | PASS    | Yes         | Session removed, private routes protected, re-login succeeded.                            |
| STF-ADDR-001    | Addresses  | Add address                      | PASS    | Yes         | Correct customer, visible in checkout, refresh persisted.                                 |
| STF-ADDR-002    | Addresses  | Edit address                     | PASS    | Yes         | Same DB row updated and persisted.                                                        |
| STF-ADDR-003    | Addresses  | Delete address                   | PASS    | Yes         | Deleted QA-only address absent after refresh and from DB.                                 |

### Realtime, high-value, security, and failures

| Test ID       | Area         | Test                                    | Status  | DB Verified | Notes                                                                                                             |
| ------------- | ------------ | --------------------------------------- | ------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| RT-001        | Realtime     | New Storefront order → Admin            | PASS    | Yes         | Appeared without reload, typically within ~1 second.                                                              |
| RT-002        | Realtime     | Admin status → customer Orders          | PASS    | Yes         | Live through all exercised states.                                                                                |
| RT-003        | Realtime     | Admin status → tracking                 | PASS    | Yes         | Accepted/Preparing mapping, out-for-delivery, delivered.                                                          |
| RT-004        | Realtime     | Storefront cancel → Admin               | PASS    | Yes         | Live cancellation and reason.                                                                                     |
| RT-005        | Realtime     | Admin cancel → Storefront               | PASS    | Yes         | Live cancellation and reason.                                                                                     |
| RT-006        | Realtime     | Offline/reconnect convergence           | PASS    | Yes         | Reconnected client converged; ordering state restored ON.                                                         |
| EXTRA-001     | Cart         | Quantity 1→2→3→2→1                      | PASS    | Yes         | Totals and refresh persistence correct.                                                                           |
| EXTRA-002     | Cart         | Refresh persistence                     | PASS    | Yes         | Items/configuration retained.                                                                                     |
| EXTRA-003     | Checkout     | Double-click Place Order                | PASS    | Yes         | Exactly one order.                                                                                                |
| EXTRA-004     | Admin        | Double-click status action              | PASS    | Yes         | One valid transition; no corruption.                                                                              |
| EXTRA-005     | Routing      | Hard refresh important routes           | PASS    | N/A         | Storefront routes and Admin root survived.                                                                        |
| EXTRA-006     | Routing      | Back/forward                            | PASS    | Yes         | Cart/auth/order state preserved.                                                                                  |
| EXTRA-007     | Auth         | Immediate post-login refresh            | PASS    | Yes         | Passed after waiting for persistent auth token.                                                                   |
| EXTRA-008     | Checkout     | Immediate post-order refresh            | PASS    | Yes         | No duplicate/stale checkout.                                                                                      |
| SEC-RLS-001   | Security     | Customer isolation                      | PASS    | Yes         | Own order readable; other customer denied `42501`.                                                                |
| SEC-RLS-002   | Security     | Business/location isolation             | PARTIAL | Code/DB     | Only one business fixture; second location exists and RPC scope checks were inspected.                            |
| SEC-RLS-003   | Security     | Anonymous access                        | PASS    | Yes         | Menu RPC works; private order access denied `42501`.                                                              |
| SEC-RLS-004   | Security     | Privileged functions/secrets            | PARTIAL | Yes         | Functions/grants inspected; advisor warnings remain. Browser bundles exposed no private keys.                     |
| SEC-STATE-001 | Integrity    | Invalid/stale order/payment transitions | PASS    | Yes         | Constraints, compare-and-swap RPC and UI double-click rejection verified; terminal milestones remained monotonic. |
| NET-001       | Failure mode | Offline cart/checkout/recovery          | PASS    | Yes         | Cart remained, checkout blocked clearly, online recovery worked.                                                  |
| NET-002       | Failure mode | Menu RPC failure/retry                  | PASS    | N/A         | Error state and retry recovery worked.                                                                            |
| NET-003       | Routing      | Unknown route recovery                  | PASS    | N/A         | Recoverable Storefront 404.                                                                                       |

## 5. Admin Menu findings

Category create, rename, duplicate, daily availability, and reorder operations persisted with sensible IDs and order fields. Duplication currently duplicates the category shell only. Saved categories cannot be deleted through the UI. Product type, featured state, option groups, priced options, and two availability modes persisted and reached the Storefront. Image upload is an intentionally disabled control, and “different times” does not actually model distinct per-weekday start/end values.

The suite leaves uniquely prefixed QA catalogue fixtures in the development database because the cross-app regression journey uses the created option product. No existing restaurant rows were deleted.

## 6. Admin Orders findings

Date filtering, search, status tabs, and the ordering-enabled toggle worked and matched the database. The queue received fresh Storefront orders live. The full delivery lifecycle produced monotonic timestamps and resisted repeated clicks. The backend has no separate `preparing` status; Admin presents `accepted` as Preparing, so “Accepted” and “Preparing” are not independently testable states.

Order Details exposed and successfully exercised customer/contact, address, items/options, customer note, bill, timeline, lifecycle/cancel, copy actions, KOT/print, back navigation, deep links, and refresh. The KOT outlet is hardcoded to Mandrem. Order cards also hardcode “Delivery” and a sample accepted time, so Pickup operations would be misrepresented even after Storefront Pickup is repaired.

## 7. Storefront findings

Authentication, mobile menu/category navigation, list/grid, configured cart lines, quantities, instructions, persistence, COD delivery, address CRUD, protected routes, and navigation were healthy in the original run. Pickup UI correctly removes the fee, and BUG-001 was subsequently fixed so the request no longer carries the previously selected delivery address. Personal detail changes are local React state only despite the save confirmation. The catalogue contains 17 obvious meat/egg/seafood items stored as `Veg`, which the Storefront renders as Vegetarian.

## 8. Realtime findings

Both applications were verified against A2 business `71667212-8437-4a40-a6fa-de869ca8f1b5` and Arambol location `23ca53d8-5e39-42af-acfb-b2e5c50b3c8b` before cross-app testing.

- New Storefront order → Admin: PASS, no refresh.
- Storefront cancellation → Admin: PASS, no refresh.
- Admin Accepted/Preparing mapping → Storefront list and tracking: PASS.
- Admin Out for delivery → Storefront: PASS.
- Admin Delivered → Storefront: PASS.
- Admin cancellation → Storefront: PASS.
- Offline/reconnect convergence: PASS.

Observed propagation was generally sub-second to roughly one second, within test timeouts. No duplicate channel effect or duplicate order was observed.

## 9. Database findings

The delivered golden order had the correct customer/business/location, QA option product, quantity 1, ₹321 base plus ₹40 Large option, ₹361 food subtotal, ₹30 delivery fee, ₹17.19 tax, ₹391 grand total, `cash` method, pending payment, delivery address, distinctive note, and accepted/out-for-delivery/delivered timestamps. Double placement created one order. Cancellation and accepting-orders mutations matched DB state.

RLS was enabled on the inspected core customer/business, ordering cart/order/item/payment/settings, and notification settings tables. Fulfilment constraints require delivery address/fee for delivery and prohibit them for Pickup. Amount, status, cart conversion, and milestone checks were present. No orphan QA address remained after cleanup. QA order/payment audit rows were retained, including three Razorpay `payment_pending` attempts with one provider order each and no provider payment ID; deleting financial audit rows solely for cleanup was avoided.

## 10. Payments

### COD

Delivery COD is a verified golden path. Order creation, item/options, pricing, pending payment state, cart conversion, live Admin arrival, lifecycle, and hard-refresh recovery passed. The original run found a payment-copy defect on hard refresh; the follow-up normalized `cash`/`online` at the Storefront boundary and the corrected COD copy now passes the hard-refresh regression.

### Razorpay

Razorpay reported Test Mode and ready. The backend created one provider order for ₹351 INR per internal online order, launched the Test checkout iframe, kept provider payment ID empty, and recovered after modal close without a false success. Successful and failed provider interactions were not executed. Callback/webhook replay and browser-disappearance reconciliation therefore remain PARTIAL/BLOCKED rather than PASS. Server-side verification and webhook reconciliation boundaries exist, but production readiness cannot be inferred from inspection alone.

## 11. Security / RLS

- Customer A could read their own order and received `42501` for another customer's order.
- Anonymous users could use the public menu boundary but could not read a private order.
- `checkout_cart`, customer order listing, customer-profile update, and location transition functions inspect `auth.uid()` and/or operator membership.
- Location transition RPCs verify business/location and use an expected-state transition, reducing stale-click races.
- A second business fixture was unavailable, so cross-business runtime isolation is PARTIAL; code/RLS inspection was completed.
- No service-role or Razorpay secret was found in browser-delivered configuration.
- Supabase security advisors returned 80 notices: 19 informational deny-by-default/RPC-policy notices, `pg_net` in `public`, 59 anonymous/authenticated SECURITY DEFINER execute warnings, and leaked-password protection disabled. Trigger broadcast functions are unnecessarily executable by browser roles even though direct trigger invocation is not useful. See the [anonymous SECURITY DEFINER advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [extension schema advisory](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), and [leaked-password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 12. Console/network health

Expected negative-test `42501`, simulated offline failures, and the intercepted menu RPC failure were contained by the UI. No recurring CORS failure, fatal React exception, broken Supabase connectivity, or Realtime websocket failure blocked Chromium operation. WebKit failed before application execution due to the host/browser protocol mismatch. Lint remains noisy, and the Razorpay quote/action guard can briefly ignore an immediate payment-button click while a quote is settling.

## 13. Bugs

### BUG-001 — Pickup checkout sends a stale delivery address and cannot place the order

**Severity:** P1  
**Area:** Storefront / Fulfilment / Checkout  
**Test:** STF-FUL-002

**Post-fix status (23 August 2026): RESOLVED**

#### Reproduction

1. Add an item, select a saved address under Delivery, then switch to Pickup.
2. Confirm the UI changes the delivery fee to ₹0 and place a COD order.

#### Expected

A Pickup order is submitted without a delivery address or delivery fee.

#### Actual

The request still contains the selected delivery address. The backend correctly rejects it with “pickup does not accept a delivery address,” so no Pickup order is created.

#### Evidence

- UI/network: Pickup total is correct, followed by backend validation failure.
- Database: no invalid Pickup order was inserted; the fulfilment constraint worked.
- Failure artifacts: `test-results/` when the retained failing spec is run.

#### Root cause

`cart-screen.tsx` always assigns `deliveryAddress: selectedAddress` when building `CheckoutRequest`, independent of the selected fulfilment.

#### Affected files

- `apps/storefront/features/cart/cart-screen.tsx:307`

#### Recommended fix

Condition the address on `fulfilment === "delivery"`, clear stale delivery validation state on switching, and keep the backend constraint.

#### Regression test

Keep `STF-FUL-002`, including Delivery → Pickup → Delivery, persisted totals, DB fulfilment shape, and Admin Pickup presentation.

### BUG-002 — Account personal details report success without persistence

**Severity:** P1  
**Area:** Storefront / Account  
**Test:** STF-ACC-001

#### Reproduction

1. Sign in, edit the Account name/email, and save.
2. Refresh and query `core.customers`.

#### Expected

The saved values survive refresh and match the customer row.

#### Actual

The current page changes, but refresh restores the old values and the database never changes.

#### Evidence

- UI: save completion is shown before refresh.
- Database: customer row unchanged.
- Failure artifacts: `test-results/` when the retained failing spec is run.

#### Root cause

`AccountRoute` wires `onSaveCustomer` to `customerSession.updateLocalProfile`, which only sets a local override. A complete `useUpdateCustomerProfileMutation` already exists but is unused.

#### Affected files

- `apps/storefront/app/routes/account-route.tsx:30`
- `apps/storefront/features/auth/customer-session.tsx:240`
- `apps/storefront/features/account/customer-profile-mutation.ts`

#### Recommended fix

Connect the Account form to the existing mutation, surface pending/error states, and replace the local override with the authoritative returned profile.

#### Regression test

Keep `STF-ACC-001` with refresh and direct DB assertions, then restore the original QA values.

### BUG-003 — Meat, seafood, and egg catalogue items are labelled Vegetarian

**Severity:** P1  
**Area:** Catalogue / Food safety / Storefront  
**Test:** STF-MENU-003 (data audit finding)

#### Reproduction

1. Load the Arambol menu and inspect dietary markers.
2. Compare displayed markers to the product rows for obvious animal/egg products.

#### Expected

Dietary labels accurately identify Veg, Non-Veg, and Egg products.

#### Actual

Seventeen obvious items—including chicken, fish/prawn and omelette/egg dishes—are stored as `Veg`; the Storefront consequently describes them as Vegetarian.

#### Evidence

- Database: 17 semantically obvious animal/egg product names have `Veg` type.
- UI: the Storefront faithfully renders “Vegetarian” from that data.

#### Root cause

The defect is in current development catalogue data, not the rendering branch. Admin permits a type but there is no validation or data-quality gate against imported/seeded content.

#### Affected files

- Live `ordering` catalogue rows for A2 Arambol
- `apps/admin/features/menu/menu-screen.tsx`
- `apps/storefront/features/menu/menu-screen.tsx`

#### Recommended fix

Correct the catalogue rows under operator review, audit all products, and add a publish-time review/data validation workflow. Do not infer dietary type solely from names in production code.

#### Regression test

Add a curated catalogue assertion for known QA products and an operator acceptance checklist for dietary/allergen correctness.

### BUG-004 — Admin operational output hardcodes Mandrem and Delivery for Arambol orders

**Severity:** P1  
**Area:** Admin / Multi-tenancy / Operations  
**Test:** ADM-DET-011 and STF-FUL-002 follow-through

#### Reproduction

1. Sign into A2 Arambol and open a fresh order.
2. Print KOT and inspect the queue card fulfilment label.

#### Expected

KOT shows the active outlet and each card reflects its persisted Delivery/Pickup type.

#### Actual

KOT prints `A2 · MANDREM`; queue cards always show `Delivery`. Pickup would be operationally misrouted even after Pickup checkout is repaired.

#### Evidence

- UI/print: Arambol session and DB order, Mandrem KOT label.
- Source: literal fulfilment/location strings.

#### Root cause

The order presentation uses demo literals instead of resolved business/location and `order.fulfilment`.

#### Affected files

- `apps/admin/features/orders/orders-screen.tsx:224`
- `apps/admin/features/orders/orders-screen.tsx:784`

#### Recommended fix

Pass resolved venue identity and fulfilment through the Admin order model, render them in cards/details/KOT, and test both locations and fulfilment modes.

#### Regression test

Retain the KOT Arambol assertion and add a real Pickup order assertion after BUG-001 is fixed.

### BUG-005 — Product image upload is unavailable

**Severity:** P1  
**Area:** Admin / Catalogue / Storage  
**Test:** ADM-PROD-004

#### Reproduction

1. Add a product in Admin.
2. Attempt to activate Upload image using the deterministic test fixture.

#### Expected

The image uploads, persists, has a DB/Storage reference, and renders in both apps.

#### Actual

The button is disabled with “Image uploads require catalog storage configuration.”

#### Evidence

- UI: disabled control; no network mutation or Storage object.
- Source: explicit disabled button title.

#### Root cause

The feature is a placeholder; no configured catalogue Storage upload path is connected.

#### Affected files

- `apps/admin/features/menu/menu-screen.tsx:880`

#### Recommended fix

Implement tenant-scoped Storage paths/policies, upload progress/errors, durable image references, and cleanup for replaced assets.

#### Regression test

Keep `ADM-PROD-004` with fixture upload, refresh, DB, Storage, Admin and Storefront assertions.

### BUG-006 — “Different times” cannot store different weekday hours

**Severity:** P2  
**Area:** Admin / Product availability  
**Test:** ADM-PROD-010

#### Reproduction

1. Choose Different times on different days for a QA product.
2. Select weekdays and try to enter distinct hours for each day.

#### Expected

Each weekday exposes and persists its own start/end pair.

#### Actual

Weekday toggles share only one start and one end input.

#### Evidence

- UI: 2 time inputs instead of 14 for seven weekdays.
- Database: no distinct schedule was submitted.

#### Root cause

The editor model has scalar `scheduleStart`/`scheduleEnd` with a weekday array, not per-day windows.

#### Affected files

- `apps/admin/features/menu/menu-screen.tsx:958`

#### Recommended fix

Model per-day windows, map each row explicitly to the DB representation, and define timezone/boundary behavior.

#### Regression test

Keep `ADM-PROD-010` with seven unmistakably different windows and direct DB assertions.

### BUG-007 — Saved empty categories cannot be deleted

**Severity:** P2  
**Area:** Admin / Categories  
**Test:** ADM-CAT-005

#### Reproduction

1. Create and save a uniquely named empty QA category.
2. Open its action menu.

#### Expected

Delete is enabled and safely removes/archives the QA row.

#### Actual

Delete is disabled with “Saved categories cannot be deleted yet.”

#### Evidence

- UI: disabled Delete button.
- Database: category remains.

#### Root cause

The UI only allows deletion of unsaved client-side categories; durable delete/archive behavior is not implemented.

#### Affected files

- `apps/admin/features/menu/menu-screen.tsx:431`

#### Recommended fix

Define hard-delete versus archive semantics, protect non-empty categories, implement the atomic mutation, and invalidate menu queries.

#### Regression test

Keep `ADM-CAT-005` on a QA-only empty category with refresh and DB assertions.

### BUG-008 — Completed COD order timeline says payment was confirmed

**Severity:** P2  
**Area:** Storefront / Orders / Payments  
**Test:** STF-PAY-COD-001 follow-up

**Post-fix status (23 August 2026): RESOLVED**

#### Reproduction

1. Complete a COD delivery and mark it delivered.
2. Hard-refresh its Order Details page.

#### Expected

COD remains described as cash/payment pending unless a later payment record says otherwise.

#### Actual

The bill shows pending while the timeline says “Payment confirmed and sent to A2.”

#### Evidence

- UI: contradictory payment statements on the same order.
- Database: payment method `cash`, status `pending`.

#### Root cause

The cold `/orders/:orderId` route uses `useOrderById` → `getOrder`, whose parser passes the database code `cash` through unchanged. `OrderDetailsScreen`, `OrderTrackingScreen`, and the payment confirmation screen compared that value with the display string `Cash on delivery`, so a refreshed COD order was treated as non-COD. The order-history parser also lacked a normalized payment-method field, leaving two inconsistent data boundaries.

#### Affected files

- `apps/storefront/features/orders/api/customer-orders-api.ts`
- `apps/storefront/features/checkout/api/storefront-checkout-api.ts`
- `apps/storefront/domain/storefront.ts`
- `apps/storefront/features/orders/order-details-screen.tsx:28`
- `apps/storefront/features/orders/order-tracking-screen.tsx:54`
- `apps/storefront/features/orders/order-status-timeline.tsx:57`

#### Recommended fix

Normalize the database method into a typed internal `cash`/`online` value at the API boundary and derive all payment copy from that value plus the authoritative payment status.

#### Regression test

Extend COD lifecycle coverage to hard-refresh delivered details and assert payment copy against DB state.

### BUG-009 — Razorpay action can ignore a click while the updated quote settles

**Severity:** P2  
**Area:** Storefront / Razorpay / UX  
**Test:** STF-PAY-RZP-001

#### Reproduction

1. Select Online and proceed when the authoritative quote changes the displayed amount.
2. Click the newly rendered payment CTA immediately.

#### Expected

The control is disabled with visible progress until actionable, or the click starts checkout.

#### Actual

The CTA can render just before the in-flight guard clears and the immediate click is ignored; waiting briefly succeeds.

#### Evidence

- Browser timing: automation required a ~500 ms readiness wait; no provider order was created on the ignored click.

#### Root cause

Visual phase and internal submission/quote guard become ready in separate React updates.

#### Affected files

- `apps/storefront/features/checkout/use-checkout-flow.ts`
- `apps/storefront/features/checkout/payment-flow-screen.tsx`
- `apps/storefront/app/routes/cart-route.tsx`
- `tests/e2e/storefront/razorpay.spec.ts`

#### Recommended fix

Expose one authoritative actionable flag, disable/label the CTA until true, and ensure the click cannot be silently discarded.

#### Regression test

Remove the artificial wait from the Razorpay spec and assert the first eligible click opens exactly one provider checkout.

**Post-fix status (23 August 2026): RESOLVED (provider E2E blocked)**

The checkout hook now releases its duplicate-submission guard before publishing the `quote_changed` phase and exposes `canAcceptUpdatedQuote` as the single readiness contract. The payment CTA is disabled and labeled as updating until that flag is true. The Razorpay regression now performs one immediate eligible click and counts successful `start-online-payment` responses to guard against duplicate provider checkout starts.

### BUG-010 — Supabase grants expose an unnecessarily broad SECURITY DEFINER surface

**Severity:** P2  
**Area:** Supabase / Security  
**Test:** SEC-RLS-004

#### Reproduction

1. Run Supabase security advisors.
2. Inspect browser-role execute grants and SECURITY DEFINER functions.

#### Expected

Only intended public RPC boundaries are executable; internal trigger/helper functions are revoked from `PUBLIC`, `anon`, and `authenticated`.

#### Actual

Advisors report 59 browser-role SECURITY DEFINER execute warnings. Realtime trigger functions such as `broadcast_order_change()` and `broadcast_ordering_status()` retain unnecessary browser-role execution surface. Leaked-password protection is also disabled and `pg_net` is in `public`.

#### Evidence

- Supabase security advisor: 80 total notices.
- Runtime customer/anonymous isolation tests still passed; no direct data exposure was proven.

#### Root cause

Default function privileges and function-specific revokes were not consistently tightened across migrations.

#### Affected files

- `supabase/migrations/20260816080000_storefront_ordering_status.sql`
- `supabase/migrations/20260817210000_backfill_order_realtime_broadcast.sql`
- Related SECURITY DEFINER migrations

#### Recommended fix

Inventory every warning, revoke browser roles from internal functions, explicitly grant only reviewed entry points, move extensions where supported, and enable leaked-password protection.

#### Regression test

Add SQL assertions for function ACLs plus runtime anon/customer/operator negative tests in CI.

### BUG-011 — Root build is non-portable on the project’s macOS development host

**Severity:** P2  
**Area:** Build / Tooling  
**Test:** Repository health

#### Reproduction

1. Use the required Node version on stock macOS.
2. Run `npm run build`.

#### Expected

The root release verification runs both builds.

#### Actual

It exits 69 before building because GNU `timeout` is absent. Direct workspace builds pass.

#### Evidence

- Terminal: `build-verified.sh requires GNU timeout.`

#### Root cause

The script assumes the GNU command name without a portable fallback (`gtimeout`/platform-neutral process timeout).

#### Affected files

- `scripts/build-verified.sh:10`
- `scripts/install-ci.sh:14`

#### Recommended fix

Use a repository Node timeout wrapper or resolve `timeout`/`gtimeout` explicitly with documented setup.

#### Regression test

Run the root build on macOS and Linux CI.

### BUG-012 — Formatting and lint baselines are red

**Severity:** P2  
**Area:** Code health  
**Test:** Repository health

#### Reproduction

1. Run `npm run format` and `npm run lint`.

#### Expected

Release health checks pass.

#### Actual

Formatting reports 37 files; lint reports 10 errors and 12 warnings, including React hook/ref issues and Deno notification sources.

#### Evidence

- Terminal output from both configured commands.

#### Root cause

Current application and Edge Function code is not aligned with the root formatting/lint configuration; some findings are functional hook risks rather than style only.

#### Affected files

- `apps/admin/features/orders/use-new-order-alarm.ts`
- `apps/storefront/features/auth/customer-session.tsx`
- `apps/storefront/features/checkout/use-checkout-flow.ts`
- `supabase/functions/notification-*`
- Other files reported by Prettier

#### Recommended fix

Fix hook correctness first, define the Deno lint boundary intentionally, format the baseline, and enforce both checks in CI.

#### Regression test

Make the existing format/lint commands mandatory release checks.

### BUG-013 — Customer account starts with blank name and synthetic email

**Severity:** P2  
**Area:** Storefront / Account / Auth  
**Test:** STF-AUTH-001 and STF-ACC-001 observation

#### Reproduction

1. Sign in with the QA phone and open Account before a local edit.

#### Expected

The authoritative customer profile is shown, with no fabricated contact data.

#### Actual

The name is blank and the email is a synthetic `auth.invalid` value.

#### Evidence

- Account UI after fresh authenticated hydration.

#### Root cause

Auth bootstrap/profile fallback data leaks into the presentation model instead of treating absent optional profile fields as unset.

#### Affected files

- `apps/storefront/features/auth/customer-session.tsx`
- `apps/storefront/features/account/account-screen.tsx`

#### Recommended fix

Normalize synthetic auth placeholders to empty/null at the data boundary and prompt for optional details without presenting fake contact data.

#### Regression test

Assert fresh account hydration never renders `.invalid` placeholder addresses.

### BUG-014 — Admin queue shows hardcoded accepted time and active-cart count

**Severity:** P3  
**Area:** Admin / Orders  
**Test:** Admin Orders exploratory audit

#### Reproduction

1. Open orders with different accepted timestamps and inspect Active carts.

#### Expected

Timestamps and cart activity derive from live records or the section is labelled as unavailable.

#### Actual

Accepted orders show `Accepted at 3:34 PM`; Active carts shows `2 carts · last activity 3 min ago` regardless of data.

#### Evidence

- Literal strings in the rendered Admin screen and source.

#### Root cause

Demo copy remains in the production-facing screen.

#### Affected files

- `apps/admin/features/orders/orders-screen.tsx:336`
- `apps/admin/features/orders/orders-screen.tsx:521`

#### Recommended fix

Bind timestamps to the order model and implement/query active carts or remove the fake statistic.

#### Regression test

Seed distinct accepted timestamps/cart states and assert exact rendered data.

### BUG-015 — Mandrem/A2 demo branding remains outside resolved tenant context

**Severity:** P3  
**Area:** Admin / Storefront / Multi-tenancy  
**Test:** Exploratory context audit

#### Reproduction

1. Resolve the Arambol location and inspect Admin product preview and Storefront document/PWA metadata.

#### Expected

Venue labels derive from the current tenant/location or use product-neutral platform metadata.

#### Actual

Product preview says `A2 · Mandrem`; Storefront title/manifest still identify Mandrem.

#### Evidence

- Source literals and Arambol runtime context.

#### Root cause

Historical reconstruction/demo metadata was never moved behind the business/location context.

#### Affected files

- `apps/admin/features/menu/menu-screen.tsx:704`
- `apps/storefront/index.html:9`
- `apps/storefront/public/manifest.webmanifest`

#### Recommended fix

Render tenant/location content from resolved settings and choose safe static PWA metadata where dynamic manifests are not supported.

#### Regression test

Run venue-context assertions for Arambol and Morjim fixtures.

## Follow-up verification: BUG-001

The original matrix and executive totals above are preserved as the 22 August pre-fix QA baseline. On 23 August, BUG-001 was fixed by making the checkout request include `deliveryAddress` only when `fulfilment === "delivery"`.

| Verification                   | Result                                                         |
| ------------------------------ | -------------------------------------------------------------- |
| Storefront typecheck           | PASS                                                           |
| Storefront production build    | PASS; existing large-chunk warning remains                     |
| Focused ESLint                 | PASS with one pre-existing `MenuImage` unused-variable warning |
| Customer auth setup            | PASS                                                           |
| `STF-FUL-002` Pickup E2E       | PASS                                                           |
| Persisted order fulfilment     | `pickup`                                                       |
| Persisted delivery address     | `null`                                                         |
| Persisted delivery fee         | `0`                                                            |
| Supabase migration/RLS changes | None required                                                  |

The selected address remains in local state for a later switch back to Delivery, but it is no longer passed to either COD or online checkout while Pickup is selected. The focused E2E run created one uniquely exercised QA Pickup order for audit; no existing order was modified or deleted.

## Follow-up verification: BUG-008

On 23 August, the Storefront payment-method boundary was corrected so Supabase database values are normalized to the typed internal values `cash` and `online`. COD copy now remains cash-specific after a cold order-details fetch or hard refresh.

| Verification                                                | Result                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Storefront typecheck                                        | PASS                                                                  |
| Focused ESLint                                              | PASS for BUG-008 files; existing hook error/warnings remain elsewhere |
| Admin and customer auth setup                               | PASS                                                                  |
| COD delivery/realtime lifecycle with hard-refresh assertion | PASS                                                                  |
| Refreshed COD timeline                                      | “Pay cash when it arrives.”                                           |
| Incorrect paid copy after refresh                           | Absent                                                                |
| Supabase migration/RLS changes                              | None required                                                         |

The regression order was created with notifications temporarily disabled and retained as QA audit data. Notification modes were restored to email `redirect` / Telegram `live` afterward.

## Follow-up verification: BUG-002

On 23 August, the Account profile form was connected to the existing authenticated `core.update_customer_profile` mutation. The form now reports success only after the RPC resolves, displays a recoverable error when it fails, and updates the authoritative customer-session profile from the returned row so a refresh reads the persisted values.

| Verification                   | Result                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storefront typecheck           | PASS                                                                                                                                                                                                      |
| Storefront production build    | PASS; existing large-chunk warning remains                                                                                                                                                                |
| Focused ESLint                 | FAIL due to the pre-existing `react-hooks/set-state-in-effect` error in `customer-session.tsx:158`, unrelated to this profile change                                                                      |
| `STF-ACC-001` persistence E2E  | PASS with the existing stored customer auth state; the credential-dependent setup remains blocked because `TEST_ADMIN_EMAIL` and the other QA credential variables are not configured in this environment |
| Supabase migration/RLS changes | None required; the existing authenticated RPC was reused                                                                                                                                                  |

The regression spec asserts the post-save “Details saved” state before reloading and then verifies that the saved name is still rendered after the fresh profile load. The full dependent-project run still requires the missing QA credentials, but the targeted persistence scenario passed with the existing stored auth state.

## Follow-up verification: BUG-013

On 23 August, MSG91's technical `msg91_<phone>@auth.invalid` identity was isolated from customer profile data. The development migration replaces the Auth-to-customer sync trigger so it does not copy that internal address into `core.customers`, clears the pre-existing generated values, and defensively normalizes the same pattern in the Storefront profile mapper. A customer with no saved display name now sees “Add your name” rather than a blank identity heading.

| Verification                       | Result                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Development migration              | PASS — `20260823085206_customer_auth_placeholder_sanitization` applied to `ordering dev`                                     |
| Existing synthetic customer emails | PASS — reduced from 6 to 0                                                                                                   |
| Invalid verified-email rows        | PASS — 0 rows with an email-verification timestamp but no email                                                              |
| Storefront typecheck               | PASS                                                                                                                         |
| Storefront production build        | PASS; existing large-chunk warning remains                                                                                   |
| Focused ESLint                     | FAIL due to the pre-existing `react-hooks/set-state-in-effect` error in `customer-session.tsx:166`, unrelated to this change |
| Targeted authenticated Account E2E | PASS — no `@auth.invalid` text, “Email · Add email” is shown, and the persisted-profile refresh assertion passes             |
| Fresh login `STF-AUTH-001`         | Updated with the same no-placeholder assertion; execution remains blocked by missing QA credential environment variables     |

The generated address remains in `auth.users` because the MSG91 session exchange still needs it; it is no longer treated as an email address suitable for customer presentation or communication.

## Follow-up verification: BUG-009

On 23 August, the Razorpay quote-change race was fixed by making quote acceptance explicitly actionable only after the quote request releases its in-flight guard. The CTA cannot silently discard the first eligible click, and the regression no longer uses an arbitrary readiness delay.

| Verification                   | Result                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Storefront typecheck           | PASS                                                                                                                      |
| Storefront production build    | PASS; existing large-chunk warning remains                                                                                |
| Focused ESLint                 | FAIL due to the pre-existing `react-hooks/set-state-in-effect` error in `use-checkout-flow.ts:404`, unrelated to this fix |
| Razorpay regression source     | PASS — artificial 500 ms wait removed; first eligible click and exactly-one successful payment-start response asserted    |
| Targeted Razorpay E2E          | BLOCKED — dependent customer-auth setup requires missing `TEST_ADMIN_EMAIL` and other QA credential variables             |
| Supabase migration/RLS changes | None required                                                                                                             |

The online checkout path retains the existing `activeRequest` duplicate-submission guard for order creation and payment retries. COD and payment-retry flows are unchanged apart from resetting the quote-readiness flag when a new attempt begins.

## 14. Automated test coverage added

The original QA run added only test infrastructure. Follow-up bug fixes now also touch Storefront production code; the reusable QA infrastructure consists of Playwright 1.62.1, scripts, ignored artifacts/auth state, failure evidence configuration, isolated auth setup, diagnostics, deterministic media, and the following suite:

| File                                             | Coverage                                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.config.ts`                           | Admin Desktop Chromium, Storefront mobile Chromium, cross-app Chromium, Storefront mobile WebKit, two local web servers, traces/video/screenshots/HTML. |
| `tests/e2e/setup/admin.setup.ts`                 | Central Admin login/storage state.                                                                                                                      |
| `tests/e2e/setup/customer.setup.ts`              | Central phone/OTP login/storage state with persistent-token wait.                                                                                       |
| `tests/e2e/helpers/credentials.ts`               | Central QA credential/environment resolution; report output never prints secrets.                                                                       |
| `tests/e2e/helpers/auth.ts`                      | Reusable Admin and customer authentication.                                                                                                             |
| `tests/e2e/helpers/diagnostics.ts`               | Console/page-error/failed-request capture attached to tests.                                                                                            |
| `tests/e2e/helpers/storefront.ts`                | Storefront cart/product/checkout helpers.                                                                                                               |
| `tests/e2e/admin/auth.spec.ts`                   | Admin A2 Arambol resolution.                                                                                                                            |
| `tests/e2e/admin/menu-categories.spec.ts`        | ADM-CAT-001..006.                                                                                                                                       |
| `tests/e2e/admin/menu-products.spec.ts`          | ADM-PROD-001..010 and Storefront visibility.                                                                                                            |
| `tests/e2e/admin/orders.spec.ts`                 | ADM-ORD-001..010 and Order Details/KOT inventory.                                                                                                       |
| `tests/e2e/admin/resilience.spec.ts`             | Admin refresh.                                                                                                                                          |
| `tests/e2e/storefront/smoke.spec.ts`             | Venue/menu mobile smoke and WebKit target.                                                                                                              |
| `tests/e2e/storefront/auth.spec.ts`              | STF-AUTH-001 and EXTRA-007.                                                                                                                             |
| `tests/e2e/storefront/menu-cart.spec.ts`         | STF-MENU/CART and quantity/persistence.                                                                                                                 |
| `tests/e2e/storefront/account-addresses.spec.ts` | Account and QA-only address lifecycle.                                                                                                                  |
| `tests/e2e/storefront/razorpay.spec.ts`          | Razorpay launch and close/recovery.                                                                                                                     |
| `tests/e2e/storefront/resilience.spec.ts`        | Refresh, navigation, offline, RPC retry, 404.                                                                                                           |
| `tests/e2e/cross-app/order-lifecycle.spec.ts`    | COD, delivery/Pickup, idempotency, lifecycle and bidirectional Realtime.                                                                                |
| `tests/e2e/cross-app/reconnect.spec.ts`          | Offline/reconnect convergence.                                                                                                                          |
| `tests/e2e/cross-app/security.spec.ts`           | Customer/anonymous RLS negative tests.                                                                                                                  |
| `tests/fixtures/product-test.svg`                | Deterministic product-image fixture.                                                                                                                    |

Scripts added to root `package.json`: `test:e2e`, `test:e2e:report`, and `test:e2e:webkit`. Playwright output is ignored under `test-results/`, `playwright-report/`, and `tests/.auth/`. The generated HTML entry point is `playwright-report/index.html`.

Some catalogue specs intentionally preserve uniquely prefixed QA fixtures to provide stable cross-app regression data. This is documented because complete per-test cleanup is not yet implemented. Financial/order audit rows are intentionally retained. Future harness work should add privileged Node-only fixture cleanup that cannot reach existing restaurant data.

## 15. Remaining coverage gaps

### Critical

- A successful Razorpay Test payment, server verification, payment-state transition, live Admin receipt, and exactly-once outcome.
- A failed Razorpay Test payment and safe retry.
- Callback/webhook replay and a browser-disappears-after-success exercise.

### High

- Runtime cross-business isolation with a second safe business/operator fixture; current result is code/RLS inspection only.
- Runtime attempts to update another customer's cart/address/cancellation, beyond the executed cross-order read denial.
- Pickup Admin lifecycle after BUG-001 and BUG-004 are fixed.
- Real notification dispatch was deliberately disabled for safety; email/Telegram external delivery is unverified.

### Medium

- Real-device Safari. Playwright WebKit cannot launch against this host combination.
- Deterministic slow/interrupted checkout and Admin mutation at transport boundaries; offline cart and RPC retry were covered, idempotency guards were exercised by double-click.
- Automated time travel across catalogue availability boundaries/timezone changes.
- Installed Supabase CLI/Deno execution for Edge Function and database test suites.

### Low

- Clipboard contents and physical KOT print layout on target hardware (controls were invoked).
- PWA install/background lifecycle and alarm/audio/push behavior on target devices.

Manual Razorpay completion instructions: use the existing Test Mode checkout only, complete one documented Razorpay test payment, capture the internal order/payment/provider IDs, verify the server-side signature result and Admin live arrival, then replay the identical verification/webhook payload and confirm no second order/payment transition. Never use live card/UPI credentials.

## 16. Recommended fix order

1. **BUG-003 — P1 — dietary labels:** incorrect vegetarian classification is a customer-safety and trust risk; correct and review data before serving customers.
2. **BUG-001 — P1 — Pickup checkout:** a supported fulfilment mode is completely unusable despite the UI advertising it.
3. **BUG-004 — P1 — Admin operational identity/fulfilment:** wrong outlet/Pickup data can cause kitchen and handoff mistakes.
4. **BUG-002 — P1 — RESOLVED:** profile changes now persist through the authenticated RPC and survive refresh.
5. **BUG-005 — P1 — product images:** catalogue management is incomplete for normal restaurant operation.
6. **BUG-010 — P2 — database privilege surface:** narrow SECURITY DEFINER grants before production and add SQL ACL tests.
7. **BUG-008 — P2 — RESOLVED:** payment copy now remains cash-specific after hard refresh; retain the regression test.
8. **BUG-006 / BUG-007 — P2 — menu completeness:** implement per-day availability and safe saved-category deletion.
9. **BUG-009 — P2 — RESOLVED:** quote acceptance is explicitly actionable and the regression no longer relies on a timing workaround; provider execution remains blocked by missing QA credentials.
10. **BUG-011 / BUG-012 — P2 — release checks:** restore portable green build, lint, and formatting gates.
11. **BUG-013 — P2 — RESOLVED:** technical MSG91 Auth email placeholders no longer reach customer data or the Account UI.
12. **BUG-014 / BUG-015 — P3 — demo literals:** remove remaining fake metrics, timestamps, and Mandrem metadata.

After P1 fixes, rerun the entire Chromium suite and complete Razorpay Test provider scenarios before reconsidering release. Do not promote based only on workspace builds.

## 17. Release recommendation

**DO NOT RELEASE**

There is no demonstrated P0 exploit or duplicate/lost COD order, and the delivery COD/realtime foundation is encouraging. However, the release is described as feature-complete while Pickup is broken, customer edits are falsely saved, dietary data is unsafe, images cannot be uploaded, and Admin prints/displays incorrect operational context. In addition, the actual Razorpay success/failure/webhook path is not yet proven. These are incompatible with handing the current build to a real restaurant.

The next release gate should require all P1 fixes, a reviewed dietary data correction, successful full Chromium rerun, green lint/build checks or explicitly accepted baselines, and a complete Razorpay Test Mode success/failure/idempotency exercise.
