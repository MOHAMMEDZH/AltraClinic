# Super Admin — Design System Shell (Release 47 Step 09)

Authoritative implementation record for the Super Admin design-system shell: application chrome, route registry, permission-policy model, page-layout/primitive library, semantic design tokens, accessibility, localization/RTL, and security boundaries.

Companions: `SUPER_ADMIN_APP_SCAFFOLD.md` (Step 05), `SUPER_ADMIN_PLATFORM_AUTHENTICATION.md` (Step 06), `SUPER_ADMIN_MFA_AND_SESSION_SECURITY.md` (Step 07), `SUPER_ADMIN_RBAC_AND_PLATFORM_USERS.md` (Step 08).

| Field | Value |
|-------|--------|
| **Status** | Shell complete |
| **Package** | `@booking/super-admin` |
| **Location** | `apps/super-admin` |
| **Supersedes** | Step 06 `ScaffoldLayout` (kept as a re-export shim for compatibility) |
| **Business-domain pages implemented in this step** | None — Step 09 is chrome/infrastructure only |

---

## 0. Release 47 Step 09 — Focused UI Correction (this pass)

A follow-up, scope-limited correction pass (frontend-only — no API/Prisma/backend changes) addressed three gaps left open by the original Step 09 delivery:

1. **Configurable i18n storage key** (`@booking/i18n`) — `loadStoredLocale`/`persistLocale`/`I18nProvider` now accept an optional `storageKey` (default `LOCALE_STORAGE_KEY` = `'booking.locale'`, unchanged for `clinic-dashboard`). Super Admin passes its own dedicated key (`SUPER_ADMIN_LOCALE_STORAGE_KEY = 'booking.super-admin.locale'`, `src/i18n/locale.ts`) into `I18nProvider` in `AppProviders.tsx` and **never reads or writes `booking.locale`** — no migration, no cross-app storage-event leakage (§23).
2. **High-impact `ConfirmationDialog` governance** — every session-revocation, suspend/reactivate, remove-role, and MFA-reset-decision action across `SecuritySessionsPage`, `PlatformUserDetailPage`, and `MfaResetApprovePage` now routes through a single typed state machine, `src/shell/useHighImpactAction.ts`, in front of an enhanced `ConfirmationDialog` (optional `description`/`reason*`/`error` props, cancel-first focus, disabled-while-pending, no double-submit). This supersedes the "left as-is" position in the original §17 (see the updated §17 below).
3. **Complete Step 09 localization** — `src/i18n/messages.ts` now has full `en-US`/`ar-SY` key parity (enforced by `messages.parity.spec.ts`) across every shell/page string introduced in Step 09, including all `confirm.*` copy. A language switcher (English / العربية) was added to `UserMenu`, closing the "no in-app switcher" gap noted in the original §23.

See §17, §23, and §26 below for the updated (post-correction) state of confirmation governance, localization, and the test suite.

---

## 1. Shell architecture

`src/shell/AppShell.tsx` is the single root layout mounted at `<Route element={<AppShell />}>` in `src/app/router/index.tsx`. It renders one of two chrome modes based on the current route's registry entry:

- **`AuthPageFrame`** (`src/shell/AuthPageFrame.tsx`) — minimal chrome (brand + `EnvironmentBadge` only, no nav, no tenant/patient selectors) for routes whose registry `layout` is `auth` or `bare`, and for **any** route while the caller isn't fully `authenticated` (fail-closed: an authenticated-only route rendered before auth resolves still gets the minimal frame, never the full nav shell).
- **Full app chrome** — sticky header (mobile menu toggle, brand link, `EnvironmentBadge`, `UserMenu`), a desktop `<nav>` sidebar and a mobile `Drawer` (both rendering the same `PrimaryNavLinks`), and a `<main id="main-content">` landmark containing `Breadcrumbs`, the routed page, and the `FeedbackRegion` toast host.

Both modes render:
- A skip link (`<a href="#main-content" class="skip-link">`) as the very first focusable element in the DOM, and
- `DocumentTitle` (sets `document.title` from the route registry on every navigation; renders nothing).

No tenant selector, patient selector, or clinic-context UI exists anywhere in the shell — this is enforced by tests (`shell.spec.tsx`: *"never renders a tenant or patient selector anywhere in the shell"*).

## 2. Information architecture (IA)

Top-level nav groups, in registry order: **Overview → Platform → Administration → Operations → Sales**. Each group only renders in the sidebar/drawer if it has at least one route the current principal can see (`listNavRoutesByGroup`).

| Group | Routes |
|-------|--------|
| Overview | Overview |
| Platform | Tenants, Catalog, Plans |
| Administration | Platform Users, Roles, Settings |
| Operations | Operations, Audit |
| Sales | Sales |

