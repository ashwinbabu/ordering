# Storefront-specific instructions

These instructions apply to work inside `apps/storefront/`. They supplement the repository-root `AGENTS.md`; where they are more specific, follow these instructions for Storefront work.

## Read before work

Before analysing or changing Storefront code, read completely:

1. `docs/storefront-rebuild-brief.md` — canonical product, UX and acceptance reference.
2. `docs/storefront-architecture.md` — approved abstract architecture and workflow.
3. Every relevant file actually present under `reference/storefront/`, including written flow notes.

Public behavioural and visual reference:

`https://a2-ordering-customer.ashwinbabu007.chatgpt.site`

Use browser inspection when available to observe rendered states and interactions. Do not copy or reverse engineer a deployed production bundle, scrape minified source, or use generated production assets as maintainable source code.

When sources conflict, follow the hierarchy in `docs/storefront-rebuild-brief.md`. Do not silently resolve a material conflict.

## Scope

The current task is frontend-only reverse engineering of the customer Storefront.

Required outcomes:

- reproduce the approved customer experience with maintainable local source;
- support the demonstrated menu-to-order journey with seed/demo data and local state;
- preserve responsive, accessible and PWA behaviour where applicable;
- keep tenant and outlet assumptions explicit and configurable;
- leave clean seams for future TanStack Query and Supabase integration.

Do not modify `apps/admin/` during Storefront work unless a later prompt explicitly requires it.

## Backend work

The original rebuild authorised no backend work at all. That blanket prohibition has since been superseded for two boundaries by approved work:

**The menu catalogue**, which shipped a real, location-scoped Supabase read path:

- `lib/supabase/client.ts` and the generated `lib/supabase/database.types.ts`;
- `@supabase/supabase-js` in this workspace's `package.json`;
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`;
- the `get_storefront_menu` RPC and its migrations under `supabase/`;
- `features/menu/api/storefront-menu-api.ts` reading that boundary.

**MSG91 OTP customer authentication**, covering both the sign-in entry point (header/account) and the checkout verification entry point:

- `core.customer_auth_verifications` (replay guard) and its RLS, under `supabase/migrations/`;
- the `customer-auth-msg91` Edge Function under `supabase/functions/`, which holds the MSG91 authkey as a server secret and never exposes it to the client;
- the Supabase Auth session bridge it mints (deterministic synthetic-email magic-link exchange via `admin.generateLink` + client-side `auth.verifyOtp({ token_hash })`) — this is the sanctioned way to turn an MSG91-verified phone into a real Supabase session; do not invent a second one;
- `VITE_MSG91_WIDGET_ID` and `VITE_MSG91_TOKEN_AUTH` in `.env.local` (client-safe by MSG91's own design — the authkey is not);
- `features/auth/msg91/`, `features/auth/api/customer-auth-api.ts`, `features/auth/use-otp-verification.ts`, `features/auth/customer-session.tsx`, and the `auth-flow-sheet.tsx` / `cart-screen.tsx` / `storefront-app.tsx` wiring that consumes them.

SMS via MSG91 for Indian (+91) numbers only, for now. Email OTP for non-Indian customers is a deliberate seam (`domain/phone.ts`'s country table, MSG91's own email-channel support) but is not implemented — do not build it speculatively.

Everything outside these two boundaries remains unauthorised. Do not add or configure:

- Supabase's own phone/email OTP auth (Realtime and Storage stay unauthorised too);
- new SQL, migrations, RLS, RPCs or Edge Functions beyond the two boundaries above;
- new environment variables or secrets beyond the two boundaries above;
- real payment processing;
- live order, refund or delivery integrations.

TanStack Query is now the storefront's server-state layer, wired in `lib/query-client.tsx` and used by `features/menu/storefront-menu-query.ts` for the menu RPC. It is for **real** remote state only. Do not introduce artificial queries, fake remote APIs or no-op hooks merely to use it, and keep demo/seed data (`demo/a2-mandrem.ts`) as local state rather than wrapping it in queries.

## Architecture

- Keep route/page entry files thin in the eventual structure.
- Keep provider-specific data access out of screen components.
- Keep seed/demo data behind a replaceable boundary rather than scattering it through UI files.
- Do not add Drizzle, SQLite or another ORM/database layer.
- Do not create shared `packages/*` code until stable, genuine reuse between Admin and Storefront is demonstrated and explicitly approved.
- Do not hardcode A2-only assumptions into reusable UI. A2 Food & Beverages and Mandrem are current seed tenant/location content.

The final Storefront feature grouping and folder taxonomy are intentionally not approved yet. Do not create speculative empty folders or treat example concepts as an approved directory tree.

## First task: read-only audit

For the first Storefront task, make no source changes unless the user explicitly overrides this rule.

Inspect:

- the relevant repository structure, worktree state, package manager, lockfile, scripts and dependencies;
- framework, router, source entrypoints, styling, assets and PWA configuration;
- existing Storefront code, if any;
- all available local screenshots, videos and notes;
- the public Customer Site at relevant mobile and desktop viewport sizes;
- demonstrated interaction states and flows.

Then report:

1. observed screens, routes, behaviours and states;
2. visual/design-system observations;
3. inferred state and data boundaries;
4. discrepancies or missing evidence;
5. one recommended folder structure and, where useful, one credible alternative;
6. trade-offs and rationale;
7. a phased implementation plan;
8. proposed verification checks;
9. questions that genuinely block implementation.

Stop after the audit and wait for explicit approval before restructuring or implementing.

## After approval

- Work in coherent, reviewable phases.
- Preserve approved UI, wording, routes, state and responsive behaviour unless explicitly asked to change them.
- Avoid unrelated cleanup and unnecessary dependencies.
- Keep demo boundaries clearly labelled; never present a stub as a live backend or payment gateway.
- Preserve cart and navigation continuity demonstrated by the reference.
- Verify each phase with the repository's configured checks, local browser testing, mobile/desktop comparison and accessible keyboard/focus behaviour.
- Report validations, visible differences, assumptions and remaining stubs.

Do not deploy, publish, modify the public Customer Site or save a new Site version unless the user explicitly requests that separate action.
