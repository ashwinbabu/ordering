# A2 Ordering Admin Frontend Architecture

**Status:** Approved target direction for the Admin frontend refactor  
**Purpose:** Durable architectural source of truth for repository restructuring and subsequent frontend work  
**Scope:** Admin frontend and its future integration boundaries. This document does not authorize live Supabase integration or database changes.

---

## 1. Product context

A2 Ordering is a multi-tenant restaurant direct-ordering SaaS.

The intended product contains:

1. an Admin application for restaurant operators;
2. a Storefront/PWA for customers;
3. a shared Supabase backend providing Postgres, Auth, RLS, Storage, Realtime, and narrowly scoped RPCs and/or Edge Functions where appropriate.

At the beginning of this refactor, only the real Admin application exists in this repository.

The Admin application must remain the working application throughout the migration. The refactor is not permission to create a parallel implementation, mock application, or redesign.

---

## 2. Engineering quality bar

All architectural and refactoring work should be performed with the judgment expected of a principal-level React/TypeScript engineer with deep experience from React's early ecosystem through modern React.

Apply best practices where they improve the real codebase, especially in:

- component boundaries;
- state ownership;
- TypeScript modeling;
- route composition;
- accessibility;
- responsive behavior;
- dependency direction;
- testability;
- server-state boundaries;
- API boundaries;
- naming;
- change isolation;
- build and deployment maintainability.

Best practice does **not** mean maximum abstraction.

Prefer:

- proven React patterns over novelty;
- local ownership over unnecessary global state;
- feature cohesion over layer sprawl;
- explicit data flow over hidden coupling;
- composition over premature framework-building;
- real reuse over speculative shared packages;
- small validated migrations over large rewrites.

During this restructuring, behavior preservation takes priority over architectural elegance. Improve architecture by moving existing working behavior into the correct ownership boundaries, not by opportunistically rewriting it.

---

## 3. Primary migration objective

The current Admin application has most or all UI composition, local application state, demo data, interactions, dialogs, and page rendering concentrated in an oversized `page.tsx`.

The migration objective is to:

1. establish a monorepo shell;
2. move the existing Admin application intact under `apps/admin`;
3. keep the framework's required routing conventions intact;
4. make the framework route entry thin;
5. extract app-wide layout;
6. extract genuinely shared UI primitives;
7. extract feature screens and feature-owned components;
8. move state to the narrowest correct owner;
9. preserve all observable behavior;
10. prepare clean future boundaries for TanStack Query and Supabase without fabricating live integrations.

This is an extraction and ownership exercise, not a product rewrite.

---

## 4. Repository direction

The intended high-level repository direction is:

```text
a2-ordering/
├── AGENTS.md
├── docs/
│   └── admin-frontend-architecture.md
├── apps/
│   └── admin/
├── packages/              # only real shared packages when reuse is proven
├── supabase/              # only real existing/approved Supabase assets
├── package.json
└── <existing package-manager lockfile>
```

### Important constraints

- Preserve the existing package manager.
- Preserve the current framework.
- Preserve the current router.
- Preserve the framework's file-system conventions.
- Do not introduce Turborepo, Nx, or another orchestration layer unless separately approved.
- Do not create a fake `apps/storefront`.
- Do not create speculative shared packages.
- Do not manufacture Supabase files to make the tree look complete.
- Do not create empty architecture folders without real code.

The repository may reserve the conceptual namespace for future apps/packages, but implementation should contain only real code.

---

## 5. Admin application direction

Adapt this structure to the actual framework discovered in the repository:

```text
apps/admin/
├── src/
│   ├── <framework route directory>/
│   │   ├── <thin route files>
│   │   └── <thin layout files where required>
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── outlet-context/
│   │   ├── ordering-status/
│   │   ├── orders/
│   │   ├── menu/
│   │   └── business-settings/
│   │
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   │
│   ├── lib/
│   │   ├── supabase/        # only when real integration code exists
│   │   └── query-client.ts  # only when TanStack Query is actually introduced
│   │
│   └── styles/
│
├── public/
├── package.json
└── <framework configuration>
```

