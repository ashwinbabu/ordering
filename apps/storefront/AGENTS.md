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

## No backend work

There is no Supabase implementation in the demo Site, and no backend work is authorised for this rebuild.

Do not add or configure:

- Supabase clients or packages;
- authentication;
- database types;
- SQL, migrations, RLS, RPCs or Edge Functions;
- Realtime, Storage or backend APIs;
- environment variables or secrets;
- real payment processing;
- live order, refund or delivery integrations.

TanStack Query is the intended future server-state layer. Do not introduce artificial queries, fake remote APIs or no-op hooks merely to use it. Use replaceable local data boundaries only where the current frontend needs them.

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
