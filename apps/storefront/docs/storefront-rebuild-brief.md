# A2 Ordering Storefront — Abstract Frontend Architecture

Status: approved architectural direction; exact feature grouping is intentionally undecided until Codex completes a repository and live-site analysis.

## 1. Architectural objective

Build the customer-facing A2 Ordering application as a maintainable frontend inside the planned monorepo:

```text
a2-ordering/
├── apps/
│   ├── admin/
│   └── storefront/
├── packages/        # only when genuine cross-app reuse is demonstrated
├── docs/
├── reference/
└── supabase/        # future canonical backend/migrations area
```

The storefront must remain an independently understandable application. The presence of the Admin app must not cause premature extraction into shared packages or force identical domain boundaries between the two apps.

## 2. Important decision: feature grouping is not locked

Codex must not assume that the final folders are already decided.

Before restructuring the storefront, Codex must:

1. inspect the current repository and toolchain;
2. inspect the public A2 Customer Site through the browser where possible;
3. enumerate and inspect the local reference media;
4. identify the current state, component and data boundaries;
5. map the main screens, flows and cross-cutting concerns;
6. propose one or more folder groupings with reasons;
7. identify what is genuinely shared versus screen-specific;
8. wait for approval before committing to the final feature taxonomy.

The folder names in the eventual implementation are a result of that analysis. Do not create empty speculative folders merely to match an example architecture.

## 3. Approved abstract boundaries

The implementation should evolve toward these boundaries, regardless of the final folder names:

```text
route/page entry
  → screen composition
  → UI/domain interaction boundary
  → query or mutation boundary when server state exists later
  → API/data-access module
  → future Supabase or trusted backend integration
```

For the current rebuild, the last two layers may be local demo implementations. They must still be replaceable without rewriting the screens.

The UI should not contain:

- scattered raw data arrays;
- duplicated cart calculations;
- duplicated tenant/location resolution;
- direct provider-specific calls in every component;
- payment gateway assumptions;
- backend credentials or secrets.

## 4. Technology direction

Use the existing repository's framework, bundler, router, package manager and conventions wherever they are sound. Do not migrate technology merely for aesthetic reasons during reverse engineering.

The intended direction is:

- React;
- TypeScript;
- TanStack Query later for server state and asynchronous resource state;
- local state or a small domain store for ephemeral UI/cart behaviour where appropriate;
- Supabase later as the backend platform;
- PWA support preserved where already present;
- CSS/design-token conventions preserved or improved only when required for maintainability.

TanStack Query is a future server-state layer, not a reason to invent a backend during this rebuild. If the current demo has no server state, do not create artificial Supabase queries simply to use TanStack Query.

## 5. Supabase boundary — future only

No Supabase implementation is part of this task.

Do not add:

- Supabase packages or clients unless they already exist and are required by the recovered source;
- authentication;
- generated database types;
- migrations;
- RLS policies;
- RPCs;
- Edge Functions;
- environment variables;
- service-role or other secrets;
- live queries, mutations, Realtime or storage integration.

Instead, establish future-friendly interfaces such as catalog, cart, checkout, delivery quote and order-status data boundaries only where the current UI needs them. These may be implemented with seed data, local state and deterministic demo transitions.

When backend integration begins later, the intended direction is:

```text
screen/component
  → TanStack query/mutation or domain action
  → app-specific API module
  → typed Supabase/backend integration
```

The storefront must remain tenant- and location-scoped in its data contracts. A future query key should include the relevant business/location identity rather than relying on a global singleton menu.

## 6. Data and state principles

Separate these concerns conceptually, even if the audit finds they currently live together:

- tenant/location context;
- catalog/menu data;
- product configuration and pricing display;
- cart contents and persistence;
- checkout/fulfilment state;
- delivery eligibility, fee and ETA state;
- payment hand-off state;
- order progress and cancellation timer;
- presentation-only UI state such as open sheets and selected view mode.

The current rebuild may use demo data and local persistence, but the boundaries should make it clear which values are authoritative in a future backend.

Server-authoritative values in the eventual product include pricing, availability, coupons, delivery eligibility, fees, ETA, payment outcome and order status. The demo must not pretend that local calculations are authoritative production behaviour.

## 7. Tenant/location architecture

The storefront is not an A2-only application internally.

