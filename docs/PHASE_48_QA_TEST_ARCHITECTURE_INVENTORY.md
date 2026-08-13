# Phase 48 — QA / Test Architecture Inventory

| Field | Value |
|-------|--------|
| **Phase** | 48 — Enterprise QA & Testing |
| **Stage** | Architecture Discovery only |
| **Baseline** | `ae6307dfda8207e06db842318323d391c8fc8f18` |
| **Full suite execution during discovery** | **NO** |
| **Step 29 final runner rerun** | **NO** |
| **Step 28 Case C rerun** | **NO** |

This inventory maps existing QA machinery so Architecture Review can design Enterprise QA closure without inventing a parallel test stack.

---

## 1. Frameworks & runners

| Layer | Framework | Primary paths | Commands | Notes |
|-------|-----------|---------------|----------|-------|
| API unit | Jest (`jest.config.cjs`) | `apps/api/src/**/*.spec.ts`, module `tests/` | `npm run test --workspace=booking-system-api` (`jest --runInBand`) | Deterministic serial default |
| API integration | Jest integration config | `apps/api` integration suites | `npm run test:integration --workspace=booking-system-api` | Requires test infra when used |
| Platform DB security | Node scripts + Postgres | `apps/api/scripts/run-platform-*.mjs` | Many `test:platform-*-db` scripts | Strong Release 47 investment |
| Migration clean/upgrade | Node validators | `validate-*-clean.mjs` / `upgrade.mjs` | Paired scripts per platform domain | Pattern to reuse for future catalog |
| Final onepass runners | Node orchestrators | `run-step19`…`run-step29-final-onepass.mjs` | `test:*-final-onepass` | Step 29 ~long; **do not rerun for discovery** |
| Clinic dashboard unit | App test script | `apps/clinic-dashboard` | `npm run test:dashboard` (root) | — |
| Clinic E2E | Dashboard e2e | `apps/clinic-dashboard` | `npm run test:e2e:dashboard` | Heavier; reception/clinical flows |
| Patient portal | App tests | `apps/patient-portal` | `npm run test:patient-portal` | — |
| Super Admin | App tests | `apps/super-admin` | `npm run test:super-admin` | Catalog/plans UI |
| Permission matrix | Node validate | `apps/api/scripts/validate-permission-matrix.mjs` | `validate:permission-matrix` | Authz SoT check |
| Secrets / dep audit | Step 28 scripts | `step28-secrets-scan.mjs`, `step28-dep-audit.mjs` | `test:step28-*` | Security gate |
| Notification load | Load script | `notification-load-test.mjs` | `test:load:notifications` | Rare performance evidence |
| Test DB compose | Docker compose | `docker-compose.test.yml` | `db:test:up` | Discovery did not start Docker |

Root workspace scripts: `package.json` (dashboard/api/portal/super-admin entrypoints).

---

## 2. CI workflows

| Workflow | Path | Scope |
|----------|------|-------|
| Clinic dashboard CI | `.github/workflows/clinic-dashboard-ci.yml` | Dashboard build/test |
| Platform DB security CI | `.github/workflows/platform-db-security-ci.yml` | Isolation/security DB |
| Phase 28 licensing CI | `.github/workflows/phase28-licensing-ci.yml` | Licensing/entitlements |
| Super Admin CI | `.github/workflows/super-admin-ci.yml` | Super Admin |

**Gap:** No dedicated “clinic scheduling concurrency / service-catalog integrity” workflow. Platform CI maturity > clinic booking commercial integrity CI.

---

## 3. Coverage by test type

| Type | Present? | Paths / examples | Strengths | Gaps | Runtime cost |
|------|----------|------------------|-----------|------|--------------|
| Unit | YES | API module `*.spec.ts`; dashboard unit; i18n `locale-default.test.ts` | Fast domain logic | Thin scheduling conflict surface (4 scheduling specs) | Low–med |
| Integration | YES | `test:integration` | Service wiring | Not a substitute for race tests | Med |
| DB | YES | Platform `run-*-db.mjs` | Tenant/RLS/catalog/plans strong | Clinic appointment price/catalog DB absent | High |
| API | YES | Controller/handler specs | Nest handlers | Portal booking + invoice-from-appt price assertions weak | Med |
| UI | YES | Dashboard tests | Staff UX | Aesthetic/dental deep UI uneven | Med |
| E2E | YES | `test:e2e:dashboard` | Critical clinic paths | Tablet/RTL booking depth unknown | High |
| Accessibility | PARTIAL | Sparse | — | Systematic a11y missing | — |
| Localization | PARTIAL | `apps/clinic-dashboard/src/i18n/*.test.ts` | Direction/locale defaults | Catalog bilingual search untested | Low |
| Concurrency | PARTIAL | Overlap unit tests in scheduling repo/handlers | Logic correctness | **No postgres parallel create suite for appointments** | — |
| Security | YES | Step 28 unit + scans + matrix | Release 47 bar | Continue Phase 49 for hardening ops | Med–high |
| Tenant isolation | YES | Platform DB security + RLS apply scripts | Strong SoR | Branch isolation clinic scenarios thinner | High |
| Performance/load | PARTIAL | Notification load only | Channel stress | Scheduling/booking load MISSING | Variable |
| Migration | YES | Clean/upgrade validators (platform) | Deterministic migration gates | Future clinical catalog must adopt same pattern | Med |
| Backup/restore | PARTIAL | Ops docs / limited automation | — | Automated restore suite thin | — |
| Notification | YES | Templates DB + Step 27 onepass + reminders | Template integrity | Recall journey not operationally tested | Med–high |
| Observability | PARTIAL | Ops console tests (Step 22) | Platform ops | Clinic booking SLIs thin | Med |
| Visual regression | MISSING | — | — | P3 | — |
| Contract/schema | PARTIAL | Prisma schema + permission matrix | — | Public API contract suite sparse | — |
| Smoke | PARTIAL | Final onepass entry checks | Release gates | Clinic commercial smoke incomplete | High (full runners) |
| Coverage reporting | PARTIAL | Jest capable; not enforced globally in discovery | — | No Phase 48 coverage gate yet | — |
| Retries / parallelism | PARTIAL | `--runInBand` preferred for determinism | Anti-flake stance | Parallelism limited by design | — |
| Fixtures/factories | PARTIAL | In-memory repos + Prisma test helpers | — | Shared clinic booking fixtures incomplete | — |
| Flaky handling | PARTIAL | Onepass/determinism culture | Documented in Step 29 | No central flake quarantine inventory | — |

