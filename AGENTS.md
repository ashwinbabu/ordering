# Ordering App — Claude Repository Instructions

This file is the canonical repository-wide instruction set for Claude.

It applies to the entire monorepo, including:

* `apps/storefront/`
* `apps/admin/`
* `supabase/`
* shared code
* scripts
* configuration
* integrations
* database work
* infrastructure-related application code

Do not rely on older nested `AGENTS.md`, `CLAUDE.md`, or historical rebuild instructions if they conflict with this file.

The project has moved beyond the original frontend-only reconstruction stage.

Backend work, Supabase integration, authentication, database changes, Realtime, Storage, payments, messaging integrations, server-side code, APIs, PWA work, and other production functionality are now legitimate areas of work **when required by the current task**.

---

# 1. Product context

This repository contains a multi-tenant direct-ordering platform for restaurants.

There are currently two primary applications:

* **Storefront app** — customer-facing ordering experience.
* **Admin app** — restaurant/operator-facing management experience.

The first customer is **A2 Food & Beverages**.

A2 is a restaurant/customer of the platform. It is **not the name of the software product**.

When discussing the software, use terms such as:

* the app
* the storefront app
* the admin app
* the ordering platform

Avoid baking A2-specific assumptions into reusable application architecture.

A2 and its current location(s) may be used as development/test tenant data.

The architecture should continue moving toward a maintainable multi-business, multi-location SaaS rather than an application designed specifically around one restaurant.

---

# 2. Engineering standard

Work with the judgment expected of a principal-level full-stack React/TypeScript engineer with strong experience in:

* modern React
* TypeScript
* TanStack Query
* Supabase/Postgres
* authentication
* browser/session state
* APIs
* payment integrations
* real-time applications
* secure multi-tenant SaaS architecture
* responsive web applications
* PWAs

Optimize for:

1. correctness;
2. security;
3. maintainability;
4. clear ownership;
5. predictable data flow;
6. good user experience;
7. strong TypeScript contracts;
8. minimal accidental coupling;
9. efficient server-state management;
10. scalable multi-tenant architecture;
11. simplicity where additional abstraction provides negligible value.

Do not use patterns merely because they are fashionable.

Prefer the simplest solution that satisfies the real product requirements without creating obvious future migration problems.

Avoid premature abstraction, but do not knowingly create architecture that will need to be immediately replaced when another restaurant or location is added.

---

# 3. Instruction priority

When information conflicts, use this hierarchy:

1. **The user's current task or explicit instruction**
2. **This root `CLAUDE.md`**
3. **Current repository implementation and verified backend state**
4. **Current architecture/product documentation**
5. **Historical documentation, demo code, comments, seed assumptions, and old planning documents**

A newer explicit user instruction overrides an older architectural assumption.

Documentation may contain historical restrictions from earlier stages of development.

For example, statements such as:

* frontend only;
* do not integrate Supabase;
* no authentication;
* no backend;
* demo data only;
* stop after audit;
* do not create SQL;
* wait for approval before implementation;

should **not** be treated as current restrictions unless the current task explicitly reinstates them.

When a document contains useful product or UX information alongside obsolete implementation restrictions, preserve the useful information and disregard the obsolete restriction.

Do not silently allow stale documentation to block a clearly requested task.

---

# 4. Inspect before changing

Before making meaningful changes, inspect the relevant repository state.

At minimum, inspect what is necessary to understand:

* the relevant source files;
* nearby components/modules;
* package configuration;
* package manager and lockfile;
* framework configuration;
* routing;
* TypeScript configuration;
* environment-variable usage;
* Supabase client setup where relevant;
* TanStack Query setup where relevant;
* database types where relevant;
* existing APIs/RPCs/migrations where relevant;
* existing tests and validation commands;
* Git worktree state for substantial changes.

Do not invent repository facts that can be determined by inspecting the code.

Do not assume a file or abstraction exists because an architecture document mentions it.