The exact placement of framework route files is determined by the actual framework. Framework-required files must remain in the locations required by that framework.

Do not move files merely to make the repository resemble this example if the framework requires another arrangement.

---

## 6. Route architecture

Framework route files should be intentionally thin.

A route file should normally:

- satisfy framework routing conventions;
- import the relevant application or feature screen;
- pass route-level values where appropriate;
- avoid owning substantial feature UI or business logic.

Conceptually:

```text
framework route
→ feature screen
→ feature components/hooks
```

The route is not the feature.

Substantial page composition belongs in a named feature screen or app composition boundary.

---

## 7. App-wide layout ownership

App-wide layout components belong under the Admin application's layout component area.

Expected responsibilities include:

- `AppShell`
- `Sidebar`
- `Header`
- desktop navigation
- responsive/mobile navigation
- shared navigation model
- branch/location menu presentation where it is part of the global shell

Layout components may consume application scope such as the active outlet or ordering status, but they should not own feature-specific business state merely because they render a control.

For example, the Sidebar may render the Kill switch, but the accepting-orders state is owned by `ordering-status`.

---

## 8. Shared UI ownership

`components/ui` is for genuine design-system-level primitives used across features.

Examples, if they are genuinely shared in the existing implementation:

- Button
- Dialog
- Toggle
- Input
- Select
- DropdownMenu
- Toast/feedback surface
- reusable form controls

Rules:

- preserve existing variants, visuals, and behavior during extraction;
- do not create a generalized design-system framework during this refactor;
- feature-specific components stay inside their feature even if they look reusable at first glance;
- promote components only when cross-feature reuse is real.

---

## 9. Feature boundaries

### 9.1 `auth`

Owns:

- authentication screens;
- OTP prototype flow;
- authentication-specific local state;
- auth-specific components;
- auth-specific feature hooks when justified.

Future responsibility:

- integration boundary for Supabase Auth.

Current constraint:

- do not connect Supabase Auth during the restructuring unless separately authorized.

---

### 9.2 `outlet-context`

Owns frontend application scope for the active:

- business;
- location/outlet;
- branch selection.

This context answers:

> Which business/location is the operator currently viewing?

It does **not** answer:

> What is this user authorized to access?

Authorization remains a backend/database concern enforced through Supabase Auth, RLS, and trusted backend functions.

The outlet context should be narrowly scoped and should not become a general application-state container.

**Authorization is business-scoped, not location-scoped, and that is deliberate.** `core.business_users` records membership per business only; there is no per-location membership table. Any active `owner`/`admin`/`manager` of a business can read and write every outlet belonging to that business through the database's RLS policies and RPC checks (`private.can_manage_catalog_at_location`, `private.is_active_location_member`, `private.can_manage_sensitive_location_configuration`, etc. all resolve the location to its business and check business-level membership, despite the location-scoped names). This matches the product's expectations for a small multi-outlet restaurant, where staff operate any of their outlets. `activeLocation` here is purely which outlet the operator is currently viewing — never a narrower authorization boundary. The database would allow the same operator to act on any other outlet of the same business regardless of what is selected. If per-outlet staff assignment is ever required, it needs a `business_user_locations` join table and a narrowing of the three helper functions above, not a frontend change.

---

### 9.3 `ordering-status`

Owns the restaurant-wide accepting-orders state.

Known consumers include:

- Orders screen accepting-orders toggle;
- Sidebar Kill switch;
- Business Settings accepting-orders control.

There must be exactly **one frontend source of truth** for this state.

Controls may have feature-specific presentation, but they must synchronize through the same underlying state owner.

Future server integration may replace or hydrate this state, but the UI must not have competing independent copies.

---

### 9.4 `orders`

