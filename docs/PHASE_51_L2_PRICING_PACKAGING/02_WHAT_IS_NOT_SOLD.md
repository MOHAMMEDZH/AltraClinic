# L2 — What is NOT sold / not complete (honest PARTIAL)

**Purpose:** Prevent overselling. Status = **PARTIAL** where precursors exist but commercial completeness is not claimed.

---

## Not complete / not “sold as live”

| Item | Reality | Pointer |
|------|---------|---------|
| **Payment collection / Stripe** | Architecturally noted as **future** (webhook sync / proration payment integration) — **not** claimed live | [`LICENSING_ARCHITECTURE.md`](../LICENSING_ARCHITECTURE.md) (plan change / proration notes) |
| **External billing provider as full SoR** | Catalog discovery treated external billing as **partial** (schema-level) — not a complete payment product | [`SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md`](../SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md) |
| **In-repo payment rails / checkout** | No Phase 51 claim of end-to-end payment live | L1 inventory: PARTIAL |
| **Deploy topology / CD as commercial SKU** | D-17 topology remains **EXTERNAL** — not an in-product sale item | [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md); Phase 49 K5 |
| **Paging / APM / SIEM / offsite DR** | EXTERNAL ops services — not sold as in-product modules via this clarity pack | Phase 49 K3/K4/K7 OUT docs; [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md) |

---

## Still deferred (not packaging work)

| Item | Status |
|------|--------|
| AppointmentForm clinical-catalog picker (Phase 50 D5) | **DEFERRED** — not a pricing SKU; do not reopen as L2 |
| Beauty/encounters contrast; DashboardWidgets patient name | **DEFERRED** — UX/a11y; not sale packaging |

---

## Honest sale statement

```text
What we can explain today: Plan + entitlements + add-ons/overrides + subscription assignment
  → licensing enforcement in product.

What we must NOT claim: Stripe/payment collection live, 100% commercial payment complete,
  or Phase 51 Production Acceptance.
```