Do not create duplicate infrastructure when an appropriate implementation already exists.

---

# 5. Default execution behaviour

Unless the user explicitly requests an audit, proposal, review, plan, or approval checkpoint, the default behaviour is:

**understand the task → inspect relevant code → implement fully → validate → report**

Do not artificially split straightforward work into multiple phases.

Do not stop after analysis merely because the change affects multiple files.

Do not request approval between routine implementation steps.

Do not create unnecessary checkpoints.

For a task that can reasonably be completed safely in one coherent pass, complete it in one coherent pass.

Ask a question only when an answer is genuinely required to avoid a materially incorrect, destructive, insecure, or impossible implementation.

When a reasonable implementation can be inferred from:

* repository conventions;
* existing schema;
* current architecture;
* surrounding code;
* the user's stated product requirements;

make the best engineering decision and proceed.

---

# 6. Scope discipline

Implement the complete requested scope.

Do not interpret “scope discipline” as “frontend only.”

A requested feature may legitimately require coordinated changes across:

* storefront UI;
* admin UI;
* shared application logic;
* Supabase;
* migrations;
* RLS;
* RPCs;
* Auth;
* Storage;
* Realtime;
* Edge Functions;
* third-party APIs;
* payment infrastructure;
* server-side endpoints;
* environment configuration;
* generated types.

Make those changes when they are genuinely necessary to implement the requested feature correctly.

At the same time, do not combine a task with unrelated:

* redesigns;
* copy rewrites;
* route changes;
* dependency upgrades;
* architecture migrations;
* database cleanup;
* speculative abstraction;
* refactors;
* feature additions.

Do not fix unrelated problems merely because they are nearby.

If an unrelated issue creates significant risk, report it separately.

---

# 7. Repository architecture

Keep application boundaries clear.

## Storefront

Customer-facing ordering functionality belongs under the storefront application unless there is demonstrated cross-application reuse.

Examples include:

* menu browsing;
* featured products;
* product configuration;
* cart;
* checkout;
* customer details;
* addresses;
* login/OTP;
* customer account;
* order history;
* payment initiation;
* order tracking;
* storefront session recovery.

## Admin

Restaurant/operator functionality belongs under the admin application.

Examples include:

* order management;
* menu management;
* featured products;
* category/product availability;
* coupons;
* restaurant settings;
* location settings;
* operational controls;
* analytics;
* staff/operator workflows.

## Shared code

Move code into shared packages or shared modules only when there is genuine stable reuse.

Do not create a shared package because two files happen to look similar.

Avoid creating speculative package architecture before real reuse exists.

---

# 8. Architecture documentation

Before substantial Admin architectural work, read:

`docs/admin-frontend-architecture.md`

Before substantial Storefront architectural or UX work, read the relevant sections of:

`docs/storefront-rebuild-brief.md`

and:

`docs/storefront-architecture.md`

These documents are useful context, not immutable law.

Use them to understand:

* intended UX;
* design behaviour;
* flows;
* state boundaries;
* previous architectural decisions.

Do **not** allow historical frontend-only restrictions inside these documents to override this file or the current task.

If the implementation has legitimately evolved beyond the document, prefer the verified current implementation and report meaningful documentation drift.

---

# 9. React architecture

Keep framework entrypoints, route files, and page files reasonably thin.

They should primarily compose application features rather than contain large amounts of unrelated business logic.

Feature-specific behaviour belongs with the corresponding feature.

Prefer clear ownership such as:

screen/component
→ feature hook/query/mutation
→ feature API/data-access module
→ infrastructure/client

when that separation genuinely helps.

Do not blindly create layers for tiny operations.

Do not create placeholder architecture such as empty:

* `api/`
* `queries/`
* `mutations/`
* `hooks/`
* `types/`

folders merely because an architecture diagram contains them.

Create abstractions when real implementation requires them.

---

# 10. React state

