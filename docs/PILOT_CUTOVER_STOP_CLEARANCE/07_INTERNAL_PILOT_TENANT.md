# Internal pilot tenant onboard (NOT product production cutover)

| Field | Value |
|-------|--------|
| **Result** | **PASS** (internal pilot only) |
| **Base tip** | `94474e2` (PR #10 merge lineage) |
| **Branch** | `cursor/pilot-tenant-internal-onboard` |
| **Evidence** | `apps/api/.ci-evidence/pilot-tenant-94474e2/` (**uncommitted**) |
| **API runtime role** | `pilot_neon_app` (`rolbypassrls = false`) |
| **Owner as API `DATABASE_URL`** | **NO** |
| **Plain Nest boot** | **YES** (analytics demo seed soft-fail in-repo) |

## Tenant (non-secret)

| Field | Value |
|-------|--------|
| **Slug** | `pilot-internal-23662564` |
| **Tenant id** | `b0892f1d-6984-418a-be81-4b531a6cf318` |
| **Platform tenant id** | `5969ed38-e1cf-436f-a54a-a34a05181420` |
| **Platform status** | `ACTIVE` |
| **Admin email (internal)** | `admin@pilot-internal-23662564.internal` |
| **Kind** | Internal test clinic — **not** a paying customer |

Provisioned via product **Step 17** `TenantProvisioningService` happy path (same SoR as Super Admin onboarding), after ops seed of healthcare catalog + plans on Neon (owner URL for seed/ops only).

## Proof table

| Check | Result |
|-------|--------|
| `GET /health/live` | **200** |
| `GET /health/ready` | **200** |
| Staff `POST /auth/login` (tenant-scoped) | **200** |
| Smoke `GET /patients` (read-only list) | **200** |

Clinic-dashboard can target the same local API URL (`http://127.0.0.1:3014` during proof). Staff password held only in gitignored `apps/api/.env.pilot.staff.local` (not committed).

## Thin code fixes included (pilot blockers under FORCE RLS)

1. **LoginHandler** — wrap tenant login in `TenantExecutionService.runAsTenant` so `login_attempts` / users see `app.current_tenant_id`.
2. **LicensingLifecycleStateService** — persist/sync lifecycle rows inside `withTenantContext` (empty GUC was casting `''::uuid` → 500 on patients list).

## Explicit OUT

```text
Product production cutover = NOT CLAIMED
Payment live / Stripe = NOT DONE
Public launch = NOT DONE
Multi-tenant fleet = NOT DONE
D-17 prod topology = NOT DONE (EXTERNAL)
Phase 52 / D5 picker = OUT
Real external paying customers = NOT ONBOARDED
Owner/superuser as API DATABASE_URL = NO
RLS disabled / BYPASSRLS on runtime = NO
```

## L3 subset

Followed Phase 51 L3 provision + smoke intent for **one** internal tenant; commercial Stripe live and cutover gates remain **not** claimed. C5 STOP S1–S4 already cleared at packaging/merge lineage.
