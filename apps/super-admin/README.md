# Super Admin (`@booking/super-admin`)

Dedicated **Release 47** SaaS control-plane frontend. Independent of `clinic-dashboard` and `patient-portal`.

## Design-system shell (Step 09)

The application chrome — `AppShell`, route registry, permission-policy model, page layout, and UI primitive library — is implemented. See **`docs/SUPER_ADMIN_DESIGN_SYSTEM_SHELL.md`** for the full record (architecture, IA, permission policies, a11y, localization/RTL, bundle size, tests).

Quick orientation for anyone adding a page:

1. **Register the route first.** Add an entry to `src/routing/route-registry.ts` (`SUPER_ADMIN_ROUTES`) with its `path`, `titleKey`/`descriptionKey` (add matching keys to `src/i18n/messages.ts` for both `en-US` and `ar-SY`), nav placement (`navGroup`/`navLabelKey`/`showInNav`), and — critically — its `policy`. Never add a `role`/`roles` field; the registry's integrity check (`assertRegistryIntegrity`, run in `route-registry.spec.ts`) rejects any role-name field.
2. **Express access as a `PermissionPolicy`**, never a role name: `{ type: 'public' }`, `{ type: 'authenticated' }`, `{ type: 'permission', permission: '<key>' }`, `{ type: 'anyOf' | 'allOf', permissions: [...] }`. See `src/routing/permission-policy.ts`. Evaluation is fail-closed — unknown/malformed policies deny access.
3. **Wire the route** in `src/app/router/index.tsx` using `relativePath('<routeId>')` and wrap the element in `<RequirePermissionPolicy policy={requireRoute('<routeId>').policy}>` (or a more specific guard from `src/auth/ProtectedRoute.tsx` for auth-transition pages).
4. **Wrap the page body in `PageLayout`** (`src/layout/PageLayout.tsx`) — `<PageLayout title="..." description="..." actions={...}>`. This gives you the `#main-heading` anchor that `useRouteFocus` needs for post-navigation focus management; don't hand-roll `<article><h1>`.
5. **Use the UI primitives** in `src/ui/` (`Button`, `FormField`/`TextInput`/`Select`/`Checkbox`, `Badge`/`StatusBadge`, `Alert`, `EmptyState`/`ErrorState`/`UnauthorizedState`/`NotFoundState`, `ConfirmationDialog`, `Menu`, `Drawer`, `Stack`/`Inline`/`Divider`/`Surface`) instead of raw HTML — they're the accessible, design-token-driven building blocks and are already unit-tested (`src/ui/ui-a11y.spec.tsx`).
6. **No tenant/patient context, no role-based UI branching, no PHI or fake business data** — this app is platform-operator-only.

### Healthcare catalog (Release 47 Step 12)

- Route `/catalog` is **available** (`CatalogPage`): kind-filtered tabs, search, lifecycle / missing-translation filters, pagination, create Draft / edit forms (en-US + ar-SY), Limit metadata, aliases, references, compatibility-rule builder, lifecycle confirmation + step-up, drift summary, and compatibility preview.
- High-impact lifecycle mutations require fresh **server** step-up (`PLATFORM_STEP_UP_REQUIRED`); the client confirmation dialog alone is not sufficient.
- Kind-specific permissions (`facility-type|specialty|module|feature|limit|compatibility-rule`.`view|manage`) — no cross-kind mutation, no hard-delete, no Plan/entitlement value fields.
- Create item/rule supports durable PostgreSQL `Idempotency-Key` replay (7-day retention; hash + result id only).
- Catalog **content** translations come from the Platform API; UI chrome stays in `src/i18n/messages.ts`.
- No browser draft persistence (`localStorage` / `sessionStorage`).
- Canonical keys render as LTR data. Preview states it is not an entitlement or provisioning decision.
- See `docs/SUPER_ADMIN_HEALTHCARE_CATALOG_AND_CAPABILITY_MODEL.md`.

### Locale storage and confirmation governance (Release 47 Step 09 correction)

