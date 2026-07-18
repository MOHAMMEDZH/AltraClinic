# Healthcare ERP — Complete Engineering Audit & System Explanation

**Audit date:** 2026-07-11  
**Auditor posture:** Independent CTO / Principal Architect panel (evidence-based; prior claims not assumed)  
**Scope:** Entire monorepo — `apps/api`, `apps/clinic-dashboard`, `packages/*`, `apps/api/prisma`  
**Method:** Source tracing, module wiring review, test inventory, schema analysis, cross-check against `docs/FEATURE_INVENTORY.md` and architecture docs

---

## PART 1 — EXECUTIVE SUMMARY

### What the product is

An **enterprise multi-tenant Healthcare ERP SaaS** for clinics operating medical, dental, and beauty services. It combines patient administration, scheduling, clinical documentation (EMR), specialty modules (dental odontogram, beauty treatment plans), inventory, billing, reporting, analytics, notifications, workflows, AI assistant, and tenant settings — delivered primarily through a **staff-facing clinic dashboard** backed by a **NestJS REST API** and **PostgreSQL** (via Prisma).

### Who it serves

| Audience | Current delivery |
|----------|------------------|
| Clinic owners / managers | Dashboard, analytics, settings, subscription, user management |
| Clinical staff (doctors, dentists, nurses, beauty specialists) | EMR, dental, beauty, queue, scheduling |
| Front office (reception) | Scheduling, queue, patients, billing POS |
| Finance (accountants) | Billing, commission, reporting |
| Inventory managers | Full inventory module |
| Patients | Minimal — one portal page inside staff app; backend portal APIs exist |
| Platform operators (super admin) | Backend `platform-admin` API only; **no dedicated super-admin app** |

### Major capabilities that genuinely exist today

- **Authentication:** JWT access + refresh tokens, MFA (TOTP), email verification, password reset, session/device management, login rate limiting (partially in-memory)
- **RBAC:** 18 roles, 24 API resources, 333 permission operations — matrix in `apps/api/config/permission-matrix.json` and `packages/permissions/`
- **Multi-tenancy:** Shared-table model with `tenantId` on tenant-scoped models; header + JWT tenant resolution
- **Core clinical ops:** Patients, appointments, queue, encounters (EMR), dental records, beauty records — **Prisma-backed**
- **Operations:** Inventory (full procurement lifecycle), billing/invoices/payments, commission, loyalty
- **Platform modules:** Notifications center, workflow engine, AI assistant (LLM providers), subscription management, settings center
- **Infrastructure:** Redis (cache/sessions), BullMQ background jobs, outbox pattern, Socket.IO realtime, global search (Prisma), media upload pipeline

### Honest completion assessment (independently verified 2026-07-11)

See **`docs/PRODUCTION_REMEDIATION_VERIFICATION.md`** and **`docs/PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md`** — foundation C1–C6 closed; **Phase 28 Licensing Gate PASS** (permanently closed 2026-07-12).

| Dimension | % Complete | Production-ready? |
|-----------|------------|-------------------|
| **Overall platform** | **68%** | Core ops yes; licensing enforcement complete |
| **Backend API** | **88%** | Full licensing at HTTP edge, dispatch, and workers |
| **Frontend (clinic dashboard)** | **85%** | Unified enterprise license gate; subscription UX strong |
| **Database / schema** | **84%** | Baseline + RLS; `LicenseAuditEvent`, dispatch ledger, lifecycle state tables |
| **Testing** | **98%** | API 203/203 suites; licensing Jest **6/6 suites, 27/27 tests**; licensing Vitest **5/5 files, 20/20 tests**; Playwright licensing matrix **36/36 tests**; Phase 28 CI |
| **Security readiness** | **85%** | RLS wired; durable lifecycle audit; cancelled status write-block verified at runtime |
| **Enterprise Subscription & Licensing (Phase 28)** | **100%** | **Permanently closed** — runtime E2E + unified license UX verified 2026-07-12 |
| **Production remediation P1–P8** | **~92%** | C1–C6 closed; Phase 28 licensing PASS |
| **Enterprise readiness (items 28–46)** | **86%** | Phase 29b runtime verified — Playwright 11/11; cache + rollback proven |

### Top risks (verification-adjusted)

1. **Communication channels use console adapters** — honest failure behavior yes; production SMS/email providers require config
2. **Concurrent dispatch check-then-act window** — mitigated by unique ledger constraint (Low severity)
3. **No super-admin or patient-portal apps** — still absent
4. **UsageMeter table not extracted** — high-frequency counters still aggregated live (Phase 29)

**Licensing reference docs:** [`LICENSING_ARCHITECTURE.md`](./LICENSING_ARCHITECTURE.md) · [`LICENSING_LIFECYCLE_STATE.md`](./LICENSING_LIFECYCLE_STATE.md) · [`LICENSING_ENFORCEMENT_COMPLETION.md`](./LICENSING_ENFORCEMENT_COMPLETION.md) · [`PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md`](./PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md)

### Phase status (evidence-based, not prior session claims)

| Phase | Roadmap intent (`docs/FEATURE_INVENTORY.md`) | Actual status |
|-------|-----------------------------------------------|---------------|
| **Phase 1 (MVP, months 1–3)** | Patient registration, booking, consultation, prescriptions, basic payments, auth, notifications, basic analytics | **~75% Partial** — demo fallbacks remediated; SMS/WhatsApp require provider config; no lab orders |
| **Phase 2 (months 4–6)** | Advanced scheduling, lab/imaging, referrals, inventory, loyalty, provider analytics, patient portal | **~55% Partial** — inventory/workflow/notifications/analytics strong; lab/pharmacy/insurance **not started** |
| **Phase 3 readiness (months 7–9)** | Multi-branch, LIS/pharmacy/insurance, approval workflows, custom reporting, DICOM | **Not ready** — verification FAIL on remediation; external integrations still block |

Prior chat claims of “Phase 1 and Phase 2 at literal 100%” refer to **scoped AI platform work**, not the full Healthcare ERP. This audit treats the **entire repository**.

---

## PART 2 — COMPLETE SYSTEM EXPLANATION (Request Lifecycle)

### End-to-end flow

```
User browser
  → Vite SPA (apps/clinic-dashboard)
  → React Router guards (GuestRoute / ProtectedRoute)
  → AuthProvider bootstrap (refresh token → fetchMe)
  → LicensedApplicationShell (evaluates tenant license before AppShell)
       ├─ active/trial → AppShell (Sidebar from @booking/permissions CLINIC_NAV_ITEMS)
       ├─ expired/suspended/cancelled/grace → EnterpriseLicenseExperience (full-page lock)
       └─ blocked + subscription routes → LicenseMaintenanceLayout (renewal workspace only)
  → Feature page (React Query hooks)
  → apiRequest() with Bearer + x-tenant-id (apps/clinic-dashboard/src/lib/api-client.ts)
  → NestJS HTTP (apps/api/src/main.ts — ValidationPipe, CORS)
  → Global guards (apps/api/src/app.module.ts):
       JwtAuthGuard → MaintenanceModeGuard → RolesGuard → PermissionGuard
  → Controller (@RequirePermission where present)
  → Command/Query Handler (@Injectable application layer)
  → Domain logic / policy services
  → Prisma repository (or direct PrismaService in some beauty paths)
  → PostgreSQL
  → DomainEvent → EventPublisher → Outbox / listeners
  → AuditEntry (PrismaAuditEntryRepository) where wired
  → Notification / Workflow listeners (partial coverage)
  → JSON response → React Query cache → UI render
```

