# Permission Contract Validation (Round 8)

## Validator

`apps/api/scripts/validate-phase48-wave-c-permission-routes.mjs` — `collectWaveCPermissionErrors()`

## Built-in role-set invariant

Exact `api.clinical-forms.permissions.approve`: `doctor`, `dentist`, `specialist`, `nurse`.

Forbidden keys remain in `CLINICAL_FORMS_SIGN_VOID_FORBIDDEN_ROLES`.

## Custom-role bypass regression

Validator also requires production source proof:

- `permission.guard.ts` contains `CUSTOM_ROLE_GRANT_EXCLUSIONS` and `customRoleGrantsApply`
- `packages/permissions/src/index.ts` `isProtectedPermission` + `hasPermissionWithCustomGrants` ignores custom grants for protected approve

Runtime: receptionist/assistant/admins/super_admin + custom `approve` → HTTP 403, no sign/void service call.

## Shared helper consistency

| Helper | clinical-forms approve | billing view super_admin | accountant + custom create |
|--------|------------------------|--------------------------|----------------------------|
| API `rolesGrantPermission` | built-in clinical only; super_admin false | super_admin true | n/a |
| API custom-grant fallback | skipped | n/a | allowed |
| `hasPermission` | doctor true; super_admin false | super_admin true | accountant false |
| `hasPermissionWithCustomGrants` | custom approve ignored | n/a | custom create true |

`packages/permissions` vitest: 6 passed.

## Normal custom-role / super_admin regression

- accountant + custom `create` → POST instances 2xx
- super_admin GET templates 2xx
- injectable conditional create unchanged

## Existing negative scenarios (still)

| Scenario | Result |
|----------|--------|
| Add receptionist to approve | fail |
| Add owner to approve | fail |
| Remove doctor from approve | fail |
| Sign action changed from approve | fail |
| VOID operation removed | fail |
| Injectable conditional create removed | fail |
| One matrix desynchronized | fail |

## Valid full-validator run

```
node scripts/validate-phase48-wave-c-permission-routes.mjs
→ PHASE48_WAVE_C_PERMISSION_ROUTES_VALIDATOR_PASSED (exit 0)
```
