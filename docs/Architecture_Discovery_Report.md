# Architecture Discovery Report — Release 47 Super Admin & Platform Management

**Document type:** Architecture Discovery (Step 01)  
**Release:** **47** — Super Admin & Platform Management  
**Date:** 2026-07-19  
**Status:** **DISCOVERY COMPLETE** — no implementation authorized by this document  
**Method:** Repository evidence + existing approved architecture documentation  
**Evidence priority:** Repository facts override outdated docs when they conflict  

---

## Executive Summary

The Healthcare ERP monorepo is an **npm workspaces** system with three verified applications (`apps/api`, `apps/clinic-dashboard`, `apps/patient-portal`), five shared packages, and a NestJS module catalog covering clinical, operational, and platform Centers through Release **46**.

**Super Admin today (verified):**

| Layer | Status |
|-------|--------|
| Dedicated `apps/super-admin` application | **Missing** (0 files under that path) |
| Backend `platform-admin` bounded context | **Existing** — `/platform/tenants*` APIs |
| Clinic-dashboard embedded subscription/platform admin UX | **Partial** — `/settings/subscription/admin` + `/platform/tenants` client calls |
| Dedicated Phase 47 / Super Admin architecture SSOT | **Missing** — no `docs/*PHASE_47*` / `docs/*SUPER*ADMIN*` SSOT found |
| Role `super_admin` + `api.platform_admin` permission resource | **Existing** |

Phase numbering in frozen Patient Portal SSOT states **Phase 47 = Super Admin Console**. Information Architecture documents a **desired** Super Admin portal IA and separately documents an **implemented** platform-admin API. There is **no** Release-47-approved Option / OD freeze document comparable to Releases 41–46 Center SSOTs.

This Step 01 report is **discovery only**. It does not authorize implementation, scaffolding, migrations, or API/UI work.

---

## 1. Repository Overview

### Verified structure

| Path | Evidence | Classification |
|------|----------|----------------|
| Root `package.json` | workspaces `apps/*`, `packages/*`; Node `>=20` | **Verified** |
| `package-lock.json` | Present at repo root | **Verified** (npm) |
| `turbo.json` | Not present | **Verified absent** |
| `apps/api` | NestJS API | **Verified** |
| `apps/clinic-dashboard` | Vite + React staff app | **Verified** |
| `apps/patient-portal` | Vite + React patient app (Release 46) | **Verified** |
| `apps/super-admin` | Path not found | **Verified missing** |
| `apps/smart-tv` | Path not found | **Verified missing** |
| `packages/*` | design-tokens, dashboard-export, i18n, module-registry, permissions | **Verified** |
| `docs/` | Large architecture / phase / release corpus | **Verified** |
| `docker-compose.test.yml` | Postgres 16 + Redis 7 for tests | **Verified** |
| `.github/workflows/` | `clinic-dashboard-ci.yml`, `phase28-licensing-ci.yml` | **Verified** |

### Doc vs repo divergence (important)

| Claim | Source doc | Repository evidence |
|-------|------------|---------------------|
| Turborepo orchestrates monorepo | `docs/MONOREPO.md` | **No** `turbo.json`; npm workspaces only |
| Apps include `super-admin`, `smart-tv` | `docs/MONOREPO.md` proposed layout | **Absent** on disk |
| No patient-portal app | `docs/CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md` (2026-07-11) | **Outdated** — `apps/patient-portal` exists post–Phase 46 |
| Super Admin = dedicated portal | IA / MONOREPO | Backend API exists; **dedicated app missing** |

---

## 2. Technology Stack