### Step-by-step with files

| Step | What happens | Key files | Status |
|------|--------------|-----------|--------|
| 1. User opens app | Vite serves `index.html`; React mounts | `apps/clinic-dashboard/src/main.tsx` | ✅ |
| 2. Frontend routing | Registry-filtered `STATIC_ROUTE_CATALOG` or static rollback | `features/dynamic-routing/`, `app/router/index.tsx` | ✅ ~140 shell paths; `VITE_USE_STATIC_ROUTES_ONLY` rollback |
| 3. Auth state check | `AuthProvider.bootstrap()` refresh + `fetchMe` | `src/app/providers/AuthProvider.tsx`, `src/lib/auth-api.ts` | ✅ |
| 4. Tenant resolved | Stored in localStorage; sent as `x-tenant-id` | `src/lib/auth-storage.ts`, `api-client.ts` | ⚠️ Header-based; JWT also carries tenant |
| 5. Roles/permissions loaded | `MeResponse.roles`; nav filtered | `packages/permissions`, `Sidebar.tsx` | ✅ UI only |
| 6. Subscription/feature access | `FeatureGate`, `useSubscriptionEntitlements` | `features/subscription/` | ⚠️ Frontend-only for most modules |
| 7. Navigation generated | Registry `EffectiveModuleView` or static `CLINIC_NAV_ITEMS` | `features/dynamic-navigation/`, `Sidebar.tsx` | ✅ Dynamic (29b); `VITE_USE_STATIC_NAV_ONLY` rollback |
| 8. User opens module | Lazy-loaded feature routes | `features/*/lazy-*-routes.tsx` | ✅ |
| 9. Frontend calls API | React Query + `apiRequest` | `features/*/api/*`, `hooks/use*.ts` | ✅ / ⚠️ demo fallback on error |
| 10. Backend authenticates | `JwtAuthGuard` + `@Public()` opt-out | `modules/auth/api/guards/jwt-auth.guard.ts` | ✅ |
| 11. Authorization | `@RequirePermission`, `RolesGuard` | `permission.guard.ts`, controllers | ✅ when decorated |
| 12. Tenant isolation | `TenantContextService`, repo `WHERE tenantId` | `infrastructure/tenant-context.service.ts` | ⚠️ No RLS session |
| 13. Validation | `ValidationPipe` + DTO decorators | `main.ts`, `**/dto/*.ts` | ✅ |
| 14. Handler executes | ~200+ handler classes | `modules/*/application/handlers/` | ✅ |
| 15. Domain logic | Entities, VOs, policy services | `modules/*/domain/` | ✅ varies by module |
| 16. Repository persists | Prisma repositories (most modules) | `modules/*/infrastructure/prisma-*.repository.ts` | ✅ |
| 17. Domain events emitted | `EventPublisherInterface` | `infrastructure/event-publisher`, outbox | ✅ partial consumers |
| 18. Audit records | `PrismaAuditEntryRepository` | `modules/audit/` | ⚠️ Not all sensitive ops |
| 19. Notifications/workflows | Listeners on domain events | `modules/notifications/application/integrations/`, workflow listeners | ⚠️ Partial |
| 20. Response returns | JSON | Controllers | ✅ |
| 21. Cache/UI update | React Query invalidation | Feature hooks | ✅ |
| 22. Error handling | `ApiError`, toast/banners, **demo fallback** | Feature pages | ⚠️ Demo masks failures |

**Missing expected steps:** DB-level RLS session (`withTenantContext`), centralized backend feature gate on all modules, CSRF protection, consistent audit on all PHI mutations.

---

## PART 3 — ARCHITECTURE EXPLANATION

### Actual monorepo structure

```
booking-system/                    (npm workspaces — NOT Turborepo despite docs/MONOREPO.md)
├── apps/
│   ├── api/                       NestJS 10 backend — ONLY backend app
│   └── clinic-dashboard/          Vite + React 18 + React Router 6 — ONLY frontend app
├── packages/
│   ├── permissions/               Role nav + permission matrix consumer
│   ├── i18n/                      EN/AR messages, RTL React provider
│   ├── design-tokens/             CSS tokens
│   └── dashboard-export/          PDF/Excel/Word export utilities
└── docs/                          46 planning/architecture documents
```

**Documented but NOT present:** `apps/super-admin`, `apps/patient-portal`, `apps/smart-tv`, domain packages (`patients`, `emr`, etc. as separate packages — logic lives inside `apps/api/src/modules/`).

### Layered backend architecture (per module)

```
Controller (api/)
  → Handler (application/handlers/) — CQRS-style, NOT @nestjs/cqrs
  → Domain (entities, VOs, events)
  → Repository interface (domain/)
  → Prisma repository (infrastructure/)
  → PrismaService → PostgreSQL
```

| Pattern | Purpose | Where | Consistent? |
|---------|---------|-------|-------------|
| Handler pattern | Command/query separation | All 28 NestJS modules | Mostly yes |
| Repository interfaces | Swappable persistence | Domain folders | Yes — but many in-memory impls remain for tests |
| Prisma repositories | Production persistence | Module `.module.ts` bindings | **Yes for core domains** |
| Domain events | Decouple side effects | `domain/events/`, publishers | Partial — not all modules emit |
| Outbox | Reliable event delivery | `modules/background/` | Implemented |
| Event bus | In-process + BullMQ | `DomainEventBus`, background processors | Partial |
| DI tokens | `USER_REPOSITORY`, etc. | `infrastructure/provider.tokens.ts` | Yes |
| Global guards | Security by default | `app.module.ts` | Yes |
| Policy services | Module RBAC helpers | `*-policy.service.ts` | Inconsistent rigor |

### Frontend architecture

```
main.tsx
  → QueryClientProvider
  → AuthProvider
  → I18nProvider (@booking/i18n)
  → RouterProvider (React Router 6)
  → AppShell (Sidebar + TopNav)
  → Feature pages (React Query, no Zustand)
```

**Note:** Documentation references Next.js; actual stack is **Vite + React Router**. A stale Next stub may exist under `app/` but is not the running application.

