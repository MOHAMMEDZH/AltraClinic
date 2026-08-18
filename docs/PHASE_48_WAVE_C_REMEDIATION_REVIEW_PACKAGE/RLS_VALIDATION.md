# RLS_VALIDATION (Round 5)

Round 5 re-ran `wave-c-rls.postgres.integration.spec.ts` as part of `wave-c-` (exit 0). Bypass-OFF evidence below is unchanged.

## Setup

| Item | Value |
|------|--------|
| App DB role | `booking_app` (`NOSUPERUSER`, `NOBYPASSRLS`) |
| Bypass for assertions | `app.platform_rls_bypass = false` |
| Tenant context | `app.current_tenant_id = Tenant A` (or B) |
| Spec | `apps/api/src/modules/inventory/tests/wave-c-rls.postgres.integration.spec.ts` |

Fixture seeding uses admin bypass ON only. Assertions run as `booking_app` with bypass OFF.

## Platform templates (Tenant A)

| Case | Result |
|------|--------|
| SELECT platform template | allowed |
| INSERT platform template | denied |
| UPDATE platform template | denied |
| DELETE platform template | denied |

## Platform versions (parent template `tenantId` IS NULL)

Policy resolves ownership through `clinical_form_templates`.

| Case | Result |
|------|--------|
| SELECT published platform version | allowed |
| INSERT/create new platform version | denied |
| UPDATE existing platform version (content) | denied |
| UPDATE publication status (publish/supersede) | denied |
| DELETE platform version | denied |

## Tenant-owned control

| Case | Result |
|------|--------|
| Tenant A SELECT/INSERT tenant-owned version | allowed |
| Tenant B SELECT Tenant A tenant-owned version | empty / isolated |

## Other

| Case | Result |
|------|--------|
| Inventory usage cross-tenant SELECT | isolated |
| Append-only usage update/delete under tenant session | denied |

No new platform-admin bypass mechanism was invented for these tests.
