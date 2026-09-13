# Phase 51 — Deferred / PARTIAL / MISSING / EXTERNAL register

**Rule:** Items below are **documented honesty**, not silent launch blockers.  
**Explicit:** these do **NOT** block Phase 51 PA if documented on the accepting tip.

| ID | Item | Status | Pointers |
|----|------|--------|----------|
| P50-D5 | AppointmentForm clinical-catalog picker | **DEFERRED** (CTO) | Phase 50 D1 candidate; `AppointmentForm.tsx` enum service types; Phase 50 KNOWN_LIMITATIONS |
| P50-D4-a | Beauty / beauty-workspace axe `color-contrast` | **DEFERRED** | `docs/PHASE_50_D4_A11Y/`; beauty / beauty-workspace a11y specs |
| P50-D4-b | Encounters detail axe `color-contrast` | **DEFERRED** | same D4 doc; `e2e/encounters-a11y.spec.ts` |
| P50-D4-c | Full `#scheduling-region` hub contrast | **DEFERRED** | Wave H / D4 scoped to H3 chrome |
| P50-D6 | DashboardWidgets patient primary name | **DEFERRED** | DTO `patientId` only; `docs/PHASE_50_D6_OWNER_NAMES/` |
| P51-pay | Stripe / payment collection / checkout live | **PARTIAL** | L2 `02_WHAT_IS_NOT_SOLD.md`; L5 boundary register; licensing “future Stripe” |
| P51-tos | Customer Terms of Service in `docs/` | **MISSING** | L5 register — counsel / external instrument |
| P51-privacy | Customer Privacy Policy in `docs/` | **MISSING** | L5 register — ops PHI rules ≠ privacy policy |
| P49-D17 | Deploy topology / k8s / CD (D-17) | **EXTERNAL** | Step 29; Phase 49 K5 `04_EXPLICIT_OUT.md` |
| P49-page | On-call / paging / SOC SaaS | **EXTERNAL** | Phase 49 K7; L4 handoff |
| P49-pitr | Offsite backup / PITR / multi-region DR | **EXTERNAL** | Phase 49 K3 `03_EXTERNAL_BOUNDARIES.md`; DR docs |
| P49-k5 | Real production cutover dry-run executed | **PARTIAL** | K5 `05_DRY_RUN_CHECKLIST.md` — checklist ≠ fake cutover |

---

## PA stance

```text
Documented DEFERRED / PARTIAL / MISSING / EXTERNAL ≠ Phase 51 PA rejection
Claiming payment live / fake cutover / zero deferred = NOT ALLOWED
D5 picker reopen = CTO authorize only
```
