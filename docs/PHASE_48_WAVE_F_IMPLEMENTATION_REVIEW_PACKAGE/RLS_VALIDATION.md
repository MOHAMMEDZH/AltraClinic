# RLS_VALIDATION (Round 6)

| Table / Control | Result |
|-----------------|--------|
| `commission_package_session_allocations` ENABLE+FORCE | PASS (unchanged from Round 5) |
| Policy uses `app.current_tenant_id` | PASS |
| Policy does not rely on `app.tenant_id` | PASS |
| `app.platform_rls_bypass` supported | PASS |
| `booking_app.rolbypassrls = false` | PASS |
| App-role same-tenant INSERT/SELECT | PASS |
| Cross-tenant SELECT/INSERT/UPDATE/DELETE | PASS (blocked) |

Round 6: no new tables; RLS not weakened. See `ROUND_5_PACKAGE_RLS_ACTUAL_POLICY_MATRIX.md`.
