# Wave I Test Results

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-i-enterprise-qa` |
| Evidence dir | `apps/api/.ci-evidence/wave-i5-onepass-<shortsha>/` (uncommitted; rename to I5 tip) |

Local proofs below; I5 tip SHA is the commit that carries this package.

| Suite | Result | Notes |
|-------|--------|-------|
| `test:phase48-onepass` (API) | **PASS** | 22 packs via I1 runner; exit 0 |
| clinic-dashboard e2e ×3 | **PASS** | arabic-rtl 2p; a11y-tablet 3p; owner-ux 2p; 0 skipped |
| Combined Traceability | PASS @ I4 `5922b20` | R4-TRACE 2 passed |
| Migration clean/upgrade | PASS @ I4 `5922b20` | G wired; H ABSENT |
| P0 packs | PASS @ I2 `070f1c3` | 8/8 |
| P1 API + e2e | PASS @ I3 `070f1c3` | evidence-only |

E2E also invokable via `test:phase48-onepass:with-e2e` (thin orchestrator; same I1 scripts).
