# L1 — Deferred items register (seed)

**Lineage:** `9a2e89d+` · **Source:** Phase 50 known limits + D1/D4/D6 packages  
**Phase 51 claim:** none — seed only; full register = [`PHASE_51_DEFERRED_REGISTER/`](../PHASE_51_DEFERRED_REGISTER/) (L7)  
**Rule:** do **not** silently implement deferred items as “launch work”

---

## Seed table

| ID | Item | Paths / pointers | Status |
|----|------|------------------|--------|
| P50-D5 | AppointmentForm clinical-catalog picker | `docs/PHASE_50_D1_DISCOVERY_INVENTORY/04_APPOINTMENTFORM_CATALOG_PICKER_CANDIDATE.md`; `AppointmentForm.tsx` still enum service types | **DEFERRED** (CTO) |
| P50-D4-a | Beauty / beauty-workspace axe `color-contrast` | `docs/PHASE_50_D4_A11Y/01_CONTRAST_FOLLOWUPS.md`; `e2e/beauty-a11y.spec.ts`, `beauty-workspace-a11y.spec.ts` | **DEFERRED** |
| P50-D4-b | Encounters detail axe `color-contrast` | same D4 doc; `e2e/encounters-a11y.spec.ts` | **DEFERRED** |
| P50-D4-c | Full `#scheduling-region` hub contrast | Wave H known limitation; D4 scoped to H3 chrome | **DEFERRED** |
| P50-D6 | DashboardWidgets patient primary name | `docs/PHASE_50_D6_OWNER_NAMES/00_README.md`; DTO has `patientId` only | **DEFERRED** |
| P50-master | Phase 50 KNOWN_LIMITATIONS rollup | `docs/PHASE_50_IMPLEMENTATION_REVIEW_PACKAGE/KNOWN_LIMITATIONS.md` | **PARTIAL** (not Phase 51 register) |
| P51-reg | Phase 51 deferred-items register package | `docs/PHASE_51_DEFERRED_REGISTER/` | **PASS-local** (L7) |

---

## Authority

```text
D5 picker = DEFERRED unless CTO reopens
Wave A–I / Phase 49 / Phase 50 SoR reopen = NOT AUTHORIZED as launch work
Phase 51 L1 does not deliver deferred items
```

## Gaps (for L7) — addressed

1. Consolidated register + review package → **`PHASE_51_DEFERRED_REGISTER/`** + **`PHASE_51_IMPLEMENTATION_REVIEW_PACKAGE/`**.  
2. Any reopen of D5 still requires explicit CTO authorize — not launch SoR.