### Text architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Clinic Dashboard (Vite/React)                                 │
│  AuthProvider → React Query → apiRequest (+ x-tenant-id)        │
│  FeatureGate (subscription — UI only)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS /api
┌───────────────────────────▼─────────────────────────────────────┐
│  NestJS API                                                      │
│  JwtAuthGuard → MaintenanceModeGuard → RolesGuard → PermissionGuard│
│  Controller → Handler → Domain → Repository Interface            │
│       │                                                          │
│       ├── PrismaRepository → PostgreSQL (124 models)             │
│       ├── PrismaMetricRepository (analytics recorded metrics)    │
│       ├── InMemoryRateLimiter (auth — NOT Redis)                 │
│       └── Redis (cache, sessions, realtime buffer)               │
│  DomainEvent → Outbox → BullMQ workers → Notifications/Workflow  │
│  Socket.IO /realtime → clinic dashboard                          │
└─────────────────────────────────────────────────────────────────┘
```

### Violations

- Beauty: handlers use `InMemoryBeautyServiceRepository`; records use direct `PrismaService` in services (dual path)
- Auth rate limiting: `InMemoryRateLimiter` instead of Redis (`REDIS-ARCHITECTURE.md` Phase 2 plan)
- Reporting tenant extraction from user input: **fixed** — now uses `TenantContextService` (`request-report.handler.ts`)

---

## PART 4 — MULTI-TENANT EXPLANATION

### What represents a tenant

`Tenant` model in Prisma (`apps/api/prisma/schema.prisma`) — UUID, slug, status, lifecycle, timezone, locale, `features` JSON blob for settings/policy.

### Tenant lifecycle (actual code paths)

| Stage | Implementation | Evidence |
|-------|----------------|----------|
| Tenant creation | `ProvisionPlatformTenantHandler` (platform-admin) | `modules/platform-admin/` |
| Owner creation | Seed + identity registration | `prisma/seed.mjs`, `RegisterUserHandler` |
| Role seeding | Permission matrix + user roles JSON | `seed.mjs`, `User.roles` |
| Settings init | `Tenant.features` defaults; settings PATCH | `modules/settings/` |
| Subscription assignment | `PrismaSubscriptionRepository`, tenant subscription APIs | `modules/subscription/` |
| Module access | Frontend `FeatureGate`; partial backend enforcement | `subscription-config.ts`, `SubscriptionEnforcementService` |
| Branch creation | Settings branch CRUD + `Branch` model | `settings.controller.ts`, Prisma `Branch` |
| User invitation | Identity SMS/email invite handlers | `identity.controller.ts` |
| Tenant suspension | Platform admin suspend/resume handlers | `platform-admin.controller.ts` |
| Reactivation | `ResumePlatformTenantHandler` | platform-admin |
| Deletion/archival | Soft delete on Tenant; archive platform tenant | Prisma middleware, platform-admin |

### How tenant context flows

1. Login includes `tenantId` (email domain or explicit)
2. JWT claims include `tenantId`, `roles`, `sub`
3. Frontend stores tenant in localStorage; every API call adds `x-tenant-id`
4. `TenantContextService.resolve()` reads header (and JWT in guards)
5. Handlers pass `tenantId` to repositories
6. Prisma queries include `where: { tenantId }`

### Isolation mechanisms

| Layer | Status |
|-------|--------|
| Application WHERE tenantId | ✅ Primary mechanism |
| PostgreSQL RLS | ⚠️ `prisma/rls-policies.sql` (54 policies) exists — **`withTenantContext()` NOT implemented** |
| Cache scoping | ✅ Redis keys include tenant prefix (per REDIS-ARCHITECTURE.md) |
| Events | ✅ Events carry tenantId |
| Media/files | ✅ `MediaAsset.tenantId` |
| WebSocket rooms | ✅ Tenant-scoped in realtime module |
| Background jobs | ✅ Outbox rehydrates tenant context |

### Risks

- Header spoofing if guard/handler omits tenant check
- No DB-level enforcement if application bug skips `tenantId`
- Cross-tenant leakage in reporting was a documented critical issue — **appears fixed** in current `RequestReportHandler`

---

## PART 5 — AUTHENTICATION AND AUTHORIZATION

### Authentication flow

| Feature | Status | Files |
|---------|--------|-------|
| Login (email/password) | ✅ | `login.handler.ts`, `LoginPage.tsx` |
| Password hashing | ✅ bcrypt cost 12 | `password-hasher.ts`, seed |
| JWT access tokens | ✅ | `jwt-token.service.ts` |
| Refresh tokens | ✅ Prisma persisted | `PrismaRefreshTokenRepository` |
| Token rotation | ✅ on refresh | `refresh-token.handler.ts` |
| Logout / revoke session | ✅ | `logout.handler.ts`, `revoke-session.handler.ts` |
| Device trust | ✅ | `TrustedDeviceRepository` |
| MFA (TOTP) | ✅ | `setup-mfa`, `verify-mfa`, `MfaVerificationPage` |
| Password reset | ✅ + tenant password policy | `reset-password.handler.ts`, `TenantPolicyService` |
| Email verification | ✅ | `verify-email.handler.ts` |
| Account lockout | ✅ tenant-configurable | `login.handler.ts` + `TenantPolicyService` |
| Maintenance mode | ✅ blocks non-admin API | `MaintenanceModeGuard` |
| Rate limiting | ⚠️ In-memory IP/email limits | `InMemoryRateLimiter`, `LoginAttemptRepository` (Prisma) |

### Authorization

- **Roles:** 18 roles in permission matrix (owner, doctor, dentist, nurse, receptionist, accountant, etc.)
- **Permissions:** `@RequirePermission({ resource, action })` on controllers; `PermissionGuard` fails closed for unknown resources
- **Super admin bypass:** Implemented in `PermissionGuard`
- **Frontend route protection:** `ProtectedRoute` — authentication only, not per-route permission checks (permissions enforced at nav + page level ad hoc)

### Role examples (typical access)

| Role | Can access (evidence: permission matrix + nav filter) |
|------|------------------------------------------------------|
| Owner | All clinic modules, settings, subscription, user management |
| Manager | Dashboard, scheduling, patients, reports; limited settings |
| Doctor | Patients, EMR, queue, scheduling (own), dental read |
| Dentist | Dental module, patients, imaging, treatment plans |
| Nurse | EMR assist, queue, patients (limited write) |
| Receptionist | Scheduling, queue, patients, billing POS |
| Accountant | Billing, reports, commission |
| Inventory Manager | Inventory full module |
| Patient | Portal APIs only; UI = `MyAppointmentsPage` stub |
| Super Admin | Platform-admin API; subscription admin UI sections |

### Unauthorized action behavior

1. No/invalid JWT → 401 from `JwtAuthGuard`
2. Missing permission → 403 from `PermissionGuard`
3. Maintenance mode → 503 from `MaintenanceModeGuard` (non-admin)
4. Frontend: API error → toast/alert; many modules → **silent demo data fallback** (security/integrity risk)

---

## PART 6 — DATABASE AND DATA FLOW

### PostgreSQL / Prisma

- **124 models** in `apps/api/prisma/schema.prisma`
- **Shared-table multi-tenancy** — `tenantId` on tenant-scoped entities
- **Soft delete:** 10 models via Prisma middleware in `PrismaService` (Tenant, Branch, User, Patient, Appointment, Encounter, InventoryItem, Invoice, CommissionRule, LoyaltyReward)
- **Seeding:** Rich demo tenant in `prisma/seed.mjs` (multi-branch, multi-role, sample clinical/financial data)
- **Migrations:** `npm run db:push` (no versioned Prisma migrate history); supplemental SQL in `apps/api/db/migrations/`

### Major entity groups

| Domain | Key models |
|--------|------------|
| Platform | Tenant, Branch, User, Subscription, PlatformTenant |
| Patients | Patient, PatientAddress, PatientProblem |
| Scheduling | Appointment, WaitlistEntry, ScheduleSettings |
| EMR | Encounter, Diagnosis, Prescription, VitalSign |
| Dental | DentalRecord, DentalToothCondition, DentalClinicalNote |
| Beauty | BeautyRecord, BeautyAnnotation |
| Inventory | InventoryItem, PurchaseOrder, StockTransfer, StockCount |
| Billing | Invoice, InvoiceLine, Payment |
| Workflow | WorkflowDefinition, WorkflowInstance, WorkflowTask |
| Notifications | Notification, NotificationTemplate |
| AI | AiConversation, AiMessage, AiModel |
| Media | MediaAsset |

### In-memory repositories still in codebase

Used in **tests** and **legacy/demo paths** — production module bindings use Prisma except:

| Production binding | Repository | Risk |
|--------------------|------------|------|
| `auth.module.ts` | `InMemoryRateLimiter` | **MEDIUM** — not distributed |
| `beauty.module.ts` | `InMemoryBeautyServiceRepository` (deprecated service API) | **LOW** — records use Prisma services |

**Note:** `analytics.module.ts` binds `PrismaMetricRepository` at runtime. `InMemoryMetricRepository` exists for unit tests only.

### Data integrity gaps

- No Prisma migrate version history for team coordination
- RLS scripted but unwired
- Some nullable PHI fields without check constraints (verify per deployment)
- Concurrent appointment booking — race mitigation unclear without integration tests

---

## PART 7 — MODULE-BY-MODULE ASSESSMENT

Summary table (detailed subsections follow):

| Module | Backend | Frontend | Tests | Production-ready | Notes |
|--------|---------|----------|-------|------------------|-------|
| Dashboard | 75% | 70% | Medium | Partial | Demo fallback on API error |
| Patients | 80% | 75% | Medium | Partial | Demo list fallback |
| Scheduling | 82% | 78% | Medium | Partial | Demo appointments |
| Queue | 78% | 72% | Low | Partial | Demo board |
| EMR | 80% | 75% | Medium | Partial | Demo encounters |
| Dental | 85% | 80% | Low | Partial | Demo chart/metrics |
| Beauty | 75% | 70% | Low | Partial | Prisma records + demo UI fallback |
| Inventory | 88% | 85% | Good E2E | **Near production** | No demo fallback |
| Billing | 85% | 82% | Medium | Near production | Subscription gate on create |
| Reporting | 70% | 75% | Medium E2E | Partial | Async generation |
| Analytics | 62% | 65% | Medium | Domain APIs Prisma-backed | Registry catalog pending Phase 34a |
| Notifications | 85% | 88% | Good | Near production | Enterprise UI |
| Workflow | 82% | 80% | Medium E2E | Partial | FeatureGate UI |
| AI Assistant | 80% | 78% | Good unit | Partial | LLM keys external |
| Subscription | 80% | 95% | Medium | Partial | UI ahead of backend enforcement |
| Settings | 85% | 92% | Small | Near production | Policy runtime on auth |
| User Management | 85% | 88% | E2E | Near production | |

### 1. Dashboard

**Purpose:** Role-aware KPI home for clinic operations.  
**Frontend:** `DashboardPage.tsx`, widgets, realtime hook, demo via `createDemoOverview`.  
**Backend:** `modules/dashboard/` — overview aggregations from Prisma.  
**Completion:** Backend 75%, Frontend 70%, Production **partial** (demo fallback).

### 2. Patients

**Purpose:** Patient registration, search, demographics, history.  
**Routes:** `/patients`, `/patients/:id`  
**Backend:** `PrismaPatientRepository`, CRUD handlers, export.  
**Frontend:** Demo list on `listQuery.isError`.  
**Completion:** Backend 80%, Frontend 75%.

### 3. Scheduling

**Purpose:** Appointment booking, calendar, waitlist, branch hours.  
**Backend:** `PrismaAppointmentRepository`, waitlist, templates, settings.  
**Frontend:** `AppointmentsPage` — extensive UI; demo on error.  
**Completion:** Backend 82%, Frontend 78%.

### 4. Queue

**Purpose:** Waiting room queue, display board, check-in flow.  
**Backend:** `PrismaQueueRepository`, enqueue from appointments.  
**Frontend:** `QueuePage`, `QueueDisplayPage`; demo board fallback.  
**Completion:** Backend 78%, Frontend 72%.

### 5. EMR

**Purpose:** Encounters, vitals, diagnoses, prescriptions, materials.  
**Backend:** `PrismaEncounterRepository`, supplementary handlers.  
**Frontend:** `EncountersPage`, `EncounterDetailPage`; demo data hooks.  
**Completion:** Backend 80%, Frontend 75%.

### 6. Dental

**Purpose:** Odontogram, treatment plans, perio, imaging, materials.  
**Backend:** `PrismaDentalRepository`, extensive controller surface.  
**Frontend:** Chart, treatment plan, imaging; demo fallbacks.  
**Completion:** Backend 85%, Frontend 80%; tests **low**.

### 7. Beauty

**Purpose:** Consultations, face/body maps, sessions, before/after media.  
**Backend:** `BeautyRecordService` → Prisma; legacy in-memory service handlers.  
**Frontend:** Workspace, presentation, imaging pages; demo hooks.  
**Completion:** Backend 75%, Frontend 70%.

### 8. Inventory

**Purpose:** Items, suppliers, POs, warehouses, transfers, stock counts, requisitions.  
**Backend:** Full Prisma repository set (8 repos).  
**Frontend:** 14+ lazy routes; **no demo fallback**.  
**Completion:** Backend 88%, Frontend 85% — **strongest ops module**.

### 9. Billing

**Purpose:** Invoices, payments, cashbox, POS, commission link.  
**Backend:** `PrismaInvoiceRepository`, subscription enforcement on create.  
**Frontend:** Full billing workspace.  
**Completion:** Backend 85%, Frontend 82%.

### 10. Reporting

**Purpose:** Report catalog, generation, export center.  
**Backend:** `PrismaOperationalReportRepository`, async via events.  
**Frontend:** Builder, categories, export — E2E tests exist.  
**Completion:** Backend 70%, Frontend 75%.

### 11. Analytics

**Purpose:** Executive/clinical/financial analytics dashboards.  
**Backend:** Overview from Prisma; **metrics in-memory**; reports in Prisma.  
**Frontend:** 11 routes; many reuse same overview endpoint; demo fallback.  
**Completion:** Backend **55%**, Frontend 60% — **not production-ready**.

### 12. Notifications

**Purpose:** Inbox, templates, automation, delivery log, channels.  
**Backend:** `PrismaNotificationRepository`, enterprise handlers.  
**Frontend:** Full notification center UI.  
**Completion:** Backend 85%, Frontend 88%.  
**Architecture:** Phase **41** Notification Center SSOT — [`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md). Phases **41a–41e CLOSED** — **100% complete** (Playwright delivery **6/6** + runtime gate). Ops: [`NOTIFICATION_DELIVERY_OPERATIONS.md`](./NOTIFICATION_DELIVERY_OPERATIONS.md). Runtime authority = `EffectiveNotificationView`; `STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false`. Jest delivery **99/99**. Phase **42 NOT authorized**.

