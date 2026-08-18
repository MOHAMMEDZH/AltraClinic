# Patient Form Sign / Void Role Contract (Round 8)

## Frozen architecture authority

**Source of truth:** `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` §19:

> PatientFormInstance | patient | **clinical staff / portal patient** | YES sign/withdraw | signed immutable

Option **A — STRICT CLINICAL-STAFF CONTRACT** remains. No freeze text authorizes owner / GM / branch_manager / super_admin / custom roles as clinical staff for consent sign/void.

## Approved built-in roles

`api.clinical-forms` / `approve`:

- doctor
- dentist
- specialist
- nurse

## Denied roles (built-in and custom)

- receptionist
- assistant
- branch_manager
- general_manager
- owner
- super_admin (no silent bypass)
- accountant and other non-clinical roles
- **any custom-role grant of `approve` on `api.clinical-forms`**

## Super_admin exclusion

`SUPER_ADMIN_BYPASS_EXCLUSIONS` still excludes `api.clinical-forms` / `approve`. Unrelated super_admin bypass (e.g. GET templates `view`) remains.

## Custom-role exclusion

`CUSTOM_ROLE_GRANT_EXCLUSIONS` is the same pair. `PermissionGuard` does not consult custom grants for this protected action. `packages/permissions` `hasPermissionWithCustomGrants` returns false for that pair even when a custom grant lists `approve`.

## Runtime route permission

`POST /clinical-forms/instances/:id/sign` and `.../void` remain `@RequirePermission('api.clinical-forms', 'approve')`.

## Runtime role / custom-role matrix (`wave-c-clinical-forms-http`)

| Principal | Custom grant | sign | void | service called |
|-----------|--------------|------|------|----------------|
| doctor / nurse (no custom) | none | 2xx | 2xx | yes |
| receptionist / assistant / branch_manager / general_manager / owner / super_admin | `api.clinical-forms: [approve]` | 403 | 403 | no |
| accountant | `api.clinical-forms: [create]` | n/a | n/a | create 2xx (unrelated custom grant still works) |
| super_admin | none | 403 approve | 403 approve | GET templates 2xx (unrelated bypass) |
| unauthenticated | — | 401 | 401 | no |

Denied custom-grant sign/void: `signCalls=0`, `voidCalls=0` (no PatientFormInstance mutation).
