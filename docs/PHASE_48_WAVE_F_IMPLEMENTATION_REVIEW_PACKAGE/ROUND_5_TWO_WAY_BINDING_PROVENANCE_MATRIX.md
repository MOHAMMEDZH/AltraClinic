# ROUND_5_TWO_WAY_BINDING_PROVENANCE_MATRIX

| Test | Result | Notes |
|------|--------|-------|
| R5-BIND-T1 | PASS | line.appointmentId set, SP.appointmentId null → reject |
| R5-BIND-T2 | PASS | line.snapshotRevisionId set, SP snapshot null → reject |
| R5-BIND-T3 | PASS | line.clinicalServiceId vs SP mismatch/unprovable → reject |
| R5-BIND-T4 | PASS | line.courseSessionId unprovable via SP appointment → reject |
| R5-BIND-T5 | PASS | same patient+branch+service, wrong appointment → reject |
| R5-BIND-T6 | PASS | all authoritative provenance matches → success |
| R5-BIND-T7 | PASS | rebind blocked |
| R5-BIND-T8 | PASS | zero side effects on rejection |

**Rule:** if line value ≠ null → performance value must be non-null and equal (two-way).
**courseSessionId:** proven via `course_sessions.appointmentId` ↔ `ServicePerformance.appointmentId`.