Distinguish between:

### Local UI state

Examples:

* modal visibility;
* selected tab;
* temporary form values;
* expanded/collapsed state;
* animation state.

Keep this close to the component or feature that owns it.

### Persisted browser state

Examples:

* anonymous cart;
* unfinished checkout context;
* selected location where appropriate;
* recoverable customer flow state.

Use an intentional persistence mechanism appropriate to the lifecycle requirements.

### Server state

Examples:

* products;
* menu;
* orders;
* customer profile;
* addresses;
* coupons;
* payment status;
* restaurant settings.

Server state should generally be managed through TanStack Query or an equivalent established application boundary.

Do not put remote server state into arbitrary React global state simply to avoid queries.

Do not use TanStack Query as a replacement for normal local UI state.

---

# 11. TanStack Query

TanStack Query is an important server-state layer for both applications where appropriate.

Use it efficiently rather than merely wrapping every async function in `useQuery`.

Design query keys deliberately.

For tenant/location-sensitive resources, include the appropriate business/location identity in the key.

For example, conceptually:

`['menu', businessId, locationId]`

rather than:

`['menu']`

Configure:

* stale times;
* cache lifetimes;
* retries;
* refetch behaviour;
* invalidation;
* optimistic updates;

according to the actual semantics of the resource.

Do not use default retry behaviour blindly for operations where retries may be harmful.

Examples include certain:

* payments;
* order creation;
* irreversible mutations.

Do not create fake asynchronous APIs or fake query hooks around static demo data.

When converting local/demo data to a real backend integration, remove or clearly isolate the obsolete demo path rather than maintaining two competing sources of truth indefinitely.

---

# 12. Supabase is a first-class backend

Supabase is the primary backend platform for the ordering application.

Backend integration is **allowed and expected** when required by the task.

This can include:

* PostgreSQL schema changes;
* SQL migrations;
* RLS;
* RPC functions;
* authentication;
* OTP;
* Storage;
* Realtime;
* Edge Functions;
* indexes;
* constraints;
* database functions;
* permissions;
* generated TypeScript types;
* database-backed server state.

Do not avoid a correct backend solution merely because an old document described the storefront as frontend-only.

---

# 13. Supabase data-access architecture

Keep provider-specific Supabase access out of deeply nested presentation components.

Prefer a clean data boundary.

Conceptually:

UI
→ feature query/mutation
→ feature data/API function
→ application Supabase client

This does not require four files for every operation.

Use judgment.

Keep business logic in the most appropriate layer.

Avoid scattering direct `.from(...)` calls throughout unrelated UI components when a feature-level data-access boundary would make ownership clearer.

---

# 14. Database changes

When a task requires database changes, they are allowed.

Before changing schema:

1. inspect the existing relevant schema;
2. inspect migrations where available;
3. inspect existing relationships and constraints;
4. determine whether an existing table/RPC can support the requirement;
5. avoid creating duplicate concepts.

For durable schema changes, prefer tracked migrations.

Do not casually mutate the database into a state that cannot be recreated from repository history.

If the repository and remote migration history have existing drift, do not attempt unrelated history repair as part of another feature unless it blocks the feature.

A development database containing disposable test data may allow more aggressive iteration than production, but schema design should still be deliberate.

---

# 15. RLS and public access

This product intentionally includes unauthenticated storefront behaviour.

Anonymous access is not automatically a security problem.

Public customers must be able to read data intentionally exposed for storefront operation, such as appropriate public restaurant/menu information.

However:

**publicly readable does not mean publicly writable.**

Use RLS, grants, RPCs, or another suitable boundary to ensure anonymous users can access only what they legitimately need.

Customer-private data must remain protected.

Examples include:

* customer identity;
* addresses;
* authenticated order history;
* private account information.

Operator/admin access must be tenant-scoped.

Never rely only on frontend filtering to enforce tenant boundaries.

---

# 16. Multi-tenancy