Create a clear configuration/context boundary for:

- business identity and slug;
- outlet/location identity and slug;
- brand name/logo/accent;
- outlet copy and ordering status;
- menu view preference;
- categories, products, featured products and imagery.

The exact route/host resolution mechanism may remain a documented seam until backend and hosting decisions are final. Do not add a second customer-facing outlet selector merely to demonstrate multi-location support.

## 8. UI architecture principles

Keep route files thin. A route should compose the page and its providers rather than contain the complete implementation.

Keep reusable UI primitives separate from product-specific composition, but do not create a shared monorepo package until both Admin and Storefront demonstrate stable, genuinely identical reuse.

Good candidates for eventual shared primitives include buttons, inputs, dialogs, sheets, icons and focus utilities. A customer product card, cart section or admin order card is not automatically shared just because both apps use cards.

Use accessible primitives and explicit state transitions for:

- bottom sheets;
- category navigator;
- list/grid switch;
- product counters;
- address picker;
- validation errors;
- fixed CTAs;
- order-status progress.

## 9. Mock/demo boundary

The rebuild must remain fully usable without a backend.

Place seed content, demo adapters and deterministic transition behaviour behind an obvious boundary chosen after the audit. Avoid scattering A2-specific arrays through route components.

It is acceptable to have a temporary local implementation such as:

```text
catalog data source → local seed adapter
cart data source → local/session persistence
delivery quote → deterministic demo adapter
payment boundary → explicit stub
order tracking → deterministic demo state machine
```

Do not label a demo stub as a real gateway, live order API or production delivery calculation.

## 10. Repository and dependency rules

Before changing structure, inspect:

- package manager and lockfile;
- scripts and build commands;
- framework and router;
- existing PWA configuration;
- styling and asset conventions;
- current source entrypoints;
- public/static asset handling;
- test/lint/typecheck setup;
- deployment configuration;
- existing unused or misleading infrastructure.

Preserve the current package manager and working toolchain unless there is a concrete reason to change them. Do not add Drizzle, SQLite or another ORM/migration system for this frontend-only rebuild. Supabase PostgreSQL will be the later backend direction.

Do not add dependencies just because they might be useful. First check whether the current project already provides the capability.

## 11. Analysis-first workflow

### Phase 0 — read-only audit

Codex should not edit source during this phase.

It should report:

- current repository structure;
- current entrypoints and routes;
- existing state/data flow;
- current dependencies and scripts;
- PWA and asset handling;
- observed public-site screens and interactions;
- discrepancies between code, public site and reference media;
- proposed implementation and folder boundaries;
- risks and unresolved decisions.

### Phase 1 — architecture approval

The user reviews the proposed folders and boundaries. Codex must not treat its initial proposal as approved automatically.

### Phase 2 — foundation and parity implementation

Implement the approved structure while preserving the current visual and behavioural experience. Keep changes reviewable and validate after each coherent slice.

### Phase 3 — verification

Run the existing checks, start the local app, inspect mobile and desktop states, and compare against the supplied reference media and public Site. Report what is exact, approximate, stubbed or unresolved.

## 12. Verification requirements

At minimum, verify:

- menu initial state;
- category navigation and scroll-aware navigator;
- list/grid switching;
- featured and regular product add paths;
- product-detail and configuration sheets;
- plus/minus quantity changes and removal;
- sticky cart access;
- cart editing and `Add more` return position;
- coupon states;
- Delivery/Pickup switching;
- custom area picker;
- missing-address validation and mobile focus/scroll;
- delivery loading, available and out-of-range states;
- payment boundary;
- securing loader;
- 90-second cancellation state;
- order tracking and pickup completion;
- responsive and keyboard-accessible behaviour.

## 13. Definition of a good final structure

The final structure is good when:

- a new engineer can find route composition, UI primitives, domain behaviour and data adapters without searching a giant page file;
- screen components do not own provider-specific data access;
- future TanStack Query integration has natural homes without forcing fake queries today;
- future Supabase integration can replace adapters without rewriting the visual layer;
- tenant/location assumptions are explicit and not buried in A2-only constants;
- the structure reflects actual responsibility discovered in the audit;
- no speculative empty folders or premature shared packages exist;
- the app remains runnable and visually equivalent to the approved reference.