### 13. Workflow

**Purpose:** Workflow builder, instances, tasks, approvals.  
**Backend:** `PrismaWorkflowRepository`, automation executor.  
**Frontend:** Full workflow center; FeatureGate on home.  
**Completion:** Backend 82%, Frontend 80%.

### 14. AI Assistant

**Purpose:** Chat, prompts, workspace context, admin, usage limits.  
**Backend:** OpenAI/Gemini/template providers, streaming, audit.  
**Frontend:** Chat, settings, admin pages.  
**Completion:** Backend 80%, Frontend 78%.

### 15. Subscription

**Purpose:** Plans, features, usage, billing, license.  
**Backend:** Tenant subscription APIs, partial enforcement service.  
**Frontend:** ~95% complete UI.  
**Completion:** Backend 80%, Frontend 95%; enforcement gap.

### 16. Settings

**Purpose:** Tenant profile, branches, branding, security policies, API keys.  
**Backend:** `SettingsModule`, `TenantPolicyService`, maintenance guard.  
**Frontend:** Full settings center with i18n (AR partial).  
**Completion:** Backend 85%, Frontend 92%.

### 17. User Management

**Purpose:** Directory, invitations, roles, audit.  
**Backend:** Identity enterprise handlers, XLSX import.  
**Frontend:** Wizard, directory, role overview.  
**Completion:** Backend 85%, Frontend 88%.