Treat multi-tenancy as a core requirement.

Important data operations should preserve correct:

* business scope;
* location/outlet scope;
* customer scope;
* operator membership scope.

Do not assume every business has only one location.

Do not embed A2-specific IDs throughout feature logic.

Development defaults may temporarily resolve to the A2 test business/location where the current implementation requires it, but isolate such assumptions so they can be replaced cleanly.

URL/business/location resolution should ultimately be an application concern rather than duplicated throughout components.

---

# 17. Generated database types

Use generated Supabase/Postgres TypeScript types when available.

Do not manually rewrite generated database types to make TypeScript errors disappear.

If the schema changes, regenerate types using the repository's established process.

Application-specific types may wrap or derive from generated database types when useful.

Do not force UI components to consume raw database row shapes if a feature-specific domain shape is more maintainable.

---

# 18. Authentication and customer identity

Authentication is now valid application scope.

The intended customer experience includes both anonymous browsing and verified customer identity.

Preserve the distinction between:

* anonymous browser/session identity;
* authenticated customer identity;
* global customer identity;
* restaurant/business-specific customer relationships.

Do not require login simply to browse the public menu.

Where the product allows anonymous cart construction or pre-login checkout work, preserve that behaviour.

Authentication should occur at the appropriate point in the ordering journey rather than unnecessarily blocking discovery.

When anonymous state becomes authenticated, reconcile rather than blindly discard useful customer state.

---

# 19. Storefront session continuity

Treat browser/session recovery as a product requirement rather than incidental convenience.

When relevant to a task, consider states such as:

* anonymous browsing;
* anonymous cart persistence;
* refresh;
* browser close/reopen;
* temporary internet loss;
* anonymous → authenticated transition;
* authenticated session restoration;
* another device/browser;
* checkout interrupted before payment;
* browser closed during payment;
* completed payment before UI confirmation;
* return to an active order;
* completed order history.

Never blindly recreate a payment or order merely because the browser lost state.

The server's authoritative order/payment state must win.

---

# 20. Payments

Real payment integration is allowed when required.

The platform should generally act as the software layer initiating payment for the restaurant rather than unnecessarily becoming the merchant holding restaurant funds.

Keep payment-provider-specific logic behind a provider boundary where practical.

For example, application checkout logic should not become inseparably coupled to Razorpay-specific field names if multiple payment providers may later be supported.

Potential providers may include systems such as Razorpay or other restaurant payment providers.

Do not over-engineer a generic payment framework before a second implementation requires it, but preserve a clear seam.

Payment operations require special care around:

* idempotency;
* retries;
* server verification;
* order/payment reconciliation;
* callback/webhook handling;
* duplicate payment prevention;
* incomplete browser sessions;
* successful payments whose client confirmation was interrupted.

Never treat a client-side “success” screen as the sole authority that money was received.

Never expose secret payment credentials in browser code.

---

# 21. External integrations

External integrations are allowed when required by the task.

Examples may include:

* payment gateways;
* OTP/SMS providers;
* transactional messaging;
* Telegram;
* WhatsApp;
* delivery services;
* email;
* analytics.

Keep third-party implementation details behind reasonably clean boundaries where this meaningfully reduces coupling.

Do not build a large generic integration framework before it is needed.

Never place private API secrets into browser-delivered frontend bundles.

Use server-side mechanisms where credentials or signature verification require them.

---

# 22. Realtime

Supabase Realtime or another real-time mechanism may be used where the product benefits from it.

Examples include order status changes between the storefront and admin app.

Do not introduce real-time subscriptions everywhere merely because they exist.

Use them for state that genuinely benefits from timely server-driven updates.

Ensure subscriptions:

* are scoped correctly;
* are cleaned up correctly;
* do not leak tenant data;
* integrate cleanly with the TanStack Query cache when applicable.

---

# 23. Storage and media

Supabase Storage or another established media layer may be used for restaurant/product assets when required.

