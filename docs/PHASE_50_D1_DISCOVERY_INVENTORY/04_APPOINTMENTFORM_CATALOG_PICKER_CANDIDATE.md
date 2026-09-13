# D1 — AppointmentForm clinical-catalog picker (D5 candidate)

**Lineage:** `1501190+` · **Status:** **CANDIDATE** — not started (CTO: **DEFERRED** for Phase 50 exit)  
**Phase 50 claim:** none  
**CTO decision:** **DEFERRED** for Phase 50 (remain candidate only; not required for exit)

---

## Current reality

| Item | Paths | Status |
|------|-------|--------|
| AppointmentForm UI | `apps/clinic-dashboard/src/features/scheduling/components/AppointmentForm.tsx` (+ `.module.css`) | **PASS-local** |
| Consumers | `AppointmentsPage.tsx`, `PatientBookAppointmentDialog.tsx` | **PASS-local** |
| Service selection today | `SERVICE_TYPE_OPTIONS` / `useServiceTypes` **enum** — not clinical-catalog identity | **PARTIAL** (product gap) |
| Clinical catalog search (settings) | `ClinicalServicesPage.tsx` + `useClinicalServices` | **PASS-local** (reuse candidate if D5 authorized) |
| AppointmentForm catalog picker component | — | **MISSING** |

---

## Deferral pointers (do not reopen silently)

```text
docs/PHASE_48_WAVE_H_IMPLEMENTATION_REVIEW_PACKAGE/KNOWN_LIMITATIONS.md
docs/PHASE_48_WAVE_H_IMPLEMENTATION_REVIEW_PACKAGE/WAVE_H_SCOPE.md
docs/PHASE_48_WAVE_H_IMPLEMENTATION_REVIEW_PACKAGE/CHANGE_SUMMARY.md
docs/PHASE_48_WAVE_I_IMPLEMENTATION_REVIEW_PACKAGE/KNOWN_LIMITATIONS.md
docs/PHASE_48_WAVE_I_IMPLEMENTATION_REVIEW_PACKAGE/WAVE_I_SCOPE.md
docs/PHASE_48_WAVE_I_IMPLEMENTATION_REVIEW_PACKAGE/WAVE_I_EXTERNAL_PRODUCTION_ACCEPTANCE_PRECHECK.md
docs/PHASE_50_KICKOFF_PACKAGE/PHASE_50_IMPLEMENTATION_SLICES.md (D5)
apps/api/.ci-evidence/wave-h2-rtl-booking-*/00_SUMMARY.md   # uncommitted evidence note
```

---

## Effort / risk (inventory note)

| Factor | Note |
|--------|------|
| SoR impact | Enum serviceType → catalog identity is a **product binding** change, not UI polish |
| Wave stance | Explicitly OUT in Wave H/I; Phase 50 allows deliver **or** defer with rationale |
| Reuse | Catalog search APIs already exist on settings page |
| Relative to D2–D4 | Higher effort/risk than docs clarity, thin UX labels, or a11y contrast follow-ups |

---

## D5 decision recommendation

```text
D5 AppointmentForm clinical-catalog picker = DEFERRED (CTO for Phase 50)
Remain candidate only — not required for Phase 50 exit
Authorize separately only if a later CTO prompt wants product binding IN
```