| Concern | Verified stack | Evidence |
|---------|----------------|----------|
| Package manager | **npm** workspaces | Root `package.json`, `package-lock.json` |
| Language | TypeScript (API + frontends) | `apps/*/package.json`, `tsconfig` usage |
| Node | `>=20` | Root `engines` |
| Backend | NestJS **10.x** | `apps/api/package.json` |
| Frontend | React **18.3**, Vite **5.4**, React Router **6.26** | clinic-dashboard + patient-portal manifests |
| ORM | Prisma **5.22** | `apps/api` deps + `apps/api/prisma` |
| Database | PostgreSQL (docs: 16+; compose: `postgres:16-alpine`) | `docs/DATABASE.md`, `docker-compose.test.yml` |
| Cache / jobs | Redis + BullMQ | `docs/REDIS-ARCHITECTURE.md`, `apps/api` modules `queue` / redis infra |
| Auth | JWT + Passport JWT; refresh tokens; MFA (otplib) | `docs/AUTH.md`, `apps/api` auth module |
| Realtime | Socket.IO | `docs/REALTIME-ARCHITECTURE.md`, `@nestjs/websockets` |
| Testing (API) | Jest | `apps/api` scripts `test`, `test:integration` |
| Testing (FE) | Vitest; Playwright (clinic-dashboard e2e) | package scripts |
| Containers | Docker Compose (test Postgres/Redis) | `docker-compose.test.yml` |
| Observability | In-platform Observability Center (Release 45) | `apps/api/src/modules/observability`, docs |
| Deployment / IaC cloud | Not verified beyond compose + GitHub Actions | **Not verified from repository evidence** for production cloud topology |

---

## 3. Existing Applications

### `apps/api` (`booking-system-api`)

| Field | Finding |
|-------|---------|
| Purpose | Single backend for staff dashboard, patient portal, platform APIs |
| Responsibilities | Auth, RBAC, tenancy, clinical/ops domains, Centers 41–46, platform-admin |
| Maturity | Production-oriented; large Nest module set; Prisma + RLS tooling |
| Dependencies | Nest, Prisma, Redis/BullMQ, JWT/Passport, Socket.IO |

### `apps/clinic-dashboard` (`@booking/clinic-dashboard`)

| Field | Finding |
|-------|---------|
| Purpose | Primary **staff** web application |
| Responsibilities | Clinical/ops UX, settings, subscription admin surfaces, dynamic routing |
| Maturity | Mature feature surface; dynamic route catalog; Vitest + Playwright |
| Dependencies | React/Vite, design-tokens, i18n, module-registry, dashboard-export, permissions |

### `apps/patient-portal` (`@booking/patient-portal`)

| Field | Finding |
|-------|---------|
| Purpose | Dedicated **patient** web application (Release 46 Option B) |
| Responsibilities | Enrollment/session, appointments facade, caregivers, portal experience |
| Maturity | Release 46.0 production-accepted; flags default OFF |
| Dependencies | React/Vite, design-tokens, i18n, module-registry |

### Not present (verified missing)

- `apps/super-admin`
- `apps/smart-tv`

---

## 4. Existing Domain Boundaries (API modules)

Verified Nest module directories under `apps/api/src/modules/` (from module registration evidence):

| Module | Nature |
|--------|--------|
| `auth`, `identity`, `tenant`, `settings` | Identity / tenancy / config |
| `patients`, `scheduling`, `emr`, `dental`, `beauty` | Clinical / specialty |
| `inventory`, `billing`, `commission`, `loyalty` | Operations / finance |
| `notifications`, `workflow`, `ai`, `media`, `search`, `reporting`, `analytics`, `dashboard` | Cross-cutting clinic capabilities |
| `audit`, `subscription`, `module-registry` | Governance / licensing adjacency |
| `platform-admin` | **Platform operator** tenant lifecycle & privileged access |
| `import-export`, `backup-restore`, `integrations`, `observability` | Centers (Releases ~42–45) |
| `patient-portal` | Patient facade BC (Release 46) |
| `queue`, `background`, `realtime` | Infrastructure |

**Do not invent additional bounded contexts.** Marketplace packs, dedicated CRM, and dedicated support-desk modules were **not** verified as first-class module folders.

---

## 5. Authentication & Authorization

### Authentication — **Verified**

| Topic | Status | Evidence |
|-------|--------|----------|
| Mechanism | JWT access + refresh | `docs/AUTH.md`; `@nestjs/jwt`, `passport-jwt` |
| Strategy | Passport JWT | Auth module |
| MFA | TOTP setup/verify/disable (+ portal MFA paths) | Auth controllers; `otplib` |
| Sessions | Session id on refresh / device management documented | `docs/AUTH.md` |
| Patient session class | Distinct portal session (`sessionClass: patient`) | Patient-portal module (Release 46) |
| External IdP (OIDC/SAML enterprise SSO) | **Not verified** as implemented product | Mark **Not verified / not currently implemented** as full IdP federation |

### Authorization — **Verified**