Owns the Orders feature, including existing behavior for:

- `OrdersScreen`;
- order filters;
- order cards;
- long-item scrolling region;
- order details;
- order status actions/transitions;
- cancellation confirmation;
- contact interactions;
- copy interactions;
- KOT view and printing;
- Orders fixtures;
- Orders-specific types.

State should remain local to the Orders feature unless it is genuinely application-wide.

Orders must not become the owner of global outlet scope or restaurant-wide ordering status.

---

### 9.5 `menu`

Owns both Menu Availability and Edit Menu behavior.

Responsibilities include:

- Menu Availability screen;
- Edit Menu screen;
- category rows and actions;
- product rows and actions;
- product duplication;
- product deletion;
- staged menu state;
- committed/saved menu snapshot;
- discard/reset behavior;
- custom unsaved-changes confirmation;
- product slide-over editor;
- separate live customer preview;
- variants;
- add-ons;
- price validation;
- scheduling/availability controls;
- Menu fixtures;
- Menu schemas where they provide real validation value;
- Menu types.

#### Critical menu invariants

These are behavior-preservation requirements, not optional implementation details:

- staged edits must remain staged until Save;
- unsaved product/category deletion must not survive discard;
- duplicates must use `Copy of [name]`;
- price inputs must preserve the existing two-decimal limit;
- clicking product content must continue to open editing;
- the customer preview must remain separate from and visually above the dimmed editor background;
- the preview must contain exactly one customer-style product card;
- empty descriptions remain hidden;
- the custom confirmation flow must remain custom;
- browser `alert`, `confirm`, or `beforeunload` must not replace the existing in-app unsaved-change experience unless a future product decision explicitly changes it.

State may be split into focused hooks where substantial logic warrants it, but do not flatten staged state, committed state, editor state, and modal state into one giant global store.

---

### 9.6 `business-settings`

Owns Business Settings behavior for the active outlet.

Responsibilities include:

- `BusinessSettingsScreen`;
- settings section navigation;
- General;
- Ordering;
- Opening Hours;
- Tax;
- Delivery;
- Commercials;
- section-level save behavior;
- sticky unsaved action bar;
- custom discard dialog;
- delivery-zone overlap validation;
- success feedback;
- loading states;
- empty states;
- Business Settings fixtures;
- schemas where real validation warrants them;
- feature types.

The accepting-orders control displayed in Business Settings consumes `ordering-status`; Business Settings must not create a second independent source of truth.

Unfinished settings form state remains feature-owned until committed.

---

## 10. State ownership principles

The primary rule is:

> State should live with the narrowest owner that needs to coordinate it.

### Application/shared state

Use narrow providers only where the state is genuinely shared.

Approved shared ownership:

| State | Intended owner | Reason |
|---|---|---|
| active business | `outlet-context` | app-wide operator scope |
| active location/outlet | `outlet-context` | app-wide operator scope |
| accepting-orders | `ordering-status` | synchronized across multiple surfaces |

### Feature state

Examples that should remain feature-owned:

- order filters;
- active order details;
- order dialogs;
- menu staged edits;
- menu committed snapshot;
- product editor state;
- menu unsaved-change dialog;
- Business Settings unfinished form state;
- Business Settings section navigation;
- feature-specific modal state.

### Component-local state

Keep purely presentational/transient state local where practical, such as:

- a local dropdown open state;
- a local disclosure;
- transient input focus/presentation state;
- modal open state when only one owner needs it.

### Explicit anti-patterns

Do not:

- move all `page.tsx` state into one global provider;
- create a context per trivial value;
- use TanStack Query for local prototype state;
- use a global store merely to reduce prop passing;
- collapse staged and committed state boundaries;
- duplicate shared operational state across features.

---

## 11. Derived state, effects, and callbacks

During extraction, preserve existing behavior before improving internal shape.

For every derived value, callback, and effect currently in `page.tsx`:

1. identify what source state it depends on;
2. identify which feature or component consumes it;
3. move it with the narrowest correct owner;
4. preserve timing and user-visible behavior;
5. avoid adding an effect when the value can remain derived;
6. avoid unnecessary memoization;
7. avoid changing dependency behavior merely for stylistic cleanup.

Do not translate existing working logic into a different architectural pattern during the same extraction unless required to preserve correctness.

---

## 12. Fixtures, types, and schemas

Prototype/demo data should remain synchronous prototype data until a real API integration task replaces it.

Rules:

- feature fixtures belong with the feature they model;
- feature-specific types belong with that feature;
- schemas belong with the feature only where runtime validation or form validation makes them meaningful;
- do not create schemas solely to fill a folder;
- do not turn fixtures into fake Promise-based APIs;
- do not manufacture a service layer around static data without a real migration benefit.

Shared domain types should not be promoted into `packages/domain` until genuine cross-application reuse is proven after another app, such as Storefront, exists.

---

## 13. Future TanStack Query boundary

TanStack Query is intended for real remote/server state.

Do not introduce it during a behavior-preserving extraction merely because the future architecture uses it.

When server integration is implemented, prefer:

```text
feature screen/component
        ↓
feature query / mutation
        ↓
feature API module
        ↓
typed application Supabase client
```

Example future shape:

```text
features/orders/
├── api/
│   └── orders-api.ts
├── components/
├── hooks/
├── screens/
├── queries.ts
├── mutations.ts
└── types.ts
```

Only create the files/folders that contain real code.

### Query-key scope

Outlet-specific data must include business/location scope in the key.

Conceptually:

```ts
["orders", businessId, locationId, filters]
["menu", businessId, locationId]
["business-settings", businessId, locationId]
```

The exact key factory design should be introduced when real queries exist, not prebuilt speculatively.

### Mutation discipline

Mutations should:

- call feature API modules rather than scatter direct Supabase operations through React components;
- invalidate or update only the relevant scoped queries;
- preserve business/location scope;
- avoid broad cache invalidation where precise invalidation is practical.

---

## 14. Future Supabase boundary

The application-specific Supabase client belongs under:

```text
apps/admin/src/lib/supabase/
```

when real integration is introduced.

Expected future responsibilities may include:

- browser client creation;
- generated `database.types.ts` or equivalent generated types;
- application-specific Supabase configuration.

Rules:

- generated database types are generated, not handwritten;
- feature-specific data operations live near their features;
- React components should not eventually contain scattered direct calls such as `supabase.from(...)`;
- do not expose service-role credentials to browser code;
- do not invent environment variables;
- do not use frontend outlet context as authorization;
- RLS remains the real tenant/user authorization boundary.

Example future API ownership:

```text
features/orders/api/orders-api.ts
features/menu/api/menu-api.ts
features/business-settings/api/business-settings-api.ts
```

Do not create these modules until real API behavior exists or the migration task explicitly requires a useful boundary around existing code.

---

## 15. Shared-package policy

A monorepo does not imply that shared packages must exist immediately.

For the current phase:

- keep Admin UI primitives inside `apps/admin`;
- keep feature types inside their features;
- keep application-specific Supabase code inside `apps/admin`;
- do not create `packages/ui` merely in anticipation of Storefront;
- do not create `packages/domain` merely in anticipation of shared enums;
- do not create `packages/config` unless there is a real shared configuration use case.

Promote code into `packages/*` only when at least two real consumers make the ownership boundary valuable.

The cost of premature sharing is tighter coupling between apps and harder independent evolution.

---

## 16. Dependency direction

Prefer dependencies to flow inward toward stable, narrow ownership:

```text
framework route
    ↓
feature screen / app shell
    ↓
feature components + feature hooks
    ↓
feature types / feature API boundary
    ↓
application infrastructure
```

Cross-feature imports should be uncommon.

A feature should not reach into another feature's internal components or private state.