Do not hardcode large application content as local assets if the feature explicitly requires business-managed media.

Design paths/buckets and access policies with business ownership in mind.

Do not make private buckets public merely to bypass an authorization problem.

---

# 24. Menu and catalogue

The menu is real remote application state.

Where applicable, continue using the established storefront menu boundary rather than reverting to scattered hardcoded data.

Catalogue behaviour may involve:

* categories;
* products;
* location-specific availability;
* featured products;
* variants;
* modifiers/options;
* pricing;
* availability schedules;
* product images.

Maintain location-aware behaviour.

Avoid unnecessary client-side joins if a secure RPC or backend query can return the storefront shape more efficiently and clearly.

---

# 25. Cart

The cart is important persisted application state.

Preserve:

* selected product;
* variant;
* modifiers/options;
* quantities;
* instructions;
* pricing;
* location/business association.

Do not allow a cart created for one restaurant/location to silently become an order for another.

When remote pricing or availability changes, the server must ultimately validate the order rather than trusting stale client calculations.

---

# 26. Orders

Treat the database/server as authoritative for order state.

Order creation should be deliberate and idempotent where duplicate client requests are possible.

Do not allow repeated clicks, network retries, refreshes, or payment callbacks to accidentally create duplicate orders.

The admin and storefront applications may represent the same underlying order differently, but should not maintain conflicting business truth.

---

# 27. Coupons and pricing rules

Pricing logic that affects actual charged amounts must not rely exclusively on browser calculations.

The UI may provide immediate estimates, but the authoritative calculation should be validated by trusted backend logic before order/payment completion.

This applies to things such as:

* coupons;
* minimum order requirements;
* discount caps;
* delivery fees;
* tax;
* free-delivery thresholds;
* commissions where applicable.

Avoid duplicating complex pricing rules independently in multiple applications when a shared backend calculation can provide authoritative results.

---

# 28. Admin app guidance

For Admin work:

* preserve the existing clean operator-focused UI unless redesign is requested;
* keep selected outlet/location scope explicit;
* avoid burying operational actions under unnecessary abstraction;
* keep pages responsive;
* preserve existing workflows while integrating live data;
* use TanStack Query thoughtfully for server state;
* keep mutations and invalidation predictable.

Admin work may modify the backend if the requested admin feature requires backend support.

Do not assume Admin work is frontend-only.

---

# 29. Storefront UI preservation

The storefront has already undergone a substantial visual and UX build.

Unless the current task is specifically about design:

**do not substantially redesign it.**

When integrating backend functionality, preserve as much of the existing:

* layout;
* spacing;
* typography;
* component appearance;
* animations;
* responsive behaviour;
* navigation;
* interaction patterns;

as reasonably possible.

Backend integration should not become an excuse to rewrite visible UI.

Small UI changes that are necessary to correctly represent loading, empty, error, authentication, payment, or live data states are acceptable.

---

# 30. Demo and hardcoded data

The project historically used demo/seed data during storefront reconstruction.

Do not preserve demo data indefinitely when a requested feature replaces it with real backend data.

When integrating a feature:

* identify the existing hardcoded/demo source;
* replace it with the real data boundary where appropriate;
* remove obsolete parallel logic where safe;
* retain fixtures only when they are still useful for testing/development.

Avoid having real Supabase data and old demo data silently compete as two sources of truth.

---

# 31. Error handling

Implement meaningful user-facing states for relevant asynchronous functionality.

Consider:

* initial loading;
* background refresh;
* empty data;
* recoverable request failure;
* offline state;
* authentication expiry;
* unavailable product;
* backend validation failure;
* payment pending;
* payment failed;
* payment verification;
* server/network timeout.

Do not expose raw database/provider errors directly to ordinary customers.

Preserve useful diagnostic information for development.

---

# 32. Offline/PWA behaviour

Both applications may use PWA capabilities where appropriate.