---

## 4. Scheduling / clinic commercial test evidence (critical for Phase 48)

| Area | Spec evidence | Assessment |
|------|---------------|------------|
| Appointment entity | `scheduling/tests/appointment.entity.spec.ts` | Basic |
| Update + series conflict | `update-appointment.handler.spec.ts` | Partial conflict |
| Prisma overlap query | `prisma-appointment.repository.spec.ts` | Query shape tested; not race |
| Timezone util | `scheduling-timezone.util.spec.ts` | Present |
| Create handler concurrency under load | — | **MISSING** |
| Resource + provider simultaneous book | — | **MISSING** |
| Invoice from appointment price | Handler sets `unitPrice: 0` | **Failure mode unblocked by tests** |
| Service catalog integrity | Hardcoded list only | **MISSING** |
| ServicePrice history | Upsert service | **MISSING history tests** |
| Portal self-book conflict | Portal module tests (partial) | Needs Architecture Review scope |

---

## 5. Dental / beauty test posture

| Domain | Evidence | Gap |
|--------|----------|-----|
| Dental | Module tests under dental (if present) + schema richness | Catalog-linked procedure tests absent |
| Treatment plans | Domain statuses rich | Appointment linkage E2E weak |
| Beauty | Annotation/material models | Batch-on-treatment + consent tests absent |
| Media | Media module tests | Photo consent ACL scenarios weak |

---

## 6. Release 47 final runners (inventory only — do not execute)

| Step | Script | Role |
|------|--------|------|
| 19 | `run-step19-final-onepass.mjs` | Tenant lifecycle |
| 20 | `run-step20-final-onepass.mjs` | Feature flags/settings |
| 21 | `run-step21-final-onepass.mjs` | Audit center |
| 22 | `run-step22-final-onepass.mjs` | Operations console |
| 23–26 | sales onepass scripts | Sales plane |
| 27 | notifications templates | Comms |
| 28 | `run-step28-final-onepass.mjs` | Security hardening |
| 29 | `run-step29-final-onepass.mjs` | Release readiness |

Accepted freeze commit for Step 29 executable: `ea076b044b0fd601193e56cfbc0a74d45960c688`.

Phase 48 should **design** additional clinic onepass segments; not renumber as Step 30 / Phase 48.1 in the Master Roadmap.

---

## 7. Recommended Phase 48 validation strategy (discovery proposal)

1. **P0 integrity pack (new):** parallel appointment create races; resource conflicts; idempotent portal book; invoice-from-appointment snapshot assertions (once snapshot designed).
2. **Catalog contract pack:** stable keys, AR/EN names, tenant enablement, historical appointment identity.
3. **Pricing pack:** tenant A ≠ tenant B price; price change does not mutate historical snapshot; authz on upsert; audit events.
4. **Clinical safety pack:** consent version required gates; injectable batch required for selected procedures; photo ACL.
5. **Localization pack:** RTL booking E2E; Arabic search for catalog; currency/date formatting.
6. **Reuse** existing Jest + DB validator + onepass patterns; **do not** invent a second CI philosophy.
7. Keep platform Step 28/29 gates green as regression baselines when implementation starts (post Architecture Freeze).

---

## 8. QA maturity score (evidence-based)

```text
Enterprise QA maturity = 4 / 5
```

Justification: exceptional platform/security/licensing migration+onepass machinery; clinic dental/aesthetic/booking commercial integrity and concurrency still have material blind spots (hence not 5).

---

## 9. Out of scope for this discovery document

- Executing full suites
- Changing test behavior files
- Adding CI workflows
- Implementing P0 fixtures

Documentation-only. Awaiting Architecture Review.