---

## PART 8 — HOW MODULES WORK TOGETHER

| Cross-module workflow | Connection status |
|----------------------|-------------------|
| Patient registration → audit → notification | **Partial** — patient create emits events; notification listener coverage incomplete |
| Appointment booking → queue → notification | **Partial** — scheduling→queue handlers exist; SMS/WhatsApp not production |
| Check-in → queue ticket → doctor queue | **Mostly connected** — Prisma paths verified |
| Medical encounter → EMR → billing → inventory | **Partial** — material consumption handlers exist; auto-billing not universal |
| Dental treatment → inventory → invoice | **Partial** — dental material handlers + billing modules exist |
| Beauty treatment → media → invoice → inventory | **Partial** — session sync to appointments; consumption handlers exist |
| Inventory purchase → workflow approval | **Partial** — stock request handlers; workflow triggers not universal |
| Billing → payment → reporting → analytics | **Partial** — data in Postgres; domain KPIs live-assembled; recorded metrics via Prisma |
| Workflow → trigger → notification | **Partial** — automation executor exists |
| AI → page context → subscription limits | **Mostly connected** — AiSubscriptionService, frontend gates |
| Subscription → module access | **Weak** — UI gates; backend mostly open |

---

## PART 9 — FRONTEND EXPLANATION

### Stack

- **Vite 5**, React 18, React Router 6, TanStack Query 5
- **No Zustand** — Context (Auth, I18n) + React Query
- **i18n:** `@booking/i18n` — EN primary, AR partial (settings has AR gaps)
- **RTL:** Supported via i18n direction
- **Design tokens:** `@booking/design-tokens`
- **No Next.js middleware** — client-side guards only

### Routes using demo/mock/fallback data

| Feature | Mechanism | Files |
|---------|-----------|-------|
| Dashboard | `createDemoOverview` when offline/error | `dashboard-api.ts`, `DashboardPage.tsx` |
| Analytics | Same demo overview | `AnalyticsPage.tsx`, `AnalyticsHomePage.tsx` |
| Patients | `createDemoPatientList` on list error | `patients-api.ts`, `usePatients.ts` |
| Scheduling | `createDemoAppointments`, metrics, queue | `scheduling-api.ts`, `useScheduling.ts` |
| Queue | `createDemoQueueBoard` | `queue-api.ts`, `useQueue.ts` |
| EMR | `createDemoEncounters`, metrics, detail | `emr-api.ts`, `useEmr.ts` |
| Dental | `createDemoDentalChart`, metrics | `dental-api.ts`, `useDental.ts` |
| Beauty | `createDemoBeautyRecord`, metrics | `beauty-api.ts`, `useBeauty.ts` |
| Media/Imaging | `createDemoMediaList` | `media-api.ts`, `useMedia.ts` |

### Routes WITHOUT demo fallback (real API or empty)

Billing, inventory, notifications, settings, subscription, workflow, AI, user management.

### E2E coverage (38 Playwright specs)

Strong: auth, patients, encounters, inventory, dashboard, analytics, reporting, workflows, notifications, user-management.  
**Missing E2E:** settings, subscription, billing full flows, queue operations, beauty workflows (a11y only).

---

## PART 10 — ENTERPRISE PLATFORM READINESS (Roadmap Items 28–46)

| # | Item | Foundation | Implemented | Missing | Start Phase 3? |
|---|------|------------|-------------|---------|----------------|
| 28 | Enterprise Subscription & Licensing | Subscription module, plan VO | UI ~95%, backend partial enforcement | Unified plan taxonomy, quota enforcement all layers | After enforcement service |
| 29 | Dynamic Module Management | `@booking/module-registry`, dynamic sidebar + routing + dashboard + search + reporting | Registry + Effective Module View for nav, shell routes, dashboard widgets, search, and reporting; identity-scoped cache; static fallback | — | **Yes — 29b + 30 + 31 + 32 + 33 closed** |
| 30 | Dynamic Routing | Registry-filtered route catalog | Playwright E2E + rollback port | — | **Yes — closed (runtime verified)** |
| 31 | Dynamic Dashboard | `dynamic-dashboard` feature, `DynamicDashboardProvider` | Registry-filtered widget catalog; layout API unchanged; Playwright 34/34 | — | **Yes — closed (runtime verified)** |
| 32 | Dynamic Search | Global search + `DynamicSearchProvider` | **32 CLOSED** — registry-driven types; Playwright 31/31 | — | **Yes — 32a+32b+32c closed** |
| 33 | Dynamic Reporting | Report catalog (40 templates, 21 categories) | **33 CLOSED** — registry-driven catalog via `DynamicReportingProvider`; Playwright **41/41**; rollback port **5176** | — | **33 CLOSED** — see `docs/DYNAMIC_REPORTING_ARCHITECTURE.md` |
| 34 | Dynamic Analytics | UI reads `DynamicAnalyticsProvider`; Playwright **40/40**; rollback **5177** | `AnalyticsDomainService` + `/analytics/*` APIs | Registry catalog + provider + runtime closure **CLOSED** | **34c CLOSED — 100%** |
| 35 | White Label | Branding settings + design tokens | **35 CLOSED** — provider, resolver, CSS application, rollback; Playwright **41/41**; rollback port **5178** | Preview mode, asset pipeline runtime (Phase 36+) | **35c CLOSED — 100%** — see `docs/DYNAMIC_WHITE_LABEL_ARCHITECTURE.md` §38 |
| 36 | Multi-Branch Management | Branch model + settings CRUD + partial selectors | **36c CLOSED** — Playwright **43/43**; rollback **5179**; Phase **36 permanently closed** | — | Complete — see `docs/DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md` §33 |
| 37 | Department / Franchise Hardening | Hierarchy reserved in Multi-Branch §23 | **NOT started** | Department provider, RLS, franchise entity | Reserved |
| 38 | Activity Center | Audit + notifications (separate) | **PERMANENTLY CLOSED** — 38a+38b+38c; Playwright **35/35** | — | Complete |
| 39 | Enterprise Audit Center | Audit module + settings page + domain UIs | **PERMANENTLY CLOSED** — 39a+39b+39c; Playwright **36/36**; rollback **5181** | Conditional 39d execution layer only | Complete (config platform) |
| 40 | Patient Journey & Workflow Automation | Patients + scheduling + queue + EMR + workflow (partial) | **PERMANENTLY CLOSED** — 40a+40b+40c; Playwright **37/37**; rollback **5182** | Conditional 40d execution / advanced automation only | Complete (config platform) |
| 41 | Notification Center | Full UI + delivery engine | **100% COMPLETE** — 41a–41e; Playwright config **39/39** + delivery **6/6**; rollback **5183**; Jest delivery **99/99**; runtime gate PASS; ops [`NOTIFICATION_DELIVERY_OPERATIONS.md`](./NOTIFICATION_DELIVERY_OPERATIONS.md) | Phase **42** — **NOT authorized** | Complete |
| 42 | Import/Export Center | Export routes, user XLSX import | Reporting export, patient export | Unified import/export hub | Partial |
| 43 | Backup & Restore | Documented in DISASTER_RECOVERY.md | **Not implemented** | Automated backup jobs | No |
| 44 | API Keys & Integrations | Settings developer API keys | CRUD + webhook test | Key hashing, scope enforcement, OAuth | Partial |
| 45 | System Monitoring | Observability docs | Structured logging partial | APM, health dashboards | No |
| 46 | Patient Portal | Backend `patient-portal` module | `MyAppointmentsPage` only | Separate app, auth model | No |
| 47 | Super Admin | `platform-admin` API | Subscription admin UI slice | Dedicated app | No |