- **Locale storage key:** Super Admin persists its locale preference under its own isolated `localStorage` key, `booking.super-admin.locale` (`SUPER_ADMIN_LOCALE_STORAGE_KEY`, `src/i18n/locale.ts`), passed as `I18nProvider`'s `storageKey` prop in `AppProviders.tsx`. It never reads or writes the `clinic-dashboard` app's shared `booking.locale` key — no migration, no cross-app storage-event leakage. A language switcher lives in `UserMenu` (English / العربية). When adding new copy, add matching keys to **both** `en-US` and `ar-SY` in `src/i18n/messages.ts` — parity is enforced by `src/i18n/messages.parity.spec.ts`.
- **High-impact action confirmation:** any destructive or high-impact action (suspend/reactivate a platform user, remove a role, revoke a session — own or another admin's, one/others/all, MFA-reset approve/reject) must be gated through `src/shell/useHighImpactAction.ts` in front of `ConfirmationDialog`, not a bare `onClick` handler or `window.confirm`. The hook guarantees: opening the dialog never calls the business API; the API is called at most once per confirm (no double-submit); a step-up-required failure keeps the dialog pending and replays the captured reason exactly once after step-up succeeds; cancelling step-up cancels the whole action; nothing is ever persisted to `localStorage`/`sessionStorage`. See `docs/SUPER_ADMIN_DESIGN_SYSTEM_SHELL.md` §17 for the full governance contract and test coverage.

## Commands

```bash
npm run dev:super-admin
npm run build:super-admin
npm run test:super-admin
npm run typecheck --workspace=@booking/super-admin
```

Or from this package:

```bash
npm run dev
npm run build
npm run test
npm run typecheck
```

- **Dev:** http://127.0.0.1:5176  
- **Preview:** http://127.0.0.1:4176  

## Environment

Copy `.env.example`. Prefix: `VITE_SUPER_ADMIN_*` plus `VITE_API_BASE_URL` (platform API origin, e.g. `http://127.0.0.1:3000`).

No signing secrets, passwords, or refresh tokens belong in frontend env.

## Local authentication and RBAC (Steps 06–08)

1. Run API with platform JWT + `PLATFORM_MFA_ENCRYPTION_KEY` (see `apps/api/.env.example`).
2. Bootstrap the first Platform Owner (one-time, only when no platform users exist):

```bash
npm run bootstrap:platform-owner --workspace=booking-system-api -- --email you@example.com
```

The command prompts for password and confirmation without echo. For non-interactive ops, use `--password-stdin` (password then confirmation on stdin). Do not pass passwords as CLI args or ordinary env vars.

3. Sign in → mandatory MFA enrollment/challenge.
4. Platform Users (`/platform-users`) and Roles (`/roles`) require server-granted permissions.
5. Invitation acceptance: `/activate?token=…` → password → MFA enrollment. Invitation URLs are delivered only through the configured adapter. Local process mailbox requires `PLATFORM_INVITATION_DELIVERY_MODE=dev-mailbox` and `PLATFORM_ALLOW_DEV_INVITATION_MAILBOX=true` (never for QA/staging/production). URLs are never printed to application logs.
6. See `docs/SUPER_ADMIN_RBAC_AND_PLATFORM_USERS.md`.

## Platform Dashboard MVP (Step 10)

The **Overview** route (`/overview`) is a read-only, permission-aware dashboard backed by `GET /platform/dashboard` (cached snapshot) and manual `POST /platform/dashboard/refresh` (`Cache-Control: no-store`; frontend dedupes concurrent refresh). Dashboard loads/refreshes do **not** call `/platform/auth/activity` — idle extension remains interaction-only. Metrics without a Source of Record render as **unavailable** (never a fake zero); metrics the operator cannot see render as **permission-limited**. See **`docs/SUPER_ADMIN_DASHBOARD_MVP.md`**.

## Tenant Directory and Detail (Step 11)

The **Tenants** route (`/tenants`) and **Tenant detail** (`/tenants/:tenantId`) are read-only views backed by `GET /platform/tenant-directory*` (platform JWT + `tenant.view`). Legacy clinic-dashboard consumers continue to use `GET /platform/tenants` (clinic JWT + `api.platform_admin` / `view`). Commercial sections respect `plan.view` / `subscription.view`. Access/license summary requires `entitlement.view`. See **`docs/SUPER_ADMIN_TENANT_DIRECTORY_AND_DETAIL.md`**.

## Not in this app yet

### Plans and Plan Versions (Release 47 Steps 13–14)

- Routes: `/plans`, `/plans/new`, `/plans/legacy-mappings`, `/plans/:planId`, `/plans/:planId/edit`, version create/detail/edit/compare.
- Canonical Plans: `plan.lite`, `plan.pro`, `plan.enterprise`. **`business` is unresolved** (non-Plan UI tier — Option B), not a Plan alias.
- **Step 14:** Plan Version detail tabs for **Entitlements**, **Limits**, and extended **Readiness**; compare view includes entitlement/limit diffs when the API returns them.
- Permissions: `plan-entitlement.view|manage`, `plan-limit.view|manage` (read also tolerates legacy `entitlement.view`).
- Draft editors use in-memory state only (no `localStorage` / `sessionStorage`). Preview banner states commercial definition, not tenant runtime.
- Entitlement editor: MODULE/FEATURE only (Facility Type/Specialty shown as not selectable). Limits: Unconfigured ≠ Unlimited; grouped by owning module.
- API routes expected: `GET/PUT .../versions/:id/entitlements`, `POST .../apply-required`, `GET/PUT .../limits`. If backend Step 14 is not deployed, tabs show an honest API-unavailable message.
- Version subscriber counts render as **unavailable**. Add-ons/Overrides remain Step 15.
- See `docs/SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md`.

### Add-ons, Commercial Overrides, and composition preview (Release 47 Step 15)

- Routes: `/add-ons`, `/add-ons/new`, `/add-ons/:addOnId`, version panels (`entitlements` / `limits` / `applicability` / `readiness` / `compare`), `/commercial-overrides` (+ create/detail/readiness/compare), `/commercial-composition/preview`.
- Permissions (keys only): `addon.view|manage`, `override.view|request|approve`. Composition preview is `anyOf(addon.view, override.view, plan.view)`.
- Commercial **definition** SoR only — publish / approve / revoke use high-impact confirmation + server step-up. Empty add-on catalog is valid; do not invent seeded `addon.*` products.
- Composition preview is **static**: shows capabilities, limits, suppressions, and disclaimer. No “Save to Tenant” / “Apply to Subscription” (Step 16).
- Tenant detail add-ons/overrides sections stay **unavailable** (assignment is Step 16); copy clarifies commercial definitions live under Add-ons / Commercial overrides.
- See `docs/SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md`.

Still deferred: subscription management UI (Step 16), sales records, operations/audit/settings domains. Tenant **mutations** remain on the legacy clinic control plane until a later migration step.