| Topic | Status | Evidence |
|-------|--------|----------|
| RBAC | Permission matrix + `@RequirePermission` | `apps/api/config/permission-matrix.json`, `packages/permissions` |
| Platform resource | `api.platform_admin` | Matrix + platform-admin controller |
| Role | `super_admin` (platform-level) | `docs/AUTH.md`; platform-admin policy also references `system_administrator` |
| Clinic roles | Owner, GM, clinical, reception, etc. | AUTH / permission docs |

### Support / break-glass access — **Partial**

Platform-admin privileged-access grant lifecycle (request / approve / reject / revoke) exists in API handlers. Full Super Admin “support console” UX is **not** verified as a dedicated app.

---

## 6. Tenant Architecture — **Verified**

| Topic | Finding | Evidence |
|-------|---------|----------|
| Model | Shared-table multi-tenancy + `tenantId` | `docs/DATABASE.md`, `docs/TENANCY.md`, Prisma `Tenant` |
| Tenant fields | id, name, slug, status/lifecycle, locale, features JSON, soft-delete, etc. | `schema.prisma` `Tenant` |
| Resolution | JWT + headers / tenant context services | API tenant module + guards |
| RLS | Second-layer policies; apply scripts | `db:rls:apply`, `docs/RLS_COVERAGE_MATRIX.md` |
| Platform bypass | Documented BYPASSRLS / platform ops path | `docs/DATABASE.md` |
| Provisioning | Platform-admin provision/activate/suspend/resume/archive | `platform-admin` handlers |
| Branch | Multi-branch Center exists | `docs/DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md`, settings/branch patterns |

---

## 7. Existing Platform Components (classification)

| Capability | Classification | Evidence |
|------------|----------------|----------|
| Billing (clinic) | **Existing** | `modules/billing` |
| Platform revenue / SaaS billing console | **Partial / Missing UI** | Subscription + plan change APIs; no dedicated super-admin billing app |
| Licensing / subscription enforcement | **Existing** | `modules/subscription`, licensing docs, Phase 28 acceptance |
| Feature flags | **Partial** | Env/module flags + `Tenant.features` JSON; no dedicated feature-flag Center app |
| Audit | **Existing** | `modules/audit` + Dynamic Audit Center docs |
| Monitoring / observability | **Existing** | `modules/observability` (Release 45) |
| Notifications | **Existing** | `modules/notifications` (Release 41) |
| Backup / restore | **Existing** | `modules/backup-restore` |
| Scheduled / background jobs | **Existing** | BullMQ / `queue` / `background` |
| Integrations / API keys | **Existing** | `modules/integrations` (Release 44) |
| Import / export | **Existing** | `modules/import-export` (Release 42) |
| Support desk / ticketing CRM | **Missing** | No verified support/CRM module folder |
| Dedicated Super Admin app | **Missing** | No `apps/super-admin` |
| Platform tenant control API | **Existing** | `platform-admin` |

---

## 8. UI Architecture

### Clinic dashboard — **Verified**

- Vite + React 18 + React Router 6  
- App shell / dynamic routing (`features/dynamic-routing`)  
- Design tokens package; i18n package (ar/en, RTL)  
- Module registry for capability surfaces  
- Embedded subscription admin at settings routes (not a separate platform app)

### Patient portal — **Verified**

- Dedicated Vite app; portal shell; WL/a11y/i18n patterns (Release 46)

### Super Admin UI — **Missing / Partial**

| Desired (IA §6.9 / §8) | Repo status |
|------------------------|-------------|
| Dedicated Super Admin portal | **Missing** |
| Platform dashboard / tenant directory / global users / monitoring IA | **Wishlist in docs** — not verified as dedicated app |
| Tenant lifecycle controls | **Partial** via clinic-dashboard subscription admin + platform APIs |

---

## 9. API Architecture — **Verified**

| Topic | Finding |
|-------|---------|
| Style | REST over NestJS controllers |
| Structure | Module → api / application / domain / infrastructure |
| DTOs / validation | class-validator / Nest pipes (module pattern) |
| Errors | Domain exception filters (e.g. platform-admin filter) |
| Versioning | Namespace by controller path (e.g. `/platform/tenants`); global API versioning strategy **not fully verified** as URI `/v1` everywhere |
| Platform-admin surface | `@Controller('platform/tenants')` with create/lifecycle/plan/privileged-access/list/get |

---

## 10. Data Layer — **Verified**

