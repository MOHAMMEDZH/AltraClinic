# Wave E Transaction / Concurrency Validation (Round 3)

## Atomic course + sessions create

`TreatmentCourseService.create` runs in a single `prisma.withPlatformBypass` transaction:

1. Validate tenant refs (patient, clinical service, optional package price version)
2. Insert `treatment_courses` row
3. Insert `plannedSessions` `course_sessions` rows (sequence 1..N, status PLANNED)
4. `audit.recordInTransaction`
5. Return course + sessions

Failure at audit (or any prior step) rolls back course and all sessions — proven in aesthetic suite.

## Appointment link — existing appointment SoR

`linkSessionAppointment`:

- Does **not** create or auto-book appointments
- Validates existing appointment (tenant + patient + optional clinical service)
- Enforces strict timestamp chronology + signed calendar-day intervals, including `intervalMinDays=0` same-day (R3-B2)
- Updates session `appointmentId` / status `BOOKED` in one transaction with audit

HTTP proof: production-path R2-B6-B (success + reject leaves no link); R3-B2 same-day min=0 link.

Concurrency for appointment booking itself remains Wave B appointment SoR — Wave E does not invent a parallel booking lock.

## Course-aware commercial resolve (R2-B1 + R3-B1)

Exact `packagePriceVersionId` bind happens in the booking commercial resolver **before** generic price lookup / appointment create side effects. Round 3 routes course units through **PA-04** `resolveCurrentKeyOutcome` (advisory lock → reconcile → interval-valid ACTIVE) once, then re-reads that the course-bound id is still current.

- Reject paths leave appointment/invoice/allocation counts unchanged (pricing production-path R2-B1-T1/T7; R3-B1-T2/T9).
- **R3-B1-T8:** concurrent `resolveCanonical` on the same commercial key yields deterministic identical `priceVersionId` / unitPrice (commercial key lock serialization via PA-04).

## PRE/POST instance create (R2-B4 + R3-B3)

Single transaction: resolve PUBLISHED version (tenant OR platform pack; tenant precedence) → insert PatientFormInstance → audit. Audit failure → no instance (R2-B4-T10). Platform-pack path must not mutate templates/versions (R3-B3-T3/T5/T9/T10/T11).

## No broad locking invented

Wave E services do **not** introduce new advisory-lock schemes for courses or device records. Device correction = single-row update + audit in one transaction.

Commercial-key serialization for course/package pricing reuses Wave A/D PA-04 locks inside `resolveCurrentKeyOutcome` (not a new Wave E lock family).

ServicePerformance concurrency remains Wave D / AR-21 (out of Wave E authorship).

## Summary

| Concern | Approach | Evidence |
|---------|----------|----------|
| Course+sessions atomicity | Single tx + audit-in-tx | aesthetic create + audit rollback |
| No silent auto-book | Explicit link API only | aesthetic; production-path R2-B6-B |
| Interval reject unchanged | assert before persist (timestamp + calendar day) | round2; round3 T9–T10; production-path |
| Exact package price + PA-04 | skip generic lookup; `resolveCurrentKeyOutcome` once | booking-commercial-resolver; R2-B1; R3-B1 |
| Commercial key concurrent resolve | PA-04 advisory lock serialization | R3-B1-T8 |
| PRE/POST no partial write / no pack mutation | audit-in-tx; count/status checks | R2-B4-T10; R3-B3-T3.. |
| Broad new locks | None added beyond PA-04 reuse | code review of aesthetic services |
