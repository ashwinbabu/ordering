# A2 Ordering — Repository Agent Instructions

These instructions apply to the entire repository unless a more specific `AGENTS.md` exists deeper in the tree.

## 1. Engineering standard

Work with the judgment expected of a principal-level React/TypeScript engineer with deep experience across React's evolution from its early releases through modern React.

Optimize for:

- correctness before cleverness;
- maintainability over short-term convenience;
- explicit ownership and boundaries;
- predictable React data flow;
- small, reviewable changes;
- strong TypeScript contracts;
- framework-native conventions;
- accessible, responsive UI;
- minimal accidental coupling;
- easy future integration with TanStack Query and Supabase;
- behavior preservation during refactors.

Use current, proven React and TypeScript practices. Do not introduce patterns merely because they are fashionable. Prefer the simplest architecture that preserves clear ownership and scales with the real product.

When multiple valid approaches exist, choose the one that best reduces future maintenance cost without adding speculative abstraction.

## 2. Read before structural work

Before making architectural, structural, state-ownership, routing, or cross-feature changes to the Admin application, read:

`docs/admin-frontend-architecture.md`

Treat that document as the approved architectural direction unless the current user task explicitly changes it.

If the repository implementation materially conflicts with the architecture document, do not silently force either side to fit. Inspect the discrepancy, preserve working behavior, and report the conflict.

## 3. Repository truth comes first

Before editing:

- inspect the relevant source files;
- inspect the applicable `package.json`;
- inspect the existing lockfile;
- inspect framework and routing configuration;
- inspect existing lint, type-check, test, build, and development scripts;
- inspect any existing local `AGENTS.md` files in the working path.

Do not invent commands, framework conventions, aliases, environment variables, package-manager behavior, deployment settings, or repository facts that can be determined from the codebase.

Preserve the package manager already used by the repository.

Do not replace, regenerate, or migrate the lockfile with another package manager.

## 4. Scope discipline

Implement only the requested scope.

Do not combine a requested refactor with:

- redesigns;
- copy changes;
- route changes;
- state-management rewrites;
- dependency upgrades;
- unrelated cleanup;
- speculative abstractions;
- backend integration;
- database changes;
- new product features.

When performing behavior-preserving extraction, extraction means moving existing working implementation into clearly owned modules. It does not mean rewriting the application.

Prefer small, independently validated changes over large cross-cutting rewrites.

## 5. Frontend ownership rules

Keep framework route and layout files thin. They should primarily connect framework routing to application composition.

Feature-specific code belongs with its feature.

App-wide layout components belong in the Admin application's layout component area.

Only genuinely reusable design-system primitives belong in shared UI component areas.

Do not move a component into a shared location solely because it is visually generic. It must be genuinely reused or clearly cross-feature.

Avoid dumping grounds such as:

- `utils.ts`
- `helpers.ts`
- `services.ts`
- `common.ts`

Prefer narrowly named modules that describe their responsibility.

Avoid barrel `index.ts` files unless they materially improve a stable public import boundary.

Do not create empty folders or placeholder modules merely to match a theoretical architecture.

## 6. React state rules

Keep temporary UI state close to the component or feature that owns it.

Do not create a giant global provider to avoid prop passing.

Do not introduce Redux, Zustand, or another state library unless explicitly approved.

Use narrowly scoped context/providers only for state that is genuinely shared across the corresponding application boundary.

Preserve staged-versus-committed state semantics.

Modal visibility should remain close to the component or feature that owns the modal unless there is a demonstrated cross-feature requirement.

Do not use TanStack Query as a container for local UI state or unfinished form state.

## 7. TanStack Query rules

TanStack Query is the intended boundary for future remote/server state where appropriate.

Do not install or introduce TanStack Query solely to satisfy folder structure.

Do not create fake asynchronous APIs or no-op query hooks.

Do not create placeholder `queries.ts`, `mutations.ts`, `api/`, or hook modules with no real implementation.

When real server-state integration is introduced, prefer the flow documented in the architecture document:

feature screen/component
→ feature query or mutation
→ feature API module
→ typed application Supabase client

Outlet-specific query keys must include business/location scope.

## 8. Supabase safety

Do not connect, switch, rename, or modify a Supabase project unless the current task explicitly authorizes it.

Do not modify database schema, migrations, RLS, RPCs, Edge Functions, Auth configuration, Storage configuration, or production data unless explicitly requested.

This blanket restriction has been explicitly authorized for one additional boundary: Storefront customer phone authentication (sign-in and checkout verification), via Supabase's native phone auth (`signInWithOtp`/`verifyOtp`) with MSG91 used only as SMS transport inside the Send SMS Auth Hook. That authorization covers the `send-sms-hook` Edge Function, the `private.sync_customer_from_auth_user()` trigger linking `auth.users` to `core.customers`, and the Auth configuration enabling Phone auth and pointing the Send SMS Hook at that function. It does not extend to any other schema, RPC, Edge Function, or Auth configuration change. It does not authorize a second, parallel OTP/authentication path.

Do not invent environment values.

Never expose a Supabase service-role key or other server-only credential to frontend code.

Do not handwrite generated database types.

The frontend outlet context is application scope only. It must never be treated as a substitute for database authorization or RLS.

## 9. Dependency rules

Do not install, remove, upgrade, or replace unrelated dependencies.

Before adding a dependency, verify that the requested result cannot reasonably be achieved with the existing stack.

Do not introduce Turborepo, Nx, or another monorepo orchestration layer unless explicitly approved.

## 10. Git and change safety

Before substantial refactors:

- inspect the Git worktree status;
- identify user changes already present;
- preserve changes unrelated to the task;
- establish the current validation baseline when requested.

Do not discard, overwrite, reset, or rewrite user work to simplify the task.

Do not silently fix unrelated pre-existing failures.

If the baseline is already failing, distinguish baseline failures from failures introduced by the current change.

## 11. Validation expectations

Use the repository's actual configured commands. Do not invent command names.

For relevant frontend changes, validate with the fastest applicable checks during the task and the complete configured checks at the end.

Where configured and applicable, validation should cover:

- formatting;
- lint;
- TypeScript;
- tests;
- production build;
- application startup;
- route loading;
- browser-based desktop parity;
- browser-based mobile parity.

For extraction/refactor tasks, also verify:

- no duplicate implementation remains;
- imports resolve from the intended owner;
- observable UI and behavior are unchanged;
- responsive behavior is unchanged;
- staged/committed state behavior remains intact;
- shared state still has a single source of truth.

Never hide, suppress, or bypass a newly introduced validation failure merely to report success.

## 12. Completion report

At the end of a structural or refactor task, report concisely:

- files added, moved, removed, and changed;
- important ownership decisions;
- validations run and their results;
- pre-existing warnings or failures;
- any observable behavior difference;
- any follow-up recommendation that is outside the current scope.

Do not automatically begin the next batch or phase unless the current task explicitly authorizes it.
