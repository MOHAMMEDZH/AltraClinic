# L1 — Pricing / packaging inventory

**Lineage:** `9a2e89d+` · **Owners:** Super Admin / Licensing / Clinic subscription  
**Phase 51 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths | Status |
|------|-------|--------|
| Super Admin plans + entitlements UI | `apps/super-admin/src/pages/plans/` | **PASS-local** |
| Super Admin add-ons / composition | `apps/super-admin/src/pages/addons/` | **PASS-local** |
| Super Admin subscriptions / commercial assignment | `apps/super-admin/src/pages/subscriptions/SubscriptionsPages.tsx` | **PASS-local** |
| SA route registry (plans / add-ons / subscriptions) | `apps/super-admin/src/routing/route-registry.ts` | **PASS-local** |
| Platform subscriptions / add-ons API | `apps/api/src/modules/platform-subscriptions/`, `platform-addons/` | **PASS-local** |
| Licensing engine | `apps/api/src/modules/subscription/` | **PASS-local** |
| Clinic subscription / license pages | `apps/clinic-dashboard/src/features/subscription/` | **PASS-local** |
| Licensing matrix E2E | `apps/clinic-dashboard/e2e/licensing-matrix.spec.ts` | **PASS-local** |
| Subscription licensing E2E | `apps/clinic-dashboard/e2e/subscription-licensing.spec.ts` | **PASS-local** |
| Phase 28 licensing CI | `.github/workflows/phase28-licensing-ci.yml` | **PASS-local** |
| Plans / entitlements / add-ons / assignment docs | `docs/SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md`, `SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md`, `SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md`, `SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md` | **PASS-local** |
| Licensing architecture (Stripe sync noted as future) | `docs/LICENSING_ARCHITECTURE.md` | **PARTIAL** |
| Usage metering / limits (not sale packaging) | `docs/USAGE_METERING_AND_LIMIT_ENFORCEMENT.md` | **PARTIAL** |
| Phase 51 “pricing clarity for sale” package | `docs/PHASE_51_L2_PRICING_PACKAGING/` | **PASS-local** (L2 docs; payment still PARTIAL) |

---

## Gaps (for L2) — addressed by L2 package

1. Sale-facing packaging clarity package → **`PHASE_51_L2_PRICING_PACKAGING/`**.  
2. Payment-provider / Stripe path remains future/partial — see L2 `02_WHAT_IS_NOT_SOLD.md`.  
3. Prefer reuse of Super Admin SoR docs — L2 is pointers + OPERATOR_INDEX link only.

## Explicit OUT for L1

No billing engine changes. No brand redesign. No claiming sale-ready.
