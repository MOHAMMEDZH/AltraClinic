# K4 — Evidence Runbook

## Named command

```bash
cd apps/api
npm run test:phase49-observability-readiness
```

Equivalent Jest (existing patterns only):

```bash
npx jest --config jest.config.cjs --runInBand --testPathPattern \
  "observability-foundation.spec|tracing-and-health.spec|dashboards-and-alerting.spec"
```

## Evidence directory (UNCOMMITTED)

```text
apps/api/.ci-evidence/phase49-k4-<shortsha>/
  00_SUMMARY.md
  observability-readiness.txt
```

### `00_SUMMARY.md` expectations

| Suite | Expected |
|-------|----------|
| `observability-foundation.spec` | PASS (also Step 29) |
| `tracing-and-health.spec` | PASS (also Step 29) |
| `dashboards-and-alerting.spec` | PASS (Phase 49 evidence; not R47 onepass) |
| Overall Phase 49 K4 in-repo readiness | **PASS** if all three green |
| Prod paging / APM | **PARTIAL / EXTERNAL** — not claimed PASS |

## Related (optional, not required for K4 minimum)

```text
metrics-and-telemetry.spec.ts
logging-and-correlation.spec.ts
production-acceptance.spec.ts   # Phase 45f
npm run test:step29-release-final-onepass   # heavy baseline; includes foundation+tracing only
```