Do not assume “PWA” means all application data should work offline.

Be explicit about which state can safely persist locally.

Avoid caching sensitive or rapidly changing server data in ways that create incorrect business behaviour.

Cart continuity and shell availability may have different caching requirements from:

* menu availability;
* order status;
* payment state.

Server truth must win for transactional data.

---

# 33. Accessibility and responsive behaviour

Preserve accessible behaviour during implementation.

Pay attention to:

* keyboard navigation;
* focus management;
* semantic controls;
* labels;
* touch targets;
* bottom-sheet/modal behaviour;
* loading state announcements where appropriate;
* mobile viewport constraints.

Always consider both mobile and desktop where a feature exists in both contexts.

The storefront is particularly mobile-critical.

---

# 34. Dependency rules

Preserve the repository's existing package manager.

Do not replace or regenerate the lockfile with a different package manager.

Before adding a dependency, check whether:

* the capability already exists;
* the framework provides it;
* a current dependency solves it;
* a tiny implementation would be clearer.

Adding a dependency is acceptable when it materially improves correctness, reliability, security, or maintainability.

Do not reject a genuinely useful dependency solely because older instructions prohibited dependency changes.

Do not install unrelated packages.

Do not introduce Turborepo, Nx, or another monorepo orchestration framework unless there is a concrete requirement.

---

# 35. Environment variables and secrets

Environment variables may be added when a requested integration requires them.

Never invent actual production credentials.

Never expose secrets intended for trusted/server environments through frontend-prefixed environment variables.

Distinguish carefully between:

* public/publishable browser configuration;
* server-side private credentials.

Document newly required environment variables clearly.

If an integration cannot function without a secret that is not present, implement everything that can safely be implemented and clearly report the missing configuration.

---

# 36. Git safety

Before substantial work, inspect the worktree.

Preserve unrelated user changes.

Never:

* `git reset --hard`;
* discard unrelated files;
* force-rewrite user work;
* delete commits;
* overwrite work merely to simplify implementation;

unless explicitly instructed.

Do not create commits or push branches unless the user asks.

If existing validation already fails before your work, distinguish those failures from failures introduced by your changes.

---

# 37. Migration safety

Database schema changes should normally be represented through migrations.

Before applying destructive operations such as:

* dropping a table;
* dropping a column;
* deleting significant data;
* altering semantics of existing data;
* replacing an existing authorization model;

inspect dependencies and determine the impact.

Routine additive development migrations do not require an artificial approval checkpoint when they are clearly required by the requested task.

Destructive or difficult-to-reverse operations deserve extra caution.

Never perform destructive production-data operations merely because doing so makes development easier.

---

# 38. Production versus development

Do not assume the currently connected Supabase project or deployment is development or production based solely on a remembered name.

Verify context when the distinction materially affects safety.

Development/test data can be modified when the requested task requires it.

Production data deserves substantially greater caution.

Do not deploy, publish, release, migrate production, or modify a production environment unless the task authorizes doing so.

Implementing production-ready code is different from deploying it.

---

# 39. Validation

Use the repository's actual commands.

Do not invent scripts.

During implementation, run the fastest useful checks.

At completion, run the relevant configured validations where practical, such as:

* formatting;
* lint;
* TypeScript;
* tests;
* production build;
* targeted browser validation.

For UI work, also inspect relevant:

* mobile behaviour;
* desktop behaviour;
* loading states;
* error states;
* navigation;
* state continuity.

For backend work, validate relevant:

* SQL behaviour;
* RLS;
* permissions;
* RPC contracts;
* returned data shapes;
* migration success;
* type generation.

For mutations or transactional flows, test failure behaviour as well as the happy path when practical.

---

# 40. Do not hide failures

Never:

* suppress TypeScript errors merely to get a green build;
* disable lint rules because new code violates them;
* remove failing tests because implementation broke them;
* swallow database errors;
* claim success without validating;
* turn off RLS to make integration easier;
* expose secrets to solve authentication problems.

