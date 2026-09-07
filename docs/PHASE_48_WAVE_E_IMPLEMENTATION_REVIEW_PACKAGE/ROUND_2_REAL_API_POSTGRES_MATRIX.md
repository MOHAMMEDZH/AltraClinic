# ROUND_2_REAL_API_POSTGRES_MATRIX

Suite: `wave-e-production-path.postgres.integration.spec.ts` — real Nest controller + real aesthetic services + PostgreSQL (fake audit / TestClinicAuthGuard / LicensedModuleGuard override only).

| Path | Proof | Mocked domain services? | Result |
|------|-------|-------------------------|--------|
| R2-B6-A TreatmentCourse create/get | `POST /aesthetic/treatment-courses` durable course+sessions; `GET :id` returns persisted | **NO** | PASS |
| R2-B6-B CourseSession link | HTTP link-appointment success + DB `appointmentId`; chronology reject → no link; min-interval reject | **NO** | PASS |
| R2-B6-C Device create | HTTP create persists `EXT-DEVICE-001`; >120 / whitespace / empty → 400 | **NO** | PASS |
| R2-B6-C Device correct | HTTP correction persists correction fields + audit call | **NO** | PASS |
| R2-B6-D Derm + photo | HTTP open derm + attach photo → MediaAsset; non-derm reject; cross-tenant media reject | **NO** | PASS |
| R2-B6-E PRE/POST | HTTP PRE_CARE + POST_CARE bind seeded PUBLISHED versions; template/version counts unchanged; other-tenant only → reject | **NO** | PASS |

Note: `wave-e-http` may still mock services for DTO/RBAC isolation (R2-B3). Acceptance proof for workflows is this production-path suite.
