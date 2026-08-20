# Wave E Audit Validation (Round 2)

Audit adapter: `AuditTrailWaveEAuditLog` via `WAVE_E_AUDIT_LOG` port. Successful clinical mutations call `recordInTransaction` inside the same Prisma transaction as the write.

## Performer vs recorder (AR-14)

| Field | Meaning | Implementation |
|-------|---------|----------------|
| `providerId` | Clinical performer | Required explicit input on device create — **not** inferred from authenticated user |
| `recordedBy` | Authenticated recorder / accountability | Set to `actorId` |
| Audit details | Captures both | `device_treatment.create` details include `providerId` and `recordedBy` |

Evidence: `wave-e-aesthetic` — provider ≠ actor with recordedBy = actor.
HTTP correction: production-path R2-B6-C persists correction fields and records audit.

Dermatology open records `clinicianId` (clinical) and `recordedBy` (actor) without inventing a derm EMR.

## Audit actions (Wave E)

| Action | When |
|--------|------|
| `treatment_course.create` | Course + sessions created |
| `treatment_course.transition` | Course status change |
| `course_session.link_appointment` | Explicit appointment link |
| `course_session.transition` | Session status change |
| `device_treatment.create` | Device record created |
| `device_treatment.correct` | Parameter correction with reason |
| `dermatology.encounter.open` | Encounter opened for derm workflow |
| Dermatology photo attach | MediaAsset link audit (attach path) |
| `pre_post_care.assert` | PRE_CARE / POST_CARE instance kind verified |
| Pre/post instance create | createInstance audit in-transaction |

## Audit rollback

| Path | Evidence |
|------|----------|
| Course create + forced audit failure | rolls back course and sessions (`wave-e-aesthetic`) |
| PRE/POST create + forced audit failure | zero new instances (R2-B4-T10 `wave-e-round2`) |
| Device correct | correction + audit same transaction (aesthetic / production-path) |

No claim of full concurrent audit stress testing beyond these transactional proofs.
