# Wave F Permission Route Matrix

Resource: `api.staff-commission`
Controller: `WorkforceCommercialsController` (`/workforce-commercials`)

| Method | Path | Action | Guard |
|--------|------|--------|-------|
| PATCH | /workforce-commercials/users/:userId/commission-eligibility | update | PermissionGuard |
| POST | /workforce-commercials/plans | create | PermissionGuard |
| POST | /workforce-commercials/plans/:id/publish | update | PermissionGuard |
| GET | /workforce-commercials/plans/:id | view | PermissionGuard |
| GET | /workforce-commercials/plans | view | PermissionGuard |
| POST | /workforce-commercials/accruals/post | create | PermissionGuard |
| POST | /workforce-commercials/accruals/post-collected | create | PermissionGuard |
| POST | /workforce-commercials/accruals/:id/reverse | manage | PermissionGuard |
| POST | /workforce-commercials/accruals/:id/correct | manage | PermissionGuard |
| POST | /workforce-commercials/accruals/:id/settle | approve | PermissionGuard |
| GET | /workforce-commercials/accruals/:id | view | PermissionGuard |
| GET | /workforce-commercials/owner-report | export | PermissionGuard |
| POST | /workforce-commercials/package-allocations | create | PermissionGuard |
| POST | /workforce-commercials/invoice-lines/bind-performance | update | PermissionGuard |

Matrices: apps/api + docs + packages/permissions.
Validator: `validate-phase48-wave-f-permission-routes.mjs` PASS (Round 6 — no new route actions).