If multiple features require the same operational state, that is a signal for a narrowly scoped shared application feature such as `ordering-status`, not a reason for one feature to import another feature's internals.

---

## 17. Monorepo workspace principles

The monorepo shell should initially do the minimum required to host the existing Admin application cleanly and support a future Storefront.

Batch 1 should preserve:

- existing package manager;
- existing lockfile;
- framework behavior;
- router behavior;
- existing application behavior;
- existing deployment behavior, with only path/config changes required by the move.

Do not introduce orchestration tooling without need.

Root scripts may delegate to the Admin workspace where useful, but the exact workspace syntax must match the existing package manager.

Deployment configuration must be updated only as necessary for the Admin app's new location.

---

## 18. Framework conventions

The repository audit is authoritative for the actual framework and router.

If `page.tsx` is a framework route file, its required location and associated route/layout conventions must remain valid.

Files required by the framework must remain where the framework expects them, even if a different directory would look architecturally cleaner.

The target architecture should adapt to the framework, not fight it.

---

## 19. Behavioral parity is a release requirement

The refactor is successful only if observable behavior remains equivalent unless a task explicitly authorizes a behavior change.

Parity includes:

- visual layout;
- spacing;
- responsive behavior;
- wording;
- navigation;
- controls;
- dialogs;
- menu editing;
- staged changes;
- discard behavior;
- order interactions;
- KOT behavior;
- branch/location selection;
- synchronized accepting-orders state;
- Business Settings behavior;
- loading/empty/success feedback already present;
- desktop behavior;
- mobile behavior.

Do not treat a successful TypeScript build as proof of behavioral parity.

Where browser automation or browser verification is available, use it for important desktop and mobile surfaces.

---

## 20. Refactor sequencing

The approved migration should proceed through independently validated stages.

### Batch 1 — monorepo shell

Objective:

- establish the monorepo workspace shell;
- move the existing Admin application intact under `apps/admin`;
- update required paths, scripts, config, and deployment assumptions;
- prove the application still builds and runs;
- keep the large `page.tsx` implementation intact.

No component extraction occurs in this batch.

### Batch 2 — app shell and shared primitives

Use small passes.

First extract app-wide layout:

- AppShell;
- Sidebar;
- Header;
- branch/location selector presentation;
- responsive/mobile navigation;
- shared navigation model.

Then extract only genuinely reusable UI primitives already present in the source.

Validate after every pass.

### Batch 3 — feature extraction

Extract feature ownership in small independently validated passes:

1. auth;
2. outlet context + ordering status;
3. Orders;
4. Menu;
5. Business Settings.

The precise extraction order may be adjusted if the audited dependency graph demonstrates that another order is safer, but changes to the approved order should be explained before implementation.

### Batch 4 — boundary cleanup

After behavior-preserving extraction is complete:

- clean feature-local types;
- clean fixtures;
- add schemas only where useful;
- remove accidental cross-feature coupling;
- add future TanStack/Supabase boundaries only where they provide real migration value;
- do not connect live APIs unless separately approved.

Batch 4 is not automatic.

---

## 21. Extraction discipline

For each extraction pass:

1. inspect the source implementation being moved;
2. identify its source state, derived state, callbacks, effects, types, fixtures, and visual dependencies;
3. define the narrowest correct owner;
4. move the implementation rather than rewriting it;
5. fix imports;
6. run the fastest relevant validation;
7. verify no duplicate source implementation remains;
8. verify relevant behavior;
9. record what moved;
10. stop or continue only according to the current task.

Do not mix multiple feature rewrites into one diff merely because they originate in the same `page.tsx`.

---

## 22. State-specific migration invariants

### Accepting orders

Exactly one source of truth.

All of these must remain synchronized:

- Orders toggle;
- Sidebar Kill switch;
- Business Settings control.

### Menu

Preserve the distinction between:

