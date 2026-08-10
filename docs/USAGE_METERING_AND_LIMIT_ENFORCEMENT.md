# Supplemental Capability U01 — Usage Metering and Limit Enforcement

## Roadmap classification (canonical)

| Identity | Status |
|----------|--------|
| **Canonical roadmap** | Flexible Super Admin Implementation Playbook v4 |
| **This capability** | **Supplemental Capability U01** — additive; **not** a numbered Flexible roadmap step |
| Flexible Steps 01–16 | Complete |
| Flexible Step 17 — Tenant Creation and Provisioning | **Not implemented** (next required roadmap step) |
| Flexible Step 18 — Effective Entitlement Runtime and Licensing View | **Complete** |
| Flexible Step 19 — Tenant Lifecycle Actions | **Not authorized** |

U01 does **not** close or replace Tenant Creation and Provisioning.  
U01 does **not** authorize Tenant Lifecycle Actions.  
U01 remains feature-flagged and non-authoritative for provisioning.

**Historical note:** An earlier internal prompt incorrectly labelled this work “Step 18.” That label is **non-authoritative**. The migration folder `20260730120000_phase47_step18_usage_metering` retains `step18` in its **filename only** for migration integrity (Decision B — applied to local disposable test DB). The capability is canonically **U01**.

**Effective Entitlement Runtime** (Flexible Step 18) is the Limit authority U01 calls via `getLimit`. Historical internal docs may still say “Step 17 runtime” for that module — prefer **canonical roadmap names** in new writing.

---

## Discovery status

**Completed before production behavior change.** Ownership, Sources of Record, meter catalog, enforcement, privacy, migration, and rollback are frozen below.

---

## Authority separation (frozen)

| Authority | Owner | Role |
|-----------|--------|------|
| **Entitlement Limit** | Flexible Step 18 Effective Entitlement Runtime | Caps: `CONFIGURED` / `UNLIMITED` / `UNCONFIGURED` from immutable activation snapshot (or NEVER_MANAGED legacy) |
| **Usage** | Supplemental Capability U01 | Consumption only — counters, observations, reconciliation, enforcement decisions |
| **Clinical / business records** | Existing tenant bounded contexts | Patients, appointments, media, users, branches, communication ledger |

Usage does **not** define entitlement. Entitlement does **not** invent usage.

U01 calls Effective Entitlement Runtime `getLimit` / provenance-aware decisions. U01 **never** recomposes Plan / Add-on / Override Limits.

---

## Discovered metric sources

### Authoritative / reusable

| Source | Path / artifact | Use for U01 |
|--------|-----------------|-------------|
| Live staff/user count | `TenantSubscriptionService.getUsage` → non-`PATIENT` users | Aggregate reader for `limit.max_users` |
| Active branches | `getUsage` / branch create enforce | Aggregate reader for `limit.max_branches` |
| Patients | `getUsage` patient count | Aggregate reader for `limit.max_patients` |
| Storage (media bytes) | `getUsage` media asset sizes → GB | Aggregate reader for `limit.max_storage_gb` |
| Comms monthly | `CommunicationDispatchLedger` by `usageMonth` | Authoritative + reader for email/SMS/WhatsApp/push meters |
| Limit ceilings | Effective Entitlement Runtime `getLimit(tenantId, limitKey)` | Enforcement input |
| Canonical Limit keys | Catalog `LIMIT_KEYS` / `limit.*` | Meter ↔ Limit mapping |
| Idempotency patterns | Commercial idempotency (Steps 15–16) | Observation / reconcile claim→complete |
| Injectable clock | Runtime clock pattern | Period boundaries |

### Rejected as usage Source of Record

| Candidate | Reason |
|-----------|--------|
| Clinic `UsageMeter.tsx` / FE totals | UI only; never authoritative |
| Integrations gateway in-process quotas | Separate SoR; not multi-instance durable SaaS Limit meter |
| AI `AiUsageDaily` / tokens | Separate domain; miswired today as `apiCallsToday` |
| Redis API rate limiter | Rate control ≠ durable daily API meter |
| Observability / OTel counters | Ops telemetry; not commercial usage SoR |
| Backup snapshot `sizeBytes` | Outside `max_storage_gb` (media-only) |
| Frontend-provided counters | Forbidden |

### Deferred meters (unsupported in U01)

Explicitly **unsupported** until a trustworthy durable source exists:

- `limit.max_api_requests_per_day`
- `limit.max_appointments_per_month`
- `limit.max_reports_per_month`
- `limit.max_doctors`
- AI / gateway / backup quotas

Unsupported meters return stable `meter_unsupported` / `SOURCE_UNAVAILABLE` and **do not** fabricate consumption.

---

## Selected bounded context

**Module:** `apps/api/src/modules/usage-metering/`

**Database plane:** Platform-owned additive tables. Counters store **non-PHI aggregates only**. Platform inspection reads U01 projections only (no clinical row scans).

---

## Usage Source of Record

1. Append-only observations (`PlatformUsageObservation`)
2. Deterministic tenant-period counters (`PlatformUsageCounter`)
3. Reconciliation checkpoints (`PlatformUsageReconciliationCheckpoint`)
4. Derived enforcement decisions (evaluation-time)

---

## Initial meter catalog (verified sources only)