Fix the underlying problem or clearly report what remains.

---

# 41. Refactoring

Refactor when the task requires it or when a small refactor is necessary to implement the requested feature safely.

Do not perform broad “cleanup” while adding a feature.

When extracting existing behaviour:

* preserve behaviour first;
* move ownership deliberately;
* remove the obsolete duplicate;
* validate imports and state ownership.

Avoid large rewrites when a targeted extraction is sufficient.

---

# 42. Comments and documentation

Prefer code that explains itself through clear naming and boundaries.

Add comments when they explain:

* non-obvious business rules;
* security reasoning;
* idempotency;
* compatibility constraints;
* unusual provider behaviour;
* intentional architectural decisions.

Do not fill straightforward code with narration.

Update relevant documentation when the implemented architecture materially changes and the existing documentation would otherwise mislead future work.

---

# 43. Avoid speculative architecture

Do not create infrastructure merely because the platform might someday need it.

Examples:

* generic event buses;
* elaborate repository layers;
* plugin systems;
* microservices;
* complex domain frameworks;
* abstract payment engines;
* excessive DTO mapping;
* shared packages without stable reuse.

At the same time, preserve obvious seams around providers and tenant-specific concerns so today's implementation does not unnecessarily prevent tomorrow's extension.

---

# 44. Browser inspection and historical references

Existing public demos, screenshots, recordings, and reference material may be used to understand intended behaviour.

Use them as behavioural/visual references.

Do not copy minified deployed application bundles and present them as maintainable source code.

Do not treat a historical deployed demo as more authoritative than the current repository when the repository has deliberately evolved.

---

# 45. Autonomous engineering decisions

You are expected to make normal engineering decisions without asking the user about every implementation detail.

Examples include:

* names of internal functions;
* file placement consistent with existing architecture;
* query-key structure;
* reasonable TypeScript type design;
* whether a tiny helper deserves its own module;
* appropriate loading/error handling;
* normal indexes required by a newly introduced query;
* obvious refactoring necessary to safely integrate the feature.

Escalate decisions when they materially affect:

* product behaviour;
* security model;
* money movement;
* irreversible data;
* user-visible design direction;
* scope significantly beyond the request.

---

# 46. Avoid approval theatre

Do not create unnecessary “Phase 1 / Phase 2 / Phase 3” approval gates for work that can safely be implemented together.

When the user asks for:

* an implementation;
* an integration;
* a fix;
* a feature;

assume implementation is authorized within that defined scope.

When the user asks for:

* a plan;
* an audit;
* a review;
* recommendations;

do not implement unless the request also authorizes implementation.

Respect the distinction between planning and execution.

---

# 47. Completion report

After implementation, give a concise but useful report containing:

### Changed

The important files/features/database objects changed.

### Behaviour

What now works differently.

### Backend

Any schema, RLS, RPC, Auth, Storage, Edge Function, Realtime, or integration changes.

### Validation

What checks were run and their result.

### Remaining configuration

Anything the user still needs to provide, such as third-party credentials.

### Known issues

Only genuine unresolved issues or relevant pre-existing failures.

Do not add a long list of hypothetical future improvements unless requested.

Do not automatically start another unrelated task.

---

# 48. Core principle

The project is now in the **integration and production-functionality stage**, not the isolated frontend-reconstruction stage.

Do not protect historical mock/demo architecture at the expense of implementing the real product.

When the requested feature needs the frontend, backend, database, authentication, payment layer, server state, or third-party integrations to work together:

**integrate them properly.**

At the same time:

* preserve the existing product experience;
* respect tenant boundaries;
* keep secrets secure;
* maintain server authority for transactional state;
* make migrations reproducible;
* use TanStack Query deliberately;
* avoid unnecessary abstraction;
* validate the full flow;
* leave the codebase cleaner and more coherent than you found it.
