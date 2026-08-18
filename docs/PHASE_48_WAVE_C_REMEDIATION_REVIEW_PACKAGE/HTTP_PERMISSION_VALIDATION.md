# HTTP_PERMISSION_VALIDATION (Round 8)

Specs:

- `wave-c-http-permission.postgres.integration.spec.ts`
- `wave-c-clinical-forms-http.postgres.integration.spec.ts`
- `wave-c-tenant-references.postgres.integration.spec.ts`

## Inventory (Round 7 + Round 8 dispose)

| Case | Result |
|------|--------|
| Unauthenticated POST usage | 401 |
| assistant / doctor injectable RBAC | retained |
| Owner-report PHI separation | PASS |
| reverse/correct/injectable invalid UUID | 400; service/prisma not called |
| owner-report invalid query | 400; report not called |
| **dispose `batchId=not-a-uuid`** | **400; handler=0; posting.disposeBatch=0; never 500** |
| **dispose valid UUID** | **2xx; handler called** |

## Clinical forms HTTP (Round 7 role contract + Round 8 custom grants)

| Case | Result |
|------|--------|
| doctor/dentist/specialist/nurse sign+void | 2xx |
| built-in denied roles sign+void | 403; no mutation |
| **denied roles + custom approve** | **403 sign and void; no mutation** |
| doctor/nurse without custom grant | 2xx |
| accountant + custom create | 2xx (unrelated custom grant) |
| super_admin GET templates | 2xx (unrelated bypass) |
| unauthenticated sign+void | 401 |