---

## PART 11 — SECURITY AUDIT

| Finding | Severity | OWASP | Evidence |
|---------|----------|-------|----------|
| RLS not wired; app-only tenant isolation | **High** | A01 Broken Access Control | `prisma.service.ts` comment; no `withTenantContext` |
| Demo data fallback masks API/auth failures | **High** | A04 Insecure Design | `createDemo*` pattern in clinical modules |
| Header-based tenant (`x-tenant-id`) | **Medium** | A01 | `api-client.ts`; must match JWT always |
| In-memory rate limiter (not distributed) | **Medium** | A07 Identification failures | `auth.module.ts` |
| No CSRF tokens (Bearer-only API) | **Low** | A01 | SPA pattern — acceptable if pure API |
| CORS configurable via env | **Low** | A05 | `main.ts` |
| JWT in localStorage | **Medium** | A07 | `auth-storage.ts` — XSS exposure |
| Password policy tenant-aware | ✅ Fixed | | `TenantPolicyService`, login handler |
| MFA implemented | ✅ | | TOTP handlers + UI |
| Permission matrix validation script | ✅ | | `validate-permission-matrix.mjs` |
| Audit not on all PHI mutations | **Medium** | A09 | Partial audit coverage |
| Analytics recorded metrics durability | **Low** (remediated) | A09 | Production uses `PrismaMetricRepository`; domain KPIs assembled live from Prisma |
| Secrets in .env (standard) | **Low** | A02 | No secrets in repo (verify deployment) |
| File upload via media module | **Medium** | A04 | Needs virus scan / type enforcement audit |
| AI PHI in prompts | **Medium** | Privacy | Ai inference audit service exists — verify retention |

---

## PART 12 — TESTING AND QUALITY

| Layer | Count | Coverage quality |
|-------|-------|------------------|
| Backend unit/integration | **183** `*.spec.ts` files | Strong: AI (17 suites), auth, identity, notifications, workflow, inventory partial |
| Frontend unit | **~30** vitest in src | Config/lib tests; fewer page tests |
| E2E Playwright | **38** specs | Auth, patients, EMR, inventory, dashboard, reporting, workflows |
| Tenant isolation tests | Sparse | **Gap** |
| Permission matrix E2E | Partial | dashboard-roles.spec.ts |
| Performance/load | Notification load test script only | **Gap** |
| Security tests | auth-security.spec.ts | **Gap** for OWASP suite |
| Accessibility | Multiple `*-a11y.spec.ts` | Good start |

**Modules appearing complete without E2E proof:** Settings, subscription, billing POS, queue operations, beauty clinical flows, platform-admin.

---

## PART 13 — ROADMAP VALIDATION (Items 1–52)

> **Note:** Items 1–51 are synthesized from the audit scope, `docs/FEATURE_INVENTORY.md` phases, and the enterprise list in the audit brief. No single numbered 1–51 roadmap file exists in the repository.

| # | Item | Status | % | Evidence |
|---|------|--------|---|----------|
| 1 | Monorepo foundation | Partial | 60% | npm workspaces; Turborepo/domain packages documented not built |
| 2 | Authentication | Partial | 85% | Full auth module; in-memory rate limit |
| 3 | Authorization / RBAC | Partial | 80% | Matrix + guards; not all routes decorated |
| 4 | Multi-tenancy | Partial | 70% | App-level isolation; RLS unwired |
| 5 | Database / Prisma | Partial | 72% | 124 models; db push not migrate |
| 6 | Dashboard | Partial | 72% | Real API + demo fallback |
| 7 | Patients | Partial | 78% | Prisma + demo fallback |
| 8 | Scheduling | Partial | 80% | Full scheduling module |
| 9 | Queue | Partial | 75% | Prisma queue |
| 10 | EMR | Partial | 78% | Encounters Prisma |
| 11 | Dental | Partial | 82% | Extensive dental module |
| 12 | Beauty | Partial | 72% | Prisma records; legacy in-memory service |
| 13 | Inventory | Partial | 86% | Strongest module |
| 14 | Billing | Partial | 84% | Invoices Prisma |
| 15 | Reporting | Partial | 72% | Async reports |
| 16 | Analytics | Partial | 62% | Domain APIs Prisma-backed; `PrismaMetricRepository` production; Phase 34 catalog migration pending |
| 17 | Notifications | Partial | 86% | Enterprise UI |
| 18 | Workflow | Partial | 81% | Prisma workflow |
| 19 | AI Assistant | Partial | 79% | LLM integration |
| 20 | Subscription | Partial | 82% | UI ahead of enforcement |
| 21 | Settings | Partial | 88% | Recent full settings center |
| 22 | User Management | Partial | 86% | Identity enterprise |
| 23 | Media / Imaging | Partial | 75% | Upload + DICOM parser frontend |
| 24 | Realtime / WebSockets | Partial | 70% | Socket.IO module |
| 25 | Background jobs / Outbox | Partial | 75% | BullMQ; email/SMS stubbed |
| 26 | Global Search | Partial | 78% | Prisma global search |
| 27 | Redis / Cache | Partial | 68% | Used; not all adapters on Redis |
| 28 | Enterprise Subscription | Partial | 65% | See Part 10 |
| 29 | Dynamic Module Management | **Complete** | **100%** (29a+29b+30+31) | Registry + dynamic sidebar + routing + dashboard; Playwright 71/71 nav+routing+dashboard |
| 30 | Dynamic Routing | **Complete** | **100%** | Playwright 26/26 + Vitest 12/12 + rollback verified |
| 31 | Dynamic Dashboard | **Complete** | **100%** | Canonical 20 widget IDs; Vitest 21/21 + module-registry 36/36 + Playwright 34/34 |
| 32 | Dynamic Search | **32c Playwright** | **100%** | `docs/DYNAMIC_SEARCH_ARCHITECTURE.md` §26; 31+32+80+48+5 tests green |
| 33 | Dynamic Reporting | **33 CLOSED** | **100%** | `DynamicReportingProvider` + snapshot/cache + UI config wiring + rollback + Playwright **41/41** runtime acceptance |
| 34 | Dynamic Analytics | **34c CLOSED** | **100%** | Playwright 40/40; rollback 5177; provider + registry pipeline production-verified |
| 35 | White Label | **35c CLOSED** | **100%** (architecture SSOT + 35a foundation + 35b provider + 35c runtime) | `docs/DYNAMIC_WHITE_LABEL_ARCHITECTURE.md` §38 |
| 36 | Multi-Branch | **36c CLOSED** | **100%** | `docs/DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md` §33 |
| 37 | Department / Franchise | Not Started | 0% | Reserved — Multi-Branch §23 |
| 38 | Activity Center | **38c CLOSED** | **100%** | `docs/DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md`; Playwright **35/35** |
| 39 | Enterprise Audit Center | **39c CLOSED** | **100%** | `docs/DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md`; Playwright **36/36**; vitest dashboard audit **28/28** + registry **97/97**; 39d NOT STARTED |
| 40 | Patient Journey & Workflow Automation | **40c CLOSED** | **100%** | `docs/PATIENT_JOURNEY_AND_WORKFLOW_ARCHITECTURE.md`; Playwright **37/37**; vitest registry **109/109** + dashboard journey **34/34**; 40d NOT STARTED |
| 41 | Notification Center | **41e CLOSED** · **100% COMPLETE** | **100%** | `docs/NOTIFICATION_CENTER_ARCHITECTURE.md` + `docs/NOTIFICATION_DELIVERY_OPERATIONS.md`; Playwright config **39/39** + delivery **6/6**; vitest registry **122/122** + dashboard notification **45/45**; Jest delivery **99/99**; Prisma migrate applied; runtime gate PASS; Phase 42 NOT authorized |
| 42 | Import/Export Center | Partial | 50% | |
| 43 | Backup & Restore | Not Started | 5% | Docs only |
| 44 | API Keys & Integrations | Partial | 45% | |
| 45 | System Monitoring | Not Started | 20% | |
| 46 | Patient Portal | Partial | 25% | Backend only |
| 47 | Super Admin | Partial | 35% | API only |
| 48 | Commission | Partial | 80% | Prisma |
| 49 | Loyalty | Partial | 75% | Prisma |
| 50 | Platform Admin API | Partial | 70% | Handlers complete |
| 51 | Internationalization | Partial | 65% | EN strong, AR partial |
| 52 | Testing / QA infrastructure | Partial | 42% | See Part 12 |