| Topic | Finding |
|-------|---------|
| ORM | Prisma |
| Schema | `apps/api/prisma/schema.prisma` |
| Migrations | Prisma migrate workflow documented |
| RLS | SQL policies + apply scripts |
| Seeds | `prisma db seed` script in API package |
| Transactions | Prisma interactive transactions used in handlers (pattern) |
| Naming | Prisma models / camelCase fields; SQL maps where noted |

---

## 11. Testing Strategy — **Verified**

| Layer | Tooling | Notes |
|-------|---------|-------|
| API unit/integration | Jest | Per-module `tests/`; integration config exists |
| Clinic dashboard | Vitest + Playwright e2e | Scripts in package + root |
| Patient portal | Vitest | Release 46 suites |
| CI | GitHub Actions (dashboard CI; licensing CI) | Limited workflow set |
| Coverage gates | Not verified as universal enforced threshold | **Not verified** |

---

## 12. Existing Documentation (selected)

### Authoritative / foundational

- `docs/PROJECT_CONSTITUTION.md`
- `docs/AUTH.md`, `docs/TENANCY.md`, `docs/DATABASE.md`, `docs/SECURITY.md`
- `docs/FRONTEND-ARCHITECTURE.md`, `docs/INFORMATION_ARCHITECTURE.md`
- `docs/MONOREPO.md` (aspirational layout — diverge from disk)
- `docs/CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md` (dated; partially superseded)

### Centers / releases (examples)

- Notifications, Audit, Activity, White Label, Module Management, Multi-Branch  
- Import/Export (42), Backup/Restore (43), Integrations (44), Observability (45), Patient Portal (46)  
- Licensing architecture + Phase 28 acceptance  

### Super Admin / Phase 47

| Document | Role |
|----------|------|
| Dedicated Super Admin architecture SSOT | **Not found** |
| Dedicated Phase 47 discovery/review/execution SSOT | **Not found** |
| `INFORMATION_ARCHITECTURE.md` §6.9 / §8 | Desired IA + notes on implemented platform-admin API |
| `PATIENT_PORTAL_ARCHITECTURE.md` numbering note | States Phase 47 = Super Admin Console |
| Phase 46 review docs | Explicitly defer Super Admin to Phase 47 |

**Conclusion:** There is **no** frozen Release 47 architecture decision register yet. Discovery must not invent ODs.

---

## 13. Gap Analysis (vs desired Super Admin / Platform Management)

Reference targets used for comparison (not a frozen OD set):

1. IA Super Admin portal experience (§6.9 / §8)  
2. MONOREPO proposed `apps/super-admin`  
3. Existing `platform-admin` API capabilities  
4. Phase numbering expectation that Phase 47 is Super Admin Console  

### Already Exists

- `super_admin` role and `api.platform_admin` matrix resource  
- `platform-admin` Nest BC: tenant provision, activate, suspend, resume, archive, plan change  
- Privileged-access grant workflow (request/approve/reject/revoke)  
- Multi-tenant data model + RLS tooling  
- Licensing/subscription enforcement (clinic edge)  
- Audit, Activity, Observability, Notifications, Backup, Integrations Centers  
- Embedded subscription/platform admin fragments in clinic-dashboard  

### Needs Extension

- Platform operator UX (today partial inside clinic-dashboard settings)  
- Clear separation of **staff clinic chrome** vs **platform operator chrome**  
- Platform-wide health/KPI/support queues envisioned in IA (ops signals exist in Observability but not as Super Admin product shell)  
- Documentation: Phase 47 architecture freeze, execution plan, OD register  

### Missing Completely

- Dedicated `apps/super-admin` (or equivalent dedicated operator app)  
- Dedicated Phase 47 architecture SSOT / review / execution plan  
- Verified Support CRM / ticket system  
- Verified platform-global user directory product (beyond tenant-scoped identity)  
- Verified dedicated feature-flag management console  
- Marketplace / plugin store as Super Admin surface (referenced elsewhere as future)

### Must Not Change (without formal architecture change control)

- Existing Center SSOTs for Releases **41–46** (immutable baselines)  
- Tenant isolation / RLS strategy as documented  
- Permission-matrix governance model  
- Patient Portal Option B dedicated-app decision (Release 46)  
- Platform-admin API as SoR for **platform tenant lifecycle** unless change-controlled  

### Requires Refactoring (potential — not mandated by this discovery)