Eight meters: `meter.max_users`, `meter.max_branches`, `meter.max_patients`, `meter.max_storage_gb`, `meter.max_email_per_month`, `meter.max_sms_per_month`, `meter.max_whatsapp_per_month`, `meter.max_push_per_month` — mapped 1:1 to canonical `limit.*` keys. HARD enforcement when flags on. See catalog source for full attributes.

---

## Feature-flag containment (defaults OFF)

| Flag | Default | Effect |
|------|---------|--------|
| `USAGE_METERING_ENABLED` | **false** | Master gate for U01 inspection/module activation paths |
| `USAGE_METERING_ENFORCEMENT_ENABLED` | **false** | Hard/warn Clinic bridge |
| `USAGE_METERING_INGESTION_ENABLED` | **false** | Accept observations |

When flags are off: preserve Effective Entitlement Runtime / legacy licensing behavior; create **no** observation, counter mutation, or reconciliation checkpoint from normal Clinic paths; perform **no** hard usage denial via U01.

U01 is **not** activated globally by migration or seed. Meter-definition seed rows are zero-usage catalog only.

---

## Provisioning independence

Flexible Step 17 (Tenant Creation and Provisioning) owns onboarding orchestration (see `docs/TENANT_CREATION_AND_PROVISIONING.md`). U01 MUST NOT:

- create tenants, schemas, or tenant databases
- initialize clinical records
- assign facility types, specialties, Plans, Add-ons, Overrides
- create/activate subscriptions or commercial configurations
- invite tenant administrators or perform lifecycle transitions
- own provisioning jobs or Step 19 APIs/UI

U01 operates only for tenants that already exist (including those created by Step 17). Absent authority → fail safely; do not fabricate readiness or auto-enable enforcement. Step 17 must not invent U01 observations or nonzero counters; flags remain default OFF.

Ownership freeze: `docs/TENANT_CREATION_AND_PROVISIONING.md`.

---

## Mandatory post–Flexible Step 17 integration matrix

Revalidate U01 as part of Step 17 acceptance (`test:tenant-creation-provisioning-db` and related suites). Cases below are **required evidence** for Step 17 — not a license to enable U01 by default.

| Case | Intent |
|------|--------|
| Tenant Draft before provisioning | No U01 orphan / no enforcement |
| Provisioning started / partial / failed / rollback / resumed | No invented usage; no orphan counters |
| Tenant created without subscription | Safe fail / no auto-enforce |
| Draft / Scheduled commercial config | No premature hard deny from fabricated counters |
| First commercial activation | Initial counter/reconcile policy explicit |
| Initial usage zero vs live aggregate nonzero at onboarding | No invented usage; reconcile policy |
| Provisioning / observation concurrency | Deterministic; no cross-tenant leak |
| Failed provisioning | No U01 orphan |
| Tenant admin invitation | No metering side effect |
| Activation boundary | Enforcement only under explicit policy |
| Cancelled provisioning | Disable/prevent enforcement |
| Cross-tenant isolation | Proven |
| No PHI during provisioning | Proven |

---

## Schema (implementation)

| Table | Purpose |
|-------|---------|
| `platform_usage_meter_definitions` | Catalog seed (8 meters, zero usage) |
| `platform_usage_observations` | Append-only observations |
| `platform_usage_counters` | Tenant-period counters |
| `platform_usage_reconciliation_checkpoints` | Drift / last reconcile |
| `platform_usage_idempotency` | Completed-only mutation idempotency |

**Historical migration filename:** `20260730120000_phase47_step18_usage_metering` (retained for integrity).

Schema version strings (`usage-observation/v1`, etc.) are technical identifiers — not roadmap step numbers.

---

## Permissions / APIs / UI

- `usage.view` / `usage.reconcile` (unchanged keys)
- `GET /platform/tenants/:tenantId/usage` (+ meter, explain, reconcile)
- Super Admin **Usage and Limits** panel (no “Step 18” user-facing label)

---

## Non-goals

Billing, invoicing, payments, overage charging, provisioning, Tenant Lifecycle Actions, Feature Flags as commercial grant, Step 19+.

---

## Test commands

```bash
cd apps/api
npm run test:usage-metering-clean-migration
npm run test:usage-metering-upgrade-migration
npm run test:usage-metering-limit-enforcement-db
npm run test:effective-entitlement-runtime-db
```

---

## Final validation evidence (U01 closure gate)

| Gate | Result |
|------|--------|
| Clinic subscription / module-registry / navigation / full tests | **Passed** (5/17, 2/5, 3/10, 143/627) |
| Clinic typecheck + build | **Passed** |
| Clinic API/auth/licensing + U01 flags | **Passed** (6 suites / 54 tests) |
| Super Admin full test / typecheck / build | **Passed** (28/226) |
| U01 runner | **Passed** (8/38) |
| EER runner | **Passed** (6/55) |
| U01 clean/upgrade migration validators | **Passed** (8 defs, 0 invented usage) |
| Migration orphan cleanup | unfinished `_prisma_migrations` row removed; **1 finished** apply remains |
| Repository-wide `git diff --check` | **Passed** |
| Non-historical “Usage = Flexible Step 18” | **0** (historical migration name retained intentionally) |
| Flexible Step 19 production/schema | **Absent** |

## Final decision status

**Supplemental Capability U01 final validation passed.**  
Usage Metering and Limit Enforcement is accepted as a roadmap-aligned additive Flexible Super Admin capability.  
Flexible Step 17 — Tenant Creation and Provisioning remains the next required roadmap step.  
Flexible Step 19 remains unauthorized.
