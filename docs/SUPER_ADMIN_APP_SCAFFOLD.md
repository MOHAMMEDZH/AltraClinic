# Super Admin Application Scaffold — Release 47 Step 05

| Field | Value |
|-------|--------|
| **Status** | Scaffold complete |
| **Package** | `@booking/super-admin` |
| **Location** | `apps/super-admin` |
| **Runtime purpose** | Dedicated internal SaaS control-plane UI for Healthcare ERP |
| **Page title** | Super Admin |
| **Dev port** | `5176` (clinic-dashboard `5173`, patient-portal `5175`) |
| **Preview port** | `4176` |
| **Env prefix** | `VITE_SUPER_ADMIN_*` (+ shared `VITE_API_BASE_URL`) |
| **Deployment name** | `super-admin` (hosting wiring deferred to Step 29) |
| **Build output** | `apps/super-admin/dist` |

> **Update (Step 09):** the "full design shell" deferred below has been implemented and supersedes the placeholder routes/layout described in this scaffold document. `ScaffoldLayout` now re-exports the Step 09 `AppShell`. See **`docs/SUPER_ADMIN_DESIGN_SYSTEM_SHELL.md`** for the current shell, route registry, and permission-policy model — this document is kept for historical scaffold-era context (ports, env vars, initial security-boundary assumptions remain accurate).

## Commands

| Action | Command |
|--------|---------|
| Develop | `npm run dev:super-admin` |
| Build | `npm run build:super-admin` |
| Test | `npm run test:super-admin` |
| Typecheck | `npm run typecheck --workspace=@booking/super-admin` |

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPER_ADMIN_APP_NAME` | No (default `Super Admin`) | Display name |
| `VITE_SUPER_ADMIN_ENV` | No (default `development`) | `development` \| `test` \| `production` |
| `VITE_API_BASE_URL` | No (default `/api`) | Placeholder for future API base; unused by scaffold |

No secrets, JWT keys, tenant IDs, or credentials are accepted.

## Routes (placeholders)

| Path | Purpose |
|------|---------|
| `/` | Home / identity |
| `/login` | Login placeholder (Step 06) |
| `/unauthorized` | Unauthorized placeholder |
| `/not-found` or `*` | Not found |
| `/overview`, `/tenants`, `/catalog`, `/plans`, `/platform-users`, `/operations`, `/audit`, `/sales`, `/settings` | Later-step placeholders |

## Security boundary assumptions

- No clinic tenant context or patient context.
- No shared localStorage/session keys with clinic-dashboard or patient-portal.
- No platform authentication (Step 06), MFA (Step 07), or RBAC (Step 08).
- No PHI, clinical fixtures, fake metrics, or fake authenticated sessions.
- Shared package reuse: `@booking/design-tokens` only (no module-registry, permissions, or tenant providers).

## Explicitly deferred

Platform Authentication, MFA, sessions, RBAC, platform users, catalog, plans, subscriptions, entitlements, tenant APIs, dashboard data, sales, operations, full design shell (Step 09).

## CI

Application-specific CI job deferred to **Step 29** per execution plan (existing workflows cover dashboard and Phase 28 licensing only). Local scripts are available now.

## Next step

**Step 06 — Platform Authentication**