- Clinic-dashboard coupling of platform-admin calls into subscription settings (may conflict with dedicated Super Admin app topology)  
- Naming drift (`api.platform_admin` vs occasional `api.platform-admin` string in catalogs) — **partially verified**  
- MONOREPO.md / older audit docs outdated relative to patient-portal existence  

---

## 14. Security & Privacy Guardrails (current status only)

| Control | Current status |
|---------|----------------|
| Authentication | **Implemented** (JWT + MFA paths) |
| Authorization / RBAC | **Implemented** |
| Audit logging | **Implemented** (Audit Center + domain adapters) |
| Tenant isolation | **Implemented** (app + RLS) |
| PHI protection posture | Documented + portal PHI minimization; clinical SoRs remain clinic-side |
| Secrets management | Env-based; production KMS details **Not verified** |
| Session security | Access/refresh + portal session class |
| MFA | **Implemented** (staff + portal) |
| Support / privileged access | **Partial** (API grants; limited UX) |
| Super Admin least-privilege split roles | **Not currently implemented** as separate operator roles product (IA critique recommends split) |

---

## 15. Risks

1. **Starting Phase 47 implementation without a frozen Super Admin SSOT** risks inventing topology that conflicts with existing `platform-admin` API and clinic-dashboard embeds.  
2. **Embedding more platform ops in clinic-dashboard** increases blast radius and weakens session/chrome separation (same risk class as pre–Option B patient portal).  
3. **Outdated docs** (audit 2026-07-11; MONOREPO Turborepo) can mislead discovery if treated as current truth.  
4. **`super_admin` power concentration** called out in IA — two-person privileged access exists in API but product UX incomplete.  
5. **Scope creep** into Support CRM / global billing console / feature-flag Center without explicit Phase 47 MVP freeze.

---

## 16. Unknowns / Not Verified

- Production hosting topology (K8s/VM/serverless) — **Not verified from repository evidence**  
- Whether `system_administrator` vs `super_admin` are both live seeded roles in all environments  
- Full inventory of platform-admin Prisma models vs `Tenant` dual-write semantics — needs deeper schema read in later architecture step  
- Intended Phase 47 MVP boundary (app-only vs API expansion vs both) — **requires future decision**  
- Whether Super Admin must be a **new dedicated app** (MONOREPO/IA) or an **expansion of platform-admin API + new SPA** — **requires future decision**  
- Cross-tenant analytics / revenue dashboards product ownership — **Not verified**

---

## 17. Questions Requiring Future Decisions

1. Is Phase 47’s approved topology a **dedicated `apps/super-admin`** (Option analogous to Patient Portal B)?  
2. What is the **MVP** vs deferred IA wishlist (support queue, compliance vault, global users, billing console)?  
3. Does platform-admin remain the **SoR** for tenant lifecycle, with Super Admin as consumer facade only?  
4. How are **staff sessions** vs **platform operator sessions** separated (session class / app boundary)?  
5. Should clinic-dashboard platform admin routes be **deprecated**, **redirected**, or **retained for owners**?  
6. What license/feature flags gate Super Admin product enablement?  
7. Which Releases 41–45 Centers are **in-MVP consumed** vs out of scope for 47.0?

---

## 18. Recommended Next Step

**Do not implement.**

Proceed to the next playbook step for Release 47 only after this discovery is accepted:

1. **Architecture Review & Option selection** (dedicated Super Admin app vs embedded vs hybrid)  
2. Produce a **frozen Super Admin / Platform Management architecture SSOT** with OD register  
3. Then an **Execution Plan** with gated milestones  

Stop condition for Step 01: this report only.

---

## Final Report Index (acceptance checklist)

| Required section | Status |
|------------------|--------|
| Summary | Complete |
| Repository Evidence | Complete |
| Technology Stack | Complete |
| Existing Architecture | Complete |
| Existing Platform Capabilities | Complete |
| Existing Security Architecture | Complete |
| Existing Tenant Architecture | Complete |
| Existing Documentation | Complete |
| Gap Analysis | Complete |
| Risks | Complete |
| Unknowns | Complete |
| Recommended Next Step | Complete |

### Step 01 constraints compliance

- No production code changed  
- No migrations created  
- No APIs/UI implemented  
- No packages installed  
- Discovery document only  

---

**Evidence note:** Where older docs conflict with the 2026-07-19 repository tree, this report prefers the repository. Notably, `apps/patient-portal` exists; `apps/super-admin` does not; npm workspaces are used without Turborepo.