- committed/saved menu data;
- staged edits;
- product editor state;
- confirmation/dialog state;
- preview presentation.

Discard must restore committed state.

Save must commit staged state.

### Business Settings

Unfinished form state belongs to the feature.

Section save behavior and unsaved-change behavior must remain intact.

### Auth

Prototype behavior must continue to work without prematurely connecting Supabase Auth.

---

## 23. Naming principles

Prefer names that communicate ownership and behavior.

Good examples:

```text
OrdersScreen.tsx
OrderCard.tsx
OrderDetails.tsx
useOrderFilters.ts
menu-fixtures.ts
menu-types.ts
business-settings-schema.ts
orders-api.ts
```

Avoid vague names such as:

```text
utils.ts
helpers.ts
common.ts
misc.ts
shared.ts
data.ts
service.ts
manager.ts
```

A module name should make its purpose understandable without opening the file.

---

## 24. Performance principles

Do not introduce premature optimization during extraction.

Use React memoization only when it addresses a real rendering or identity problem.

Prefer reducing state scope and unnecessary re-render ownership over adding widespread `useMemo`, `useCallback`, or `memo`.

Do not change rendering behavior during a parity refactor unless required for correctness.

When future server state is introduced, TanStack Query should handle remote caching rather than custom ad hoc caches.

---

## 25. TypeScript principles

Preserve or improve type safety while extracting.

Prefer:

- domain-specific types;
- discriminated unions where they clarify state;
- narrow component props;
- explicit nullable/optional semantics;
- feature-owned types;
- generated database types for Supabase records.

Avoid:

- unnecessary `any`;
- giant all-feature types files;
- duplicating the same domain shape under multiple names;
- leaking framework-specific types deep into feature logic without need.

Do not perform a broad type-system rewrite during a behavior-preserving extraction.

---

## 26. Accessibility and responsive preservation

Existing interaction semantics and responsive behavior are part of observable behavior.

During extraction:

- preserve keyboard behavior already present;
- preserve focus behavior where possible;
- preserve labels and accessible names;
- preserve responsive breakpoints and layout behavior;
- preserve dialog/modal layering;
- preserve mobile navigation behavior;
- avoid changing DOM structure in ways that unintentionally break CSS unless required by the extraction.

If an obvious accessibility defect is discovered but fixing it would change behavior or broaden scope, report it separately unless the current task permits the fix.

---

## 27. Testing and validation philosophy

Validation should be layered.

During a pass, run the fastest useful checks to catch structural errors early.

At completion of a batch, run the repository's complete configured checks.

Depending on what the repository actually provides, this may include:

- formatter;
- lint;
- TypeScript;
- unit/integration tests;
- production build;
- application startup;
- browser verification.

For parity-sensitive refactors, manually or automatically verify the affected UI surfaces rather than relying only on static checks.

Pre-existing failures must be reported separately from newly introduced failures.

---

## 28. Architecture changes

This document is an approved source of truth, but it is not immutable.

If implementation evidence shows that an architectural decision should change:

1. do not silently deviate;
2. explain the conflict;
3. propose the smallest justified change;
4. wait for approval when the change is material;
5. update this document when the architectural decision is approved.

Repository architecture should reflect deliberate decisions, not accidental drift.

---

## 29. Definition of success

The Admin frontend restructuring is successful when:

- the repository has a clean monorepo foundation;
- the real Admin application lives cleanly under `apps/admin`;
- framework route files are thin;
- feature ownership is obvious;
- state has narrow, intentional owners;
- accepting-orders has one source of truth;
- staged menu and settings behavior remains correct;
- genuinely shared UI is separated from feature UI;
- no speculative shared packages or fake APIs exist;
- future TanStack Query integration has a clean boundary;
- future Supabase integration has a clean boundary;
- the application builds, runs, and behaves as before;
- another capable React engineer or coding agent can understand where new code belongs without reading one enormous `page.tsx`.

That is the standard for the migration.
