# K6 — Evidence runbook

## Named command

```bash
cd apps/api
npm run test:phase49-tenant-isolation-check
```

## Evidence directory (UNCOMMITTED)

```text
apps/api/.ci-evidence/phase49-k6-<shortsha>/
  00_SUMMARY.md
  platform-db-security.txt
  tenant-isolation-postgres.txt
  clinical-catalog-cross-tenant.txt
```

### `00_SUMMARY.md` expectations

| Check | Expected |
|-------|----------|
| `test:platform-db-security` | **PASS** (primary) |
| `tenant-isolation.postgres.integration` | **PASS** (clinic RLS) |
| `clinical-catalog.cross-tenant.api.postgres` | **PASS** (thin reuse) |
| Overall K6 packaging | **PASS** if all three green |
| DB unreachable | **FAIL / STOP** — never fake PASS |
| Prod leakage absence | **not claimed** by green tests alone |

## Honest reporting

- Skip/`0 passed` on `requiresDb` suites = **FAIL** (same spirit as Phase 48 pack matrix).
- Path-filtered CI skip ≠ local PASS evidence.
