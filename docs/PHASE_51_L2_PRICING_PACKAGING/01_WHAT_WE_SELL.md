# L2 — What we sell (SSOT pointers)

**Purpose:** Sale-facing map of **plans / modules / entitlements** using existing Super Admin and licensing documentation.  
**Does not invent** new product SoR, SKUs, or pricing tables.

---

## Commercial building blocks

| Layer | What it is | SoR / docs (authoritative) | Where operators see it |
|-------|------------|----------------------------|------------------------|
| **Plans + plan versions** | Canonical commercial plans (`plan.lite`, `plan.pro`, `plan.enterprise`) and version lifecycle | [`SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md`](../SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md) | Super Admin `/plans` |
| **Entitlements + limits** | What a published plan version grants (modules/features/limits readiness) | [`SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md`](../SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md) | Super Admin plan version entitlements UI |
| **Add-ons + commercial overrides** | Optional catalog add-ons and overrides on top of plans | [`SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md`](../SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md) | Super Admin `/add-ons` |
| **Subscription / commercial assignment** | Assigning plan/subscription to a platform tenant | [`SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md`](../SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md) | Super Admin `/subscriptions` |
| **Runtime licensing** | What the tenant can access after assignment (modules, features, limits, enforcement) | [`LICENSING_ARCHITECTURE.md`](../LICENSING_ARCHITECTURE.md), [`LICENSING_LIFECYCLE_STATE.md`](../LICENSING_LIFECYCLE_STATE.md) | Clinic dashboard subscription / license pages under `apps/clinic-dashboard/src/features/subscription/` |
| **Usage / limit enforcement** | Metering and numeric limit enforcement (not a sale SKU list) | [`USAGE_METERING_AND_LIMIT_ENFORCEMENT.md`](../USAGE_METERING_AND_LIMIT_ENFORCEMENT.md) | Enforced in product; see licensing docs |

---

## How to explain “the package” in one sentence

```text
We sell a Plan (versioned) with entitlements/limits, optionally plus Add-ons/overrides,
assigned as a Platform Subscription that the Licensing engine enforces for the tenant.
```

Details and edge cases (aliases, publication readiness, lifecycle) live in the linked SoR docs — **do not duplicate** them here.

---

## Evidence precursors (not Phase 51 PA)

| Surface | Path |
|---------|------|
| Licensing matrix E2E | `apps/clinic-dashboard/e2e/licensing-matrix.spec.ts` |
| Subscription licensing E2E | `apps/clinic-dashboard/e2e/subscription-licensing.spec.ts` |
| Phase 28 licensing CI | `.github/workflows/phase28-licensing-ci.yml` |

These prove packaging/licensing behavior exists; they do **not** prove payment rails or Phase 51 commercial launch complete.
