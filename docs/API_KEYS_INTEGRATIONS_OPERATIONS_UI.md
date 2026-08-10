# API Keys & Integrations — Operations UI (Phase 44e)

**Phase:** 44e  
**Status:** Operations UI complete — **PRODUCTION ACCEPTED** with Release **44.0** (master flag default OFF)  
**Architecture SSOT:** [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md)

Operations hub in **clinic-dashboard** for management, diagnostics, and operator workflows. Thin authenticated read-model / admin APIs only — **no new business engines**.

---

## Navigation

Settings → **API Keys & Integrations** (`/settings/api-integrations`)

| Route | Purpose |
|-------|---------|
| `/settings/api-integrations` | Overview dashboard |
| `.../credentials` | Credential list / search / filter / revoke / expire |
| `.../credentials/new` | Create + one-time reveal |
| `.../credentials/:id` | Metadata / rotate / revoke |
| `.../service-accounts` | List / create / disable |
| `.../scopes` | Scope catalog viewer |
| `.../providers` | Runtime + static registry |
| `.../webhooks` | Subscriptions + secret rotation |
| `.../deliveries` | History / failed / DLQ / retry / replay |
| `.../gateway` | Authn/authz diagnostics |
| `.../quotas` | Quota + usage dashboards |
| `.../metrics` | Metrics / activity / audit catalogs + usage timeline |
| `.../permissions` | Permission matrix viewer |
| `.../configuration` | Feature flags / readiness (no secrets) |
| `.../health` | Engine health |

Region landmark: `#api-integrations-region`

---

## Permissions

Resource: `api.integrations`

| Action | UI |
|--------|-----|
| view | Navigate hub, read lists/diagnostics |
| create | Issue credentials, service accounts, subscriptions |
| update | Rotate credentials, enable/disable webhooks |
| delete | Revoke credentials, delete subscriptions |
| manage | Expire ops, rotate webhook secrets, retry/replay, quota reset, live gateway probe |
| approve | High-risk scopes (engine-enforced) |

Feature flag + license banners shown when dormant / unlicensed.

---

## Operator workflows

### Credential issue

1. Create form → scopes from catalog  
2. One-time reveal dialog (clipboard copy)  
3. Secret never stored in React Query cache  

### Rotate / revoke

Confirm dialogs for destructive actions; rotate opens one-time reveal.

### Webhooks

Create subscription (HTTPS URL + event filters) → optional one-time signing secret. Enable/disable/rotate secret/delete with confirms.

### Deliveries

Filter failed/DLQ; manage can retry or replay.

---

## Backend (44e only)

| Endpoint | Purpose |
|----------|---------|
| `GET /integrations/ops/dashboard` | Aggregation |
| `GET /integrations/ops/scopes` | Scope catalog |
| `GET /integrations/ops/providers` | Providers |
| `GET /integrations/ops/permissions` | RBAC matrix |
| `GET /integrations/ops/configuration` | Config readiness |
| `GET /integrations/ops/metrics-catalog` | Metric/activity/audit names |
| `GET /integrations/service-accounts` | List (read-model) |

Existing 44b–44d engines unchanged.

---

## Accessibility & i18n

- Landmark region + axe e2e (`e2e/api-integrations-a11y.spec.ts`)
- Skeleton loading, empty/error states, confirm dialogs
- EN/AR settings nav strings updated
- Responsive nav (row scroll on mobile)

---

## Known limitations

- Activity/audit timelines from in-process usage ring (not full Audit platform search UI)
- Log viewer is catalog + usage events (no external log backend)
- Charts use stat cards (project Recharts available for later polish)
- Center remains dormant while flag OFF

---

## Production readiness checklist

See [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md) and [`RELEASE_44_0.md`](./RELEASE_44_0.md).

- [x] Flag remains default OFF until enablement gate  
- [x] Pepper + secret store documented  
- [x] License `allowIntegrations` documented  
- [x] RBAC roles documented  
- [x] E2E a11y spec present  
- [x] Dual-read migration status documented  
- [x] Redis quotas decision (OD-REDIS) documented for multi-node  

---

## Release

**Release 44.0 READY** — enablement controlled; see enablement gate in Production Acceptance.
