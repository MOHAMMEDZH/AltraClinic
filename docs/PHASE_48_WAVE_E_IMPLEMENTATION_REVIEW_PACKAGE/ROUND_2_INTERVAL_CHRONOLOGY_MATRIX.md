# ROUND_2_INTERVAL_CHRONOLOGY_MATRIX

Invariant: chronology uses **signed** UTC calendar days (`signedCalendarDaysBetween`). Enforcement checks **previous and next** linked neighbors. No `Math.abs` in the enforcement path.

Production: `assertCourseSessionInterval` / `assertCourseIntervalsForReschedule` in `wave-e-reference.validation.ts`.

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R2-B2-T1 Session 2 before Session 1 | reject (`chronologically after`) | `wave-e-round2` | PASS |
| R2-B2-T2 exact min boundary | success | same | PASS |
| R2-B2-T3 below min | reject (`intervalMinDays`) | same | PASS |
| R2-B2-T4 exact max | success | same | PASS |
| R2-B2-T5 above max | reject (`intervalMaxDays`) | same | PASS |
| R2-B2-T6 next-neighbor min violation | reject when linking mid-session after later session exists | same | PASS |
| R2-B2-T7 valid vs both neighbors | success | same | PASS |
| R2-B2-T8 reschedule breaks prior neighbor | reject | `assertCourseIntervalsForReschedule` in T8/T9/T10 | PASS |
| R2-B2-T9 reschedule breaks next neighbor | reject | same | PASS |
| R2-B2-T10 originals unchanged on reject | appointment start + session `appointmentId` unchanged | same | PASS |

Unit: `wave-e-transitions` — `signedCalendarDaysBetween` positive/negative (no abs reverse).

Residual: deprecated alias `daysBetweenAppointments` still wraps `Math.abs` for distance metric only — **not** used by chronology enforcement (see `KNOWN_LIMITATIONS.md`).
