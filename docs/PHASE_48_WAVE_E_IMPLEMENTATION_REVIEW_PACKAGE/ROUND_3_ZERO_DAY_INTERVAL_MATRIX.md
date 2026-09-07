# ROUND_3_ZERO_DAY_INTERVAL_MATRIX

Invariant: session linking / reschedule enforces **two** independent checks in `assertCourseSessionInterval`:

- **A — Timestamp chronology:** later sequence must be **strictly after** prior neighbor timestamp (`getTime()`); earlier than next neighbor when present. Equal timestamps reject.
- **B — Signed UTC calendar-day delta:** `signedCalendarDaysBetween` vs `intervalMinDays` / `intervalMaxDays` (no `Math.abs`).

Therefore `intervalMinDays=0` (and `max=0`) **allows same UTC calendar day** when timestamps still differ. Calendar-day alone does not replace chronology.

Production: `assertCourseSessionInterval` / `assertCourseIntervalsForReschedule` in `wave-e-reference.validation.ts`. Alias `daysBetweenAppointments` is signed (delegates to `signedCalendarDaysBetween`).

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R3-B2-T1 min=0 max=0 same UTC day later timestamp | success | `wave-e-round3` | PASS |
| R3-B2-T2 min=0 exact same timestamp | reject (`strictly after`) | same | PASS |
| R3-B2-T3 min=0 Session 2 earlier timestamp | reject (`strictly after`) | same | PASS |
| R3-B2-T4 min=1 same UTC day later time | reject (`intervalMinDays`) | same | PASS |
| R3-B2-T5 min=0 max=1 same-day later timestamp | success | same | PASS |
| R3-B2-T6 next-neighbor same-day chronology valid | success | same | PASS |
| R3-B2-T7 out-of-order current vs next | reject (next chronology) | same | PASS |
| R3-B2-T8 reschedule later same-day with min=0 | success | `assertCourseIntervalsForReschedule` | PASS |
| R3-B2-T9 / T10 reschedule equal/earlier | reject; original appointment start + session link unchanged | same | PASS |

HTTP: production-path `R3-B2` — same-day min=0 session link succeeds.

Unit: `wave-e-transitions` — signed calendar days remain chronological (positive/negative).
