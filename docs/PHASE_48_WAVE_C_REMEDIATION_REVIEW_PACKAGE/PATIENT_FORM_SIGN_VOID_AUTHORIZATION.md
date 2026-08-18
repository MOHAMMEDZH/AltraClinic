# Patient Form Sign / Void Authorization (Round 6 B2)

## Frozen architecture interpretation

Phase 48 target domain: **PatientFormInstance** lifecycle writes (sign, void) are for **clinical staff** (and portal patient self-sign where implemented). Receptionist may create/manage draft instances but must not sign or void signed consent records.

## Permission design (Option B)

Existing permission action set has `approve`. Sign and void are mapped to:

| Route | Permission | Action |
|-------|------------|--------|
| `POST /clinical-forms/instances/:id/sign` | `api.clinical-forms` | `approve` |
| `POST /clinical-forms/instances/:id/void` | `api.clinical-forms` | `approve` |

Generic `update` remains for other form operations; receptionist/assistant retain `create`/`update` for drafts.

## Role matrix (`api.clinical-forms.approve`)

| Role | Sign | Void |
|------|------|------|
| super_admin, owner, general_manager, branch_manager | ✓ | ✓ |
| doctor, dentist, specialist, nurse | ✓ | ✓ |
| assistant | ✗ (403) | ✗ (403) |
| receptionist | ✗ (403) | ✗ (403) |
| accountant | ✗ (403) | ✗ (403) |

## Runtime enforcement

- `@RequirePermission('api.clinical-forms', 'approve')` on sign/void in `clinical-forms.controller.ts`.
- `PermissionGuard` + matrix roles.

## HTTP test results

| Case | HTTP | Service called |
|------|------|----------------|
| receptionist sign | 403 | No |
| receptionist void | 403 | No |
| doctor sign | 2xx | Yes |
| nurse void | 2xx | Yes |
| assistant create draft | 2xx | Yes (create permission) |
| unauthenticated | 401 | No |

Test file: `wave-c-clinical-forms-http.postgres.integration.spec.ts`

## No-mutation-on-denial

HTTP tests use stub services counting `signCalls` / `voidCalls`; denied requests leave counters at 0.

## Matrices updated

- `apps/api/config/permission-matrix.json`
- `docs/permission-matrix.json`
- `packages/permissions/permission-matrix.json`

Validator: `validate-phase48-wave-c-permission-routes.mjs` — sign/void expect `approve`.

## Result

**PASS**
