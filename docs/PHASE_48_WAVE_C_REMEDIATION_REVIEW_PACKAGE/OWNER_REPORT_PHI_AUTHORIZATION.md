# OWNER_REPORT_PHI_AUTHORIZATION (Round 4 B2)

## Permissions (existing matrix — no new permission invented)

| Concept | Resource / action | Roles (matrix) |
|---------|-------------------|----------------|
| Base inventory owner-report route | `api.inventory` / `export` | super_admin, owner, general_manager, inventory_manager, accountant |
| PHI inclusion (`includePhi=true`) | `api.patients` / `view` | super_admin, owner, general_manager, branch_manager, doctor, dentist, specialist, nurse, assistant, receptionist |

`inventory_manager` and `accountant` have export and **do not** have `api.patients` / `view`.

## Controller behavior

`GET /inventory/usage/owner-report` no longer passes `hasOwnerReportPermission: true`.

It derives `hasPhiPermission` from:

1. `rolesGrantPermission(user.roles, 'api.patients', 'view')`
2. custom role grants on `api.patients` / `view`

If `includePhi` is true and PHI permission is missing → **403 Forbidden** before the service query.

Safe default: omitted/`false` → no `patientId` / `appointmentId` on rows.

## Runtime results

| Role | Request | HTTP | PHI fields |
|------|---------|------|------------|
| inventory_manager | GET owner-report (no includePhi) | 200 | absent |
| inventory_manager | GET `?includePhi=true` | 403 | n/a |
| accountant | GET `?includePhi=true` | 403 | n/a |
| owner | GET `?includePhi=true` | 200 | `patientId` / `appointmentId` present |
| receptionist | GET owner-report | 403 (no export) | n/a |

Service direct: `hasPhiPermission=false` + `includePhi=true` → Forbidden; `includePhi=false` → no PHI keys.

Specs: `wave-c-http-permission.postgres.integration.spec.ts`, `wave-c-tenant-references.postgres.integration.spec.ts`, C-INV owner-report PHI cases.
