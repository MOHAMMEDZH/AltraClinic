# L2 — Operator / sales reading path

**Audience:** Operators and sales engineers explaining packaging without inventing SoR.  
**Entry:** [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md) → this package.

---

## Recommended order (thin)

1. **This package** — [`01_WHAT_WE_SELL.md`](./01_WHAT_WE_SELL.md) then [`02_WHAT_IS_NOT_SOLD.md`](./02_WHAT_IS_NOT_SOLD.md).  
2. **Plans** — open Super Admin `/plans` while reading [`SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md`](../SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md).  
3. **Entitlements / limits** — plan version entitlements UI + [`SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md`](../SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md).  
4. **Add-ons** — Super Admin `/add-ons` + [`SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md`](../SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md).  
5. **Assign to tenant** — Super Admin `/subscriptions` + [`SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md`](../SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md).  
6. **Tenant view** — Clinic dashboard subscription/license pages (`apps/clinic-dashboard/src/features/subscription/`) + [`LICENSING_ARCHITECTURE.md`](../LICENSING_ARCHITECTURE.md).  
7. **Stop before payment** — if asked about Stripe/checkout, cite [`02_WHAT_IS_NOT_SOLD.md`](./02_WHAT_IS_NOT_SOLD.md) (**PARTIAL** / future).

---

## Talking points (fail-closed)

| Question | Answer pattern |
|----------|----------------|
| What SKUs exist? | Canonical plans in Plans SoR — not ad-hoc UI tier names (`business` is unresolved non-plan UI tier per Plans doc). |
| What does a plan include? | Entitlements + limits on the **published** plan version — see entitlements SoR. |
| Can we add extras? | Add-ons / overrides SoR — not silent SoR edits. |
| How does the clinic see it? | Assigned subscription → licensing engine → clinic subscription UI. |
| Is payment live? | **No claim** — payment/Stripe remains PARTIAL/future. |

---

## Related inventories

- L1 pricing inventory: [`../PHASE_51_L1_DISCOVERY_INVENTORY/01_PRICING_PACKAGING_INVENTORY.md`](../PHASE_51_L1_DISCOVERY_INVENTORY/01_PRICING_PACKAGING_INVENTORY.md)  
- Deferred seed: [`../PHASE_51_L1_DISCOVERY_INVENTORY/06_DEFERRED_REGISTER_SEED.md`](../PHASE_51_L1_DISCOVERY_INVENTORY/06_DEFERRED_REGISTER_SEED.md)