---

## PART 14 — USER JOURNEYS (Summary)

Detailed journeys align with `docs/USER_JOURNEYS.md` and `docs/PERSONAS.md`. Verified against actual routes:

| Role | Login | Landing | Key daily tasks | Permissions source |
|------|-------|---------|-----------------|-------------------|
| Clinic Owner | `/login` | `/` dashboard | KPIs, settings, subscription, users | Full nav |
| General Manager | Same | Dashboard | Scheduling, reports, workflows | Nav minus owner-only |
| Branch Manager | Same | Dashboard (branch scoped) | Branch ops, queue | `dashboard-branch-scope.ts` |
| Doctor | Same | Dashboard / encounters | Encounters, queue, patients | EMR write |
| Dentist | Same | `/dental` | Chart, treatment plan, imaging | Dental permissions |
| Beauty Specialist | Same | `/beauty` | Workspace, sessions, media | Beauty permissions |
| Nurse | Same | Encounters / queue | Assist documentation | Limited write |
| Receptionist | Same | Scheduling / queue | Check-in, appointments, POS | Scheduling + queue |
| Accountant | Same | `/billing` | Invoices, reports, commission | Finance roles |
| Inventory Manager | Same | `/inventory` | Stock, POs, transfers | Inventory manager role |
| Patient | Portal APIs | `/portal/appointments` stub | View appointments only | Minimal |
| Super Admin | Same | Subscription admin sections | Platform tenant API (no UI app) | `super_admin` role |

**Common errors:** 401 → redirect login; API failure in clinical modules → **silent demo data** (critical UX integrity issue).

---

## PART 15 — NON-TECHNICAL PRODUCT EXPLANATION

See companion document: [`docs/SYSTEM_USER_GUIDE_OVERVIEW.md`](./SYSTEM_USER_GUIDE_OVERVIEW.md)

---

## PART 16 — TECHNICAL ONBOARDING GUIDE

### Run the project (from repository scripts)

```bash
# Install dependencies (from repo root)
npm install

# Start API (port 3000 default)
npm run dev:api

# Start clinic dashboard (Vite — typically port 5173)
npm run dev:dashboard

# Database
cd apps/api
npm run db:push
npm run db:seed

# Tests
npm run test --workspace=booking-system-api
npm run test:dashboard
npm run test:e2e:dashboard
```

**Demo credentials:** `owner@demo.clinic` / `Owner123!` (see `apps/api/prisma/seed.mjs`)

### Important folders

| Path | Purpose |
|------|---------|
| `apps/api/src/modules/` | All backend domains |
| `apps/api/prisma/schema.prisma` | Database schema |
| `apps/api/config/permission-matrix.json` | RBAC source of truth |
| `apps/clinic-dashboard/src/features/` | Frontend feature modules |
| `apps/clinic-dashboard/src/app/router/` | All routes |
| `packages/permissions/` | Shared nav + permissions |

### How to add…

| Task | Steps |
|------|-------|
| Module | Create `apps/api/src/modules/<name>/`, register in `app.module.ts` |
| API endpoint | Controller method + handler + DTO + `@RequirePermission` |
| Repository | Interface in domain, `PrismaXRepository`, bind in module |
| Prisma model | Edit `schema.prisma`, run `npm run db:push` |
| Migration | Add SQL to `apps/api/db/migrations/` (manual process today) |
| Permission | Add to `permission-matrix.json` + sync `packages/permissions/` + run `validate:permission-matrix` |
| Frontend page | Feature folder + route in `router/index.tsx` |
| API call | `apiRequest` via React Query hook with token + tenantId |
| Translation | `@booking/i18n` messages or feature `*-messages.ts` |
| Tests | `*.spec.ts` beside handler or vitest/playwright |
| Audit | Publish audit event or call audit handler from sensitive handler |
| Tenant isolation | Always resolve tenant from `TenantContextService`; never from request body |

---

## PART 17 — FINAL SCORECARD

| Category | Score | Reasoning |
|----------|-------|-----------|
| Overall completion | **58%** | Broad surface area; production gaps in enforcement, demo fallbacks, enterprise layer |
| Architecture | **68%** | Consistent handler/repo pattern; docs ahead of code; missing domain packages |
| Backend | **70%** | Most modules Prisma-backed; analytics/auth gaps |
| Frontend | **63%** | Rich UI; clinical demo fallbacks undermine trust |
| Database | **72%** | 124 models; weak migrate/RLS |
| UI | **78%** | Polished enterprise UI in settings, notifications, inventory |
| UX | **65%** | Demo fallback confuses real vs fake data |
| Accessibility | **55%** | a11y E2E tests exist; not comprehensive |
| Security | **50%** | Auth strong; tenant + demo data risks |
| Testing | **42%** | Good in pockets; no systematic coverage |
| AI | **79%** | Well-tested module |
| Multi-tenancy | **68%** | Works at app layer; RLS missing |
| Enterprise readiness | **30%** | Items 28–46 mostly partial |
| Production readiness | **35%** | Not deployable for regulated clinical production without fixes |

---

## PART 18 — TOP 30 CRITICAL GAPS

