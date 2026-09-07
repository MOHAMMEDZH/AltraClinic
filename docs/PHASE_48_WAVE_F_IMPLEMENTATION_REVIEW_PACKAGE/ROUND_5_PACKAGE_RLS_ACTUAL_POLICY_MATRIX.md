# ROUND_5_PACKAGE_RLS_ACTUAL_POLICY_MATRIX

| Test | Result | Notes |
|------|--------|-------|
| R5-PKG3-T1 | PASS | `pg_policies` contains `app.current_tenant_id` |
| R5-PKG3-T2 | PASS | does not rely on `app.tenant_id` |
| R5-PKG3-T3 | PASS | same-tenant app-role INSERT/SELECT |
| R5-PKG3-T4 | PASS | cross-tenant SELECT hidden |
| R5-PKG3-T5 | PASS | cross-tenant INSERT rejected |
| R5-PKG3-T6 | PASS | cross-tenant UPDATE rejected |
| R5-PKG3-T7 | PASS | cross-tenant DELETE rejected |
| R5-PKG3-T8 | PASS | ENABLE + FORCE + `booking_app.rolbypassrls=false` |

**Migration:** additive `20260820230000_phase48_wave_f_round5_remediation` replaces Round 4 wrong `app.tenant_id` policy.
**Bypass:** `app.platform_rls_bypass = true` (accepted project convention).