Non-nav routes (login, activate, MFA enroll/challenge, unauthorized, platform-user detail/invite, MFA-reset approval, security, not-found) are reachable by direct link/redirect only and never appear in the primary nav.

## 3. Route registry

`src/routing/route-registry.ts` is the **single source of truth** for every route: path, `layout` (`app` | `auth` | `bare`), nav placement/grouping, i18n title/description keys, and access `policy`. `src/app/router/index.tsx` reads every path and policy from the registry (via `getRouteById`/`relativePath`) rather than hardcoding strings, so the registry and the mounted routes cannot drift.

Registry-wide invariants are enforced by `assertRegistryIntegrity()` and covered by `route-registry.spec.ts` (16 tests):
- Unique route `id`s and unique `path`s.
- Every `policy` is a well-formed `PermissionPolicy` (see §4).
- No route ever carries a role-name field (`role`, `roles`, `roleName`, `roleNames`, `requiredRole`, `requiredRoles`) — a static guard against role-based authorization creeping back in.
- No standalone `/` (home) route is registered; `/` always resolves dynamically (§5).
- Every `breadcrumbParentId` reference resolves to a real route.

All 20 routes are registered, including the later-step domain placeholders (`overview`, `tenants`, `catalog`, `plans`, `operations`, `audit`, `sales`, `settings`) — each carries its real target `policy` and a `step` number, not a stand-in "public"/"authenticated" bypass. `PlaceholderPage` renders those routes today with an `EmptyState` and a "Available in Step N" note; no fake data, metrics, or business content is rendered.

## 4. Permission-policy model

`src/routing/permission-policy.ts` defines the **only** access-control vocabulary the frontend uses:

```ts
type PermissionPolicy =
  | { type: 'public' }
  | { type: 'authenticated' }
  | { type: 'permission'; permission: string }
  | { type: 'anyOf'; permissions: readonly string[] }
  | { type: 'allOf'; permissions: readonly string[] };
```

`evaluatePermissionPolicy(principal, policy)` is **fail-closed**: malformed policies, unknown `type` values, empty permission arrays, and a `null` principal all evaluate to `false`. The only policy that grants access unconditionally is `public`. `PolicyPrincipal` intentionally has no `roleKeys` field — the policy engine cannot see role names, so it cannot be gated on them even by accident.

`RequirePermissionPolicy` (`src/auth/ProtectedRoute.tsx`) is the single guard component wired onto every non-public route in `AppRouter`. It layers session/MFA gates (loading → mfa-enrollment → mfa-challenge → login redirect) in front of the policy check, then redirects to `/unauthorized` on denial. `platform-rbac.spec.tsx` and `permission-nav.spec.tsx` (13 tests total) assert this end-to-end, including the explicit regression case *"never grants access via role-name bypass, even for role keys that look like 'super admin'"*.

Almost every route uses `permission` or `anyOf`; `overview` and `security` intentionally use `authenticated` (dashboard landing and "my own sessions" are available to every signed-in platform user by design, not a bypass — they still require session + MFA to be satisfied first).

## 5. Default-route resolution

There is no static `/` page. `src/routing/resolve-default-route.ts` picks a landing route at render time: **Overview** if the principal can see it (always true once authenticated, since `overview` is `authenticated`-gated) → otherwise the first permission-eligible nav route in registry order → otherwise `/security` (every platform user can always reach their own sessions page). `DefaultLandingRedirect` renders this as a `<Navigate replace>` from the index route, guarded by `RequirePlatformAuth`.

## 6. Desktop and mobile navigation

`PrimaryNavLinks` (`src/shell/PrimaryNavLinks.tsx`) is the single nav-link list component, shared by:
- A desktop `<nav aria-label="Primary">` sidebar, shown via a `min-width: 1024px` media query, and
- A mobile `Drawer` (`src/ui/Drawer.tsx`) opened by a header menu button below that breakpoint.