| # | Gap | Severity | Modules | Business impact | Fix | Timing |
|---|-----|----------|---------|-----------------|-----|--------|
| 1 | Demo data fallback in clinical UI | Critical | Dashboard, patients, EMR, dental, beauty, scheduling, queue | Staff may treat fake data as real | Remove fallbacks; show errors | Immediate |
| 2 | RLS not wired | Critical | All | Cross-tenant DB leak if app bug | Implement `withTenantContext` | Immediate |
| 3 | Backend subscription enforcement | Critical | All modules | Revenue leakage, plan bypass | Central `FeatureGateService` | Phase 3 prep |
| 4 | Analytics registry catalog not migrated | Medium | Analytics | Module discoverability static-only | Phase 34a canonical vocabulary + STATIC_ANALYTICS_CATALOG | Phase 34a |
| 5 | No super-admin app | High | Platform | Cannot operate SaaS | Build `apps/super-admin` | Phase 3 |
| 6 | Patient portal minimal | High | Patient | No self-service | Build portal app | Phase 3 |
| 7 | Prisma migrate not used | High | Database | Schema drift in teams | Adopt migrate | Soon |
| 8 | SMS/WhatsApp not production | High | Notifications | No patient reminders | Integrate provider | Phase 2 completion |
| 9 | Lab/pharmacy/insurance integrations | High | EMR | Incomplete clinical loop | HL7/FHIR gateway | Phase 3 |
| 10 | Plan taxonomy fragmentation | High | Subscription | Wrong entitlements | Canonical enum + mapper | Soon |
| 11 | Quota enforcement (users/branches) | High | Identity, settings | Over-limit tenants | Handler checks | Soon |
| 12 | Distributed rate limiting | Medium | Auth | Brute force across instances | Redis rate limiter | Soon |
| 13 | JWT in localStorage | Medium | Auth | XSS token theft | httpOnly cookie option | Medium |
| 14 | Audit coverage gaps | Medium | Clinical | Compliance failure | Audit all PHI writes | Medium |
| 15 | Beauty in-memory service repo | Medium | Beauty | Confusion/legacy API | Remove deprecated path | Medium |
| 16 | Backup/restore not implemented | High | Platform | Data loss risk | Automated backups | Before production |
| 17 | Dynamic navigation/routing E2E | Low | Enterprise | **Closed** — nav 11/11 + routing 26/26 Playwright | — | Done |
| 18 | Activity center unified | Low | UX | Fragmented alerts | Unified feed | Later |
| 19 | E2E gaps settings/subscription/billing | Medium | QA | Regressions | Add Playwright specs | Soon |
| 20 | Tenant isolation tests | High | QA | Undetected leaks | Matrix-driven tests | Soon |
| 21 | Concurrent booking races | Medium | Scheduling | Double booking | DB constraints + locks | Soon |
| 22 | Email/SMS background stub | Medium | Background | Notifications not delivered | Provider integration | Phase 2 |
| 23 | CSRF/XSS hardening audit | Medium | Security | Web vulnerabilities | Security review | Medium |
| 24 | Arabic i18n incomplete | Medium | Settings, others | AR clinics blocked | Complete AR messages | Medium |
| 25 | Session timeout vs JWT TTL | Low | Settings/auth | Policy mismatch | Align TTL to tenant policy | Low |
| 26 | API key hashing/scopes | Medium | Settings | Key leakage risk | Hash keys, scope enforcement | Medium |
| 27 | System monitoring/APM | High | Ops | Blind production | OpenTelemetry + dashboards | Before production |
| 28 | Import/export hub | Medium | Data | Manual workflows | Unified center | Phase 3 |
| 29 | White-label email/PDF | Medium | Branding | Incomplete brand experience | Template pipeline | Phase 3 |
| 30 | DICOM production pipeline | Medium | Imaging | Clinical imaging gap | PACS integration | Phase 3 |

---

## PART 19 — RECOMMENDED NEXT ORDER

1. **Remove demo fallbacks** — data integrity before new features  
2. **Wire RLS + tenant isolation tests** — security foundation  
3. **Central subscription enforcement service** — backend gates on all handlers  
4. **Phase 34a analytics catalog foundation + Redis rate limiter** — registry parity + distributed auth limits  
5. **Adopt Prisma migrate + backup jobs** — operational maturity  
6. **SMS/email provider integration** — complete Phase 2 patient comms  
7. **Quota enforcement** (users, branches, AI) — commercial controls  
8. **E2E for billing, settings, subscription** — regression safety  
9. **Super-admin app (minimal)** — tenant lifecycle operations  
10. **Patient portal app (booking + records)** — Phase 2 completion  
11. **Dynamic nav/routing (plan-aware)** — Phase 3 enterprise UX  
12. **Lab/pharmacy integrations** — clinical completeness  

**Phase 3 should NOT start as a broad initiative until items 1–8 are complete.**

---

## Evidence Index (Key Files)

| Area | Path |
|------|------|
| App bootstrap | `apps/api/src/app.module.ts`, `apps/api/src/main.ts` |
| Frontend router | `apps/clinic-dashboard/src/app/router/index.tsx` |
| Auth | `apps/api/src/modules/auth/`, `apps/clinic-dashboard/src/app/providers/AuthProvider.tsx` |
| Permissions | `apps/api/config/permission-matrix.json`, `packages/permissions/` |
| Schema | `apps/api/prisma/schema.prisma` |
| Seed | `apps/api/prisma/seed.mjs` |
| Demo fallbacks | `apps/clinic-dashboard/src/features/*/api/*-api.ts`, `use*.ts` |
| Production repo bindings | `apps/api/src/modules/*/**.module.ts` |
| Feature gates | `apps/clinic-dashboard/src/features/subscription/components/FeatureGate.tsx` |
| Roadmap reference | `docs/FEATURE_INVENTORY.md` |
| Dynamic reporting architecture | `docs/DYNAMIC_REPORTING_ARCHITECTURE.md` |
| Dynamic analytics architecture | `docs/DYNAMIC_ANALYTICS_ARCHITECTURE.md` |
| Dynamic white label architecture | `docs/DYNAMIC_WHITE_LABEL_ARCHITECTURE.md` |
| Dynamic search architecture | `docs/DYNAMIC_SEARCH_ARCHITECTURE.md` |
| Dynamic multi-branch architecture | `docs/DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md` |
| Dynamic activity center architecture | `docs/DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md` |
| Dynamic audit center architecture | `docs/DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md` |
| Patient journey & workflow architecture | `docs/PATIENT_JOURNEY_AND_WORKFLOW_ARCHITECTURE.md` |

---

*This audit is based on repository state as of 2026-07-17. Phase 34–36 permanently closed. Dynamic Platform (Phases 30–36) complete. Phase 38 Activity Center permanently closed (38a+38b+38c; Playwright 35/35). Phase 39 Enterprise Audit Center permanently closed (39a+39b+39c; Playwright 36/36; rollback 5181). Phase 39d NOT STARTED. Phase 40 Patient Journey permanently closed (40a+40b+40c; Playwright 37/37; rollback 5182). Phase 40d NOT STARTED. Phase 41 Notification Center 100% complete (41a–41e; Playwright config 39/39; delivery 6/6; rollback 5183; Jest delivery 99/99; runtime gate PASS; Prisma migrate applied). Phase 42 NOT authorized. Phase 37 reserved for Department / franchise hardening.*
