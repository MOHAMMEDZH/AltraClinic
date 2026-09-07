# Wave D HTTP Validation

| Route | malformed input class | status | service called |
|---|---|---|---|
| `POST /dental/treatment-plans/:planId/items/:itemId/appointments` | bad UUID body/path | 400 | NO |
| `POST /dental/lab-cases` | role-denied receptionist | 403 | NO create |
| `POST /service-performances` | bad UUID + invalid body | 400 | NO |

Notes:

- DTO + `ParseUUIDPipe` gates malformed input before handler/service.
- Catalog pricing unit mismatches remain `422` (`ClinicalCatalogValidationError`) by frozen Wave A contract.
- Round 1 B1 status gate (`appointment must be COMPLETED`) is a service/domain validation (BadRequest), not malformed-HTTP validation.

Evidence: `wave-d-http.postgres.integration.spec.ts`, `wave-d-dental.postgres.integration.spec.ts`.