The `Drawer` is focus-trapped (`useFocusTrap`), closes on <kbd>Escape</kbd> and backdrop click, and closes automatically after any nav link click or route change (`useRouteFocus` runs the drawer's close callback on every navigation). The desktop nav never renders inside the drawer's DOM twice — both surfaces mount the same `PrimaryNavLinks` component independently so there's exactly one implementation to keep permission-correct. Covered by `responsive-nav.spec.tsx` (3 tests) and `permission-nav.spec.tsx`.

## 7. Header, user menu, environment badge

The header (`sa-shell-header`) is sticky and contains, left to right: mobile menu toggle (hidden ≥1024px), brand link (routes to `/`), then env badge + `UserMenu` pinned to the end via `margin-inline-start: auto` (logical, RTL-safe).

`UserMenu` (`src/shell/UserMenu.tsx`) is built on the generic `Menu` primitive (arrow-key/Home/End navigation, `role="menu"`/`role="menuitem"`, focus-trapped, closes on outside click or Escape, returns focus to the trigger). It shows display name/email and role-key labels **as display-only text** (never used to compute access — the policy engine never receives role names), a link to `/security`, and sign-out. Covered by `shell.spec.tsx` (*"opens the account menu via keyboard..."*, *"signs the user out..."*).

`EnvironmentBadge` (`src/shell/EnvironmentBadge.tsx`) always renders a visible text label (`Local` / `Test` / `Production`) driven by `VITE_SUPER_ADMIN_ENV` — never color alone — with a visually-hidden `"Environment: "` prefix for screen readers. Production renders with the danger token, test with the warning token.

## 8. Breadcrumbs

`Breadcrumbs` (`src/layout/Breadcrumbs.tsx`) derives its trail from `breadcrumbParentId` chains in the route registry via `buildBreadcrumbs` and renders nothing for single-level routes (e.g. top-level nav pages), so it never adds visual noise where there's nothing to show. Rendered inside `<main>`, above the routed page, only in the full app-shell layout.

## 9. Document titles

`DocumentTitle` (`src/routing/DocumentTitle.tsx`) sets `document.title` to `"{route title} | {app.brand}"` (or just the brand for unregistered paths) on every location change, sourced from the registry's `titleKey` through `useI18n()`. Covered by `shell.spec.tsx`'s *"sets document.title from the route registry"*.

## 10. Page layout

`PageLayout` (`src/layout/PageLayout.tsx`) is the standard content-page wrapper: `<article class="sa-page"><PageHeader/>{children}</article>`. `PageHeader` renders an `<h1 id="main-heading" tabindex="-1">` — this exact id/attribute pair is load-bearing: `useRouteFocus` (`src/routing/useRouteFocus.ts`) moves focus to `#main-heading` (falling back to `#main-content`) after every client-side route change, so every routed page needs exactly one of these per render.

As of this step, **every** routed page uses `PageLayout` (business pages) or `AuthPageFrame` via the shell (auth-transition pages) — see §20 for the specific pages brought into this pattern in this pass.

## 11. UI primitive library

`src/ui/` (barrel: `src/ui/index.ts`) — every primitive is design-token-driven (no hard-coded colors/spacing) and unit-tested for accessibility in `ui-a11y.spec.tsx` (9 tests):

| Primitive | Notes |
|---|---|
| `Button` / `IconButton` | `Button` supports a `pending` state (spinner + `aria-busy`, label stays for screen readers); `IconButton` requires `aria-label`. |
| `FormField` / `TextInput` / `Select` / `Checkbox` | `FormField` wires `label`/`hint`/`error` to its control via `aria-describedby`; `Checkbox` associates its visible label. |
| `Badge` / `StatusBadge` | `StatusBadge` always renders a text label — status is never color-only. |
| `Alert` | `role="alert"` for danger/warning, `role="status"` for info/success. |
| `Spinner` | Decorative by default; respects `prefers-reduced-motion` (slower animation, not motion-sick strobing). |
| `EmptyState` / `ErrorState` / `UnauthorizedState` / `NotFoundState` | Standard state components — never render stack traces, raw errors, or role names as the reason for denial. |
| `ConfirmationDialog` | Focus-trapped, Escape + backdrop-click to cancel, `role="dialog"`. Built for destructive confirmations; see §21 for current wiring status. |
| `Menu` / `Drawer` | Shared low-level building blocks for `UserMenu` and the mobile nav / step-up / confirmation modals. |
| `Stack` / `Inline` / `Divider` / `Surface` | Layout primitives (gap/align/padding scales, logical-direction-aware). |
| `VisuallyHidden` | Screen-reader-only text (e.g. `EnvironmentBadge`'s "Environment:" prefix, `Drawer`'s hidden title). |
| `FeedbackProvider` / `FeedbackRegion` / `useFeedback` | Toast notifications; `aria-live="polite"` region, plain-text messages only (no PHI/tokens). |

## 12. Semantic design tokens

All shell/page CSS (`src/styles/super-admin-shell.css`) is built on `--sa-*` custom properties that map onto `@booking/design-tokens` (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--text-*`) — no hard-coded hex colors or magic-number spacing in shell code. `color-scheme: light` is set at the root; dark-mode tokens are not yet wired (deferred, tracked alongside later steps — the token indirection means enabling it later won't require touching component code).

## 13. Typography and spacing

Page titles use `--text-page-title`, section/empty/error headings use `--text-section-title`, body copy uses the browser/global default plus `--text-body`/`--text-sm`/`--text-xs` for secondary text. Spacing everywhere in the shell comes from the `--sa-space-{1,2,3,4,5,6,8}` scale (aliased to `--space-*`), never ad-hoc `px`/`rem` literals in layout code (form-field-level fine-tuning like `0.5rem 0.65rem` input padding is the one place literals remain, matching the rest of the codebase's form styling).

## 14. Status patterns

Status is always communicated with a visible text label (`StatusBadge`, `EnvironmentBadge`) — color (`sa-badge-success/warning/danger/info/neutral`, `sa-env-badge-{development,test,production}`) is a secondary reinforcement, never the only signal. Verified directly by `ui-a11y.spec.tsx`'s *"StatusBadge always renders a visible text label, never color alone"* and `shell.spec.tsx`'s equivalent check for the env badge.

## 15. Loading / empty / error / unauthorized / not-found states

- **Loading:** `role="status" aria-live="polite"` blocks (`CheckingSession`, per-page "Loading…" text) — never a bare spinner with no text alternative.
- **Empty:** `EmptyState` (`role="status"`), used by `PlaceholderPage` for every later-step domain route.
- **Error:** `ErrorState` (`role="alert"`) for recoverable errors; `ErrorBoundary` (`src/app/providers/ErrorBoundary.tsx`) is the last-resort root boundary — generic message only, **never** a stack trace, raw `Error` object, or sensitive detail, with a retry action.
- **Unauthorized:** `UnauthorizedState` (`role="alert"`) — generic "you do not have permission" copy; never explains *why* in terms of roles/permissions, and never distinguishes "doesn't exist" from "you can't see it" in a way that would leak information.
- **Not found:** `NotFoundState` (`role="status"`) for both the explicit `/not-found` route and the router's `*` catch-all.

## 16. Forms

Form fields use native `<label>` association (`FormField`/`TextInput`/`Select`/`Checkbox`) with `aria-describedby` wiring hints/errors to the control. Inline validation errors render as `role="alert"` text (`sa-error`). No client-side form in the shell ever persists a password, token, or secret outside of the in-memory auth provider state (see §19).

## 17. Confirmation patterns (updated — Release 47 Step 09 correction)

Every high-impact platform action now routes through `ConfirmationDialog` via a single typed governance hook, `src/shell/useHighImpactAction.ts`. This supersedes the original Step 09 delivery, which left these actions on ad hoc gates (see the correction summary in §0).

**Governed action kinds** (`HighImpactKind`): `suspend-user`, `reactivate-user`, `remove-role`, `revoke-own-session`, `revoke-own-others`, `revoke-own-all`, `revoke-admin-session`, `revoke-admin-all`, `mfa-reset-approve`, `mfa-reset-reject` — wired into `SecuritySessionsPage` (own-session revoke/others/all), `PlatformUserDetailPage` (suspend, reactivate, remove role, admin single-session revoke, admin revoke-all-sessions), and `MfaResetApprovePage` (approve/reject).

**Invariants (enforced by tests, not just convention):**
- `open()` never makes an API call — it only opens the dialog with a stable, pre-bound `execute(reason)` closure captured at the point the button was clicked (`useHighImpactAction.open`).
- The business API is called **only** from `onConfirm`, and **at most once** per confirm — an `inFlight` ref guards a fast double-click from double-submitting.
- `ConfirmationDialog` initial focus goes to **Cancel**, never Confirm, even for danger-styled actions; Confirm is disabled while pending or (when `reasonRequired`) while the reason field is empty/whitespace-only.
- A `PLATFORM_STEP_UP_REQUIRED` failure keeps the dialog in its pending state (not dismissed), opens `StepUpModal`, and replays the **exact same captured reason** exactly once after successful step-up — the user never has to re-type it.
- Cancelling step-up cancels the whole action; no business API call is ever made on that path.
- Nothing here is ever written to `localStorage`/`sessionStorage` — dialog/hook state is in-memory React state only.
- Switching locale (via `UserMenu`'s language switcher) while a dialog is open closes it (no API call) rather than leaving a stale-language dialog on screen — the hook watches the active `locale` and calls its own `close()` on change (`useHighImpactAction`'s locale-change effect).

Reason collection is per-kind (`reasonRequired: boolean` at `open()` call time): suspend/reactivate/admin-session-revoke/admin-revoke-all require a non-empty reason; remove-role and the caller's own session-revoke actions do not; MFA reset approve/reject allow an optional reason. All confirm copy (`title`/`impact`/`confirmLabel`/`reasonLabel` per kind) lives under `confirm.*` in `src/i18n/messages.ts`, fully parallel in `en-US`/`ar-SY` (§23).

Test coverage: `auth/confirmation-governance.spec.tsx` (personal session revoke — open-without-API, cancel-without-API, confirm-once, double-click-once, step-up-cancel-never-falls-through), `pages/platform-user-lifecycle-confirm.spec.tsx` (suspend/reactivate/remove-role/admin-revoke-one/admin-revoke-all), `pages/mfa-reset-confirm.spec.tsx` (approve/reject with and without an optional reason), and the updated `auth/platform-auth.spec.tsx` (session revoke now asserts the dialog-first flow instead of an immediate API call).

## 18. Feedback

`FeedbackProvider`/`FeedbackRegion` (`src/ui/FeedbackProvider.tsx`) is a toast system mounted once inside `<main>`: `aria-live="polite"` region, auto-dismiss (default 6s, or `durationMs: 0` for manual-only), plain-text messages only — callers must never pass PHI, tokens, or invitation URLs into `notify()`. Not yet wired into any page action (no page currently calls `useFeedback().notify`) — pages use inline `role="alert"`/`role="status"` text today; `FeedbackRegion` is chrome-ready infrastructure for later steps.

## 19. Accessibility (a11y)

- **Skip link:** first focusable element on every page, targets `#main-content`, visually hidden until focused (see §22 — this CSS was missing and has been added in this pass).
- **Landmarks:** `<header>`, `<nav aria-label="Primary">`, `<main id="main-content">` in the full shell; `<header>`/`<main id="main-content">` in `AuthPageFrame`.
- **Headings:** every `PageLayout`-based page has exactly one `<h1 id="main-heading">`.
- **Live regions:** loading (`role="status" aria-live="polite"`), errors (`role="alert"`), toasts (`aria-live="polite"`).
- **Keyboard:** `Menu` and `Drawer` are fully keyboard-operable (arrow keys/Home/End in menus, Tab-trapped in both, Escape to close, focus returns to the trigger on close).
- **No color-only signals:** see §14.
- **No PII/PHI/secret leakage in accessible text:** menu identity summary shows email/display name/role-key labels only; error/unauthorized states never explain access decisions in terms of roles or expose stack traces.

Directly tested by `ui-a11y.spec.tsx` (9), `shell.spec.tsx` (6), `responsive-nav.spec.tsx` (3).

## 20. Focus management

`useRouteFocus` (mounted once, from `AppShell`) moves focus to `#main-heading` (or `#main-content` if a page has no heading yet) after every client-side navigation, and runs any supplied "close" callbacks first (used to auto-close the mobile drawer on navigation). The very first render is skipped so mount doesn't steal focus from the browser chrome. `useFocusTrap` (shared by `Menu`, `Drawer`, `ConfirmationDialog`, `StepUpModal`) traps Tab/Shift+Tab within the active surface, handles Escape, and restores focus to whatever was focused before activation.

**Pages brought onto the `PageLayout`/`#main-heading` pattern in this pass** (previously rendered a bare `<article class="sa-page"><h1>...</h1>...</article>` with no `id="main-heading"`, so `useRouteFocus` fell back to `#main-content` for them):

- `PlatformUserDetailPage` (both the loading/error branch and the loaded branch — title is the user's email once loaded)
- `PlatformUserInvitePage`
- `PlatformRolesPage`
- `MfaResetApprovePage`
- `MfaEnrollPage` (both the enrollment form and the post-confirmation recovery-codes branch)
- `MfaChallengePage`
- `ActivateInvitationPage`

No security, permission, or API-call behavior changed in any of these — only the wrapping markup (`<article><h1>...` → `<PageLayout title="...">`) and, where a `<p class="sa-muted">` intro line existed, moving it into `PageLayout`'s `description` slot. All existing heading-text assertions in tests (exact `h1` wording like `"Set up two-factor authentication"`, `"Platform roles"`, etc.) are preserved verbatim.

## 21. Reduced motion

`@media (prefers-reduced-motion: reduce)` slows the `Spinner`'s rotation (0.7s → 1.4s) rather than freezing it entirely (freezing a spinner removes its "in progress" meaning for assistive tech users who still perceive motion at a reduced rate). The mobile drawer/menus have no motion beyond browser-default (no custom transition currently applied to `Drawer`/`Menu` open/close), so there's nothing further to gate there. The new skip-link `top` transition (§22) is a small, non-essential enhancement; consider gating it behind the same media query in a follow-up if strict "no motion" compliance is required.

## 22. Responsive layout

Single breakpoint at `1024px`: below it, the sidebar is hidden and the mobile menu toggle + `Drawer` take over; at/above it, the sidebar is permanently visible and the toggle is hidden. An additional `640px` breakpoint tightens `sa-shell-main`/`sa-auth-main` padding and switches the two-column recovery-codes grid to one column. No horizontal scrolling is introduced by the shell itself; wide tables (`sa-table-wrap`) scroll independently within their own container.

## 23. Localization and RTL status (updated — Release 47 Step 09 correction)

- **Locales:** `en-US` (default) and `ar-SY`, **fully key-for-key parallel** in `src/i18n/messages.ts` — every shell chrome string, nav label, route title/description, common state/button, and every `confirm.*`/`pages.*`/`status.*` string introduced across Step 09's pages, via `@booking/i18n`'s `I18nProvider`/`useI18n`. Parity (identical flattened key sets, no empty values) is enforced by `src/i18n/messages.parity.spec.ts`, not just convention.
- **Isolated storage key:** Super Admin persists its locale preference under its own key, `booking.super-admin.locale` (`SUPER_ADMIN_LOCALE_STORAGE_KEY`, `src/i18n/locale.ts`), passed as the `storageKey` prop to `I18nProvider` in `AppProviders.tsx`. It **never reads or writes** the shared `clinic-dashboard` key (`booking.locale`, `@booking/i18n`'s `LOCALE_STORAGE_KEY`) — no migration between the two, and a `storage` event for the other app's key is ignored (`I18nProvider` only reacts to its own configured key). `loadStoredLocale`/`persistLocale`/`I18nProvider` all default to `LOCALE_STORAGE_KEY` when no `storageKey` is supplied, so `clinic-dashboard` (and any other caller that doesn't opt in) is unaffected. Covered by `src/i18n/locale-storage.spec.tsx` (7 tests) and `packages/i18n/src/locale-storage.spec.ts` (14 tests).
- **Language switcher:** `UserMenu` now has "Language: English" / "Language: العربية" menu items (with a `✓` marker on the active locale) that call `setLocale` directly — this closes the "known gap" from the original Step 09 pass. Switching locale also closes any open `useHighImpactAction` confirmation dialog (§17) so a stale-language dialog is never left on screen.
- **Direction:** `@booking/i18n` sets `document.documentElement.lang`/`dir` automatically from the active locale (`getDirection('ar-SY') === 'rtl'`) whenever the locale changes — no shell code needs to compute this itself.
- **Font:** `index.html` preloads IBM Plex Sans (Latin) and IBM Plex Sans Arabic so Arabic text doesn't fall back to a mismatched system font.
- **Logical CSS audit:** `super-admin-shell.css` uses logical properties throughout (`margin-inline-*`, `inset-inline-*`, `border-inline-end`, `text-align: start`) — no bare `left`/`right`/`float`. The mobile `Drawer`'s `side="start"`/`side="end"` props map to `margin-inline-end: auto`/`margin-inline-start: auto` respectively, so the drawer's screen-edge automatically flips under `dir="rtl"` with no per-locale branching in the component.
- **Automated RTL/localization coverage:** `src/shell/localization.spec.tsx` (5 tests) renders the full authenticated shell and asserts, after switching to العربية via the language switcher: `document.documentElement.lang`/`dir` flip to `ar-SY`/`rtl`; primary nav labels and `document.title` translate; the account menu itself re-renders in Arabic; the mobile navigation drawer remains reachable and localized under `dir="rtl"`; and an open high-impact confirmation dialog (§17) renders fully localized title/confirm/cancel text.
- **Not yet manually verified:** actual pixel-level mirrored layout in a real browser (mirrored breadcrumb separators, icon mirroring, etc.) — the CSS is logical-property-clean and the automated suite verifies `dir`/translated text/DOM structure under `jsdom`, but this pass did not include a manual/visual RTL smoke test. Recommend a manual `dir="rtl"` pass (or a Playwright/axe RTL snapshot) before RTL is declared pixel-perfect.

## 24. Security and privacy

- No tenant ID, patient ID, PHI, clinical content, or fake/sample business data anywhere in shell or placeholder code.
- No role name ever participates in an access decision (§4) — role keys are display-only strings surfaced solely in `UserMenu`'s identity summary.
- `PlaceholderPage` renders only route metadata (title/description/step number) — zero business data, so there's nothing sensitive to leak from a not-yet-implemented domain.
- Error/unauthorized/not-found states never leak stack traces, raw error objects, or details that would let a caller distinguish "resource doesn't exist" from "you don't have permission to see it."
- `FeedbackProvider` messages, `UserMenu`, and every state component are plain-text-only surfaces — no HTML injection vectors, no token/secret rendering paths.
- CSP (`vite.config.ts` dev/preview headers, `index.html` meta tag) remains `script-src 'self'` with no inline scripts added by this step; no new third-party origins were introduced beyond the pre-existing Google Fonts preconnects.
- The only localStorage key the shell writes is its own isolated locale preference, `booking.super-admin.locale` (§23) — it never reads or writes the shared `clinic-dashboard` key (`booking.locale`). The high-impact confirmation governance hook (§17) is explicitly documented and tested to never touch `localStorage`/`sessionStorage`.

## 25. Bundle impact

Production build (`npm run build`, Vite 5.4.21, single entry, no code-splitting yet):

| Asset | Size | Gzip |
|---|---|---|
| `dist/index.html` | 1.32 kB | 0.62 kB |
| `dist/assets/index-*.css` | 19.57 kB | 4.34 kB |
| `dist/assets/index-*.js` | ~233.9 kB | ~72.5 kB |

88 modules transformed; build completes in ~2.5–3.8s locally. This is the **entire app** (shell + auth + RBAC + all Step 06–09 pages) in one chunk — there is no route-based code-splitting yet. The shell itself (layout components, route registry, permission policy, UI primitives, CSS) is a small fraction of this; the bulk is React/React Router/React DOM plus the platform-auth/RBAC application code from Steps 06–08. Revisit chunking (e.g. `React.lazy` per top-level route) once later steps add real per-domain page weight (catalog, plans, sales, etc.) — premature splitting now would just add request-waterfall overhead for a ~72 kB gzipped app.

## 26. Tests (updated — Release 47 Step 09 correction)

| File | Tests | Covers |
|---|---|---|
| `routing/route-registry.spec.ts` | 16 | Registry integrity, uniqueness, no role-name fields, no standalone `/`, path matching |
| `ui/ui-a11y.spec.tsx` | 9 | Primitive accessibility (labels, roles, focus trap, color-independent status) |
| `auth/platform-auth.spec.tsx` | 5 | Login → MFA enrollment/challenge → session flows, step-up re-auth, **updated**: session revoke now asserts dialog-first flow |
| `auth/platform-rbac.spec.tsx` | 5 | Permission-gated nav/route access, unauthorized redirects |
| `auth/confirmation-governance.spec.tsx` | 5 | **New.** High-impact governance invariants for personal session revoke: open-without-API, cancel-without-API, confirm-once, double-click-once, step-up-cancel-never-falls-through (§17) |
| `auth/platform-activity.spec.ts` | 2 | Activity/session-summary helpers |
| `pages/platform-user-lifecycle-confirm.spec.tsx` | 7 | **New.** Suspend/reactivate/remove-role/admin-session-revoke/admin-revoke-all confirmation dialogs, reason requirement, API call shape (§17) |
| `pages/mfa-reset-confirm.spec.tsx` | 5 | **New.** MFA reset approve/reject confirmation dialogs with an optional reason (§17) |
| `shell/permission-nav.spec.tsx` | 8 | Permission-policy-driven nav visibility and route access (public/authenticated/permission/anyOf/allOf, role-bypass regression) |
| `shell/shell.spec.tsx` | 6 | Skip link, main landmark, no tenant/patient selector, document title, user menu, sign-out |
| `shell/responsive-nav.spec.tsx` | 3 | Mobile menu button, drawer open/close/Escape, drawer auto-close on navigation |
| `shell/localization.spec.tsx` | 5 | **New.** Language switcher flips `lang`/`dir`, translates nav/title/account-menu, mobile drawer under `rtl`, localized confirmation dialog (§23) |
| `i18n/locale-storage.spec.tsx` | 7 | **New.** Super Admin's isolated `booking.super-admin.locale` key: never reads/writes `booking.locale`, invalid-value fallback, `lang`/`dir` sync (§23) |
| `i18n/messages.parity.spec.ts` | 3 | **New.** `en-US`/`ar-SY` flattened-key parity and non-empty-value invariants (§23) |
| `scaffold.spec.tsx` | 12 | Legacy Step 06 scaffold-level auth/error-boundary coverage (still exercises the current shell via `AppRouter`) |
| **Total** | **98** | |

Package-level coverage: `packages/i18n/src/locale-storage.spec.ts` (14 tests) — `loadStoredLocale`/`persistLocale`/`createTranslator` with default and custom `storageKey`s, invalid-value fallback, `missingFallback`. `apps/clinic-dashboard/src/i18n/locale-default.test.ts` (3 tests) — verified still green with the default (unconfigured) storage key, confirming the `@booking/i18n` change is backward compatible.

All 98 Super Admin tests pass (`npm run test`), typecheck passes (`npm run typecheck`, `tsc -b`), and the production build succeeds (`npm run build`).

**Fixed in the original Step 09 pass:** `platform-auth.spec.tsx`'s enrollment test asserted the enrollment secret text (`getByText('ABCDEF234567')`) immediately after the heading appeared, with no `waitFor` around it. The heading renders synchronously on first paint (before the mocked `begin-enrollment` network call resolves), so under system load the secret assertion could run before the async state update landed — an intermittent, pre-existing timing race, not a regression from that step's layout changes (verified by running the same file in isolation, where it consistently passed). Wrapped the assertion in `waitFor` to remove the race; no production code changed.

**Fixed in this correction pass:** a translation typo in `messages.ts` (`shell.userMenu.mySecurity` was `'أماني الشخصي'`, a false-friend confusion with أمنية/"wish" rather than أمان/"security") was corrected to `'الأمان الشخصي'`.

## 27. Rollback

The shell is additive and route-registry-driven:
- Reverting `src/shell/AppShell.tsx` to a stub, or reverting `src/app/router/index.tsx` to a flatter route list, does not require touching `platform-auth`/RBAC domain code — the auth/permission layer is a dependency of the shell, not the other way around.
- `ScaffoldLayout.tsx` remains as a compatibility re-export (`export { AppShell as ScaffoldLayout }`) so any external/lingering import of the old Step 06 name keeps resolving; deleting it is safe only once confirmed unreferenced.
- The route registry (`route-registry.ts`) is the only place that would need edits to add, remove, or re-gate a route — no route wiring exists elsewhere.
- No API/Prisma/backend changes were made or are required to roll this step back; it is frontend-only.

## 28. Step 10 integration points (placeholders only)

Step 10 (dashboard data) is expected to replace `PlaceholderPage` for the `overview` route only, without touching:
- The route registry entry itself (path, policy, nav placement) — only `PlaceholderPage` swaps for a real `OverviewPage`.
- `resolveDefaultRoutePath` — Overview remains the default landing target.
- The shell, nav, header, or breadcrumb components — Step 10 is a page-body implementation, not a chrome change.

No dashboard data, metrics, tenant counts, or business content was implemented in this step — `PlaceholderPage` renders only registry metadata (title, description, "Available in Step 10" note) for `/overview` today, exactly as it does for every other later-step route.

---

## Appendix: files touched in this verification/fix pass

- `src/pages/PlatformUserDetailPage.tsx`, `PlatformUserInvitePage.tsx`, `PlatformRolesPage.tsx`, `MfaResetApprovePage.tsx`, `MfaEnrollPage.tsx`, `MfaChallengePage.tsx`, `ActivateInvitationPage.tsx` — wrapped with `PageLayout` (§20).
- `src/styles/super-admin-shell.css` — added missing `.skip-link` styles; fixed two physical-property RTL gaps (§23).
- `src/auth/platform-auth.spec.tsx` — de-flaked one timing-dependent assertion (§26).
- `apps/super-admin/README.md`, `docs/SUPER_ADMIN_APP_SCAFFOLD.md` — updated to reflect Step 09 completion.
- This document (new).

No API, Prisma, or backend code was modified. No Step 10 dashboard data was implemented.

## Appendix: files touched in the Release 47 Step 09 focused UI correction pass (§0)

- `packages/i18n/src/index.ts`, `packages/i18n/src/react.tsx` — configurable `storageKey`, `createTranslator`'s optional `missingFallback`. Backward compatible: no `storageKey` = existing `booking.locale` behavior, unchanged for `clinic-dashboard`.
- `packages/i18n/src/locale-storage.spec.ts`, `packages/i18n/vitest.config.ts`, `packages/i18n/package.json` (`test` script + `vitest` devDependency) — new package-level test coverage.
- `apps/super-admin/src/i18n/locale.ts` (new) — `SUPER_ADMIN_LOCALE_STORAGE_KEY`.
- `apps/super-admin/src/app/providers/AppProviders.tsx` — `I18nProvider` now passes the Super Admin storage key.
- `apps/super-admin/src/ui/ConfirmationDialog.tsx` — optional `description`/`reasonRequired`/`reasonLabel`/`reasonValue`/`onReasonChange`/`reasonError`/`error` props, cancel-first focus, pending/reason-aware disabled state, double-submit guard.
- `apps/super-admin/src/shell/useHighImpactAction.ts` (new) — the governance state machine described in §17.
- `apps/super-admin/src/pages/SecuritySessionsPage.tsx`, `PlatformUserDetailPage.tsx`, `MfaResetApprovePage.tsx` — wired onto `useHighImpactAction`; `PlatformUserDetailPage` gained a "Revoke all sessions" action.
- `apps/super-admin/src/pages/status-labels.ts` (new), `apps/super-admin/src/i18n/format.ts` (new) — small shared helpers used by the localized pages.
- `apps/super-admin/src/i18n/messages.ts` — full `confirm.*` catalog plus complete parity migration of every remaining page's literal strings (§23); fixed the `mySecurity` Arabic translation typo.
- `apps/super-admin/src/shell/UserMenu.tsx` — language switcher menu items.
- `apps/super-admin/src/auth/PlatformAuthProvider.tsx`, `StepUpModal.tsx`, and every page under `apps/super-admin/src/pages/` — migrated remaining hardcoded strings to `t(...)` with English fallbacks.
- New/updated tests: `apps/super-admin/src/i18n/locale-storage.spec.tsx`, `messages.parity.spec.ts`, `shell/localization.spec.tsx`, `auth/confirmation-governance.spec.tsx`, `pages/platform-user-lifecycle-confirm.spec.tsx`, `pages/mfa-reset-confirm.spec.tsx`, and an updated `auth/platform-auth.spec.tsx` (§26).

No API, Prisma, or backend code was modified in this pass either. Step 10 was explicitly out of scope and was not touched.
