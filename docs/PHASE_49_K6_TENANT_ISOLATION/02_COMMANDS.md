# K6 — Commands at accepting SHA

Working directory: `apps/api`  
Requires: test Postgres (`docker-compose.test.yml` / `booking_test` @ `:5433`), migrations applied as needed.

---

## 1. Primary (required for K6 packaging)

```bash
cd apps/api
# Prefer CI-equivalent prep when DB is fresh:
npm run db:test:migrate
npm run db:test:upgrade-validate   # optional but matches Platform DB CI

npm run test:platform-db-security
```

Env (defaults match CI / runner):

```text
NODE_ENV=test
RUN_PLATFORM_DB_SECURITY=true
ALLOW_TEST_DATABASE_RESET=true
INTEGRATION_DATABASE_URL=postgresql://booking:booking_test@localhost:5433/booking_test?schema=public
DATABASE_URL=<same>
```

---

## 2. Selected isolation proofs (reuse)

### Clinic RLS (postgres integration)

```bash
# Admin bypass role for fixture setup; app role = NOBYPASSRLS booking_app
set INTEGRATION_ADMIN_DATABASE_URL=postgresql://booking:booking_test@localhost:5433/booking_test
set INTEGRATION_DATABASE_URL=postgresql://booking_app:booking_app@localhost:5433/booking_test
set RUN_INTEGRATION=true

npx jest --config jest.integration.config.cjs --runInBand --forceExit \
  --testPathPattern "tenant-isolation\\.postgres\\.integration\\.spec"
```

### Thin cross-tenant API (same pattern as Phase 48 `p0-catalog` pg step — do not redesign packs)

```bash
set RUN_PLATFORM_DB_SECURITY=true
set ALLOW_TEST_DATABASE_RESET=true
set INTEGRATION_DATABASE_URL=postgresql://booking:booking_test@localhost:5433/booking_test?schema=public

npx jest --config jest.integration.config.cjs --runInBand --forceExit \
  --testPathPattern "clinical-catalog\\.cross-tenant\\.api\\.postgres"
```

Equivalent pack (heavier — unit + pg): `npm run test:phase48-p0-catalog`

---

## 3. Named packaging wrapper

```bash
cd apps/api
npm run test:phase49-tenant-isolation-check
```

Runs primary + selected proofs above via `scripts/run-phase49-tenant-isolation-check.mjs`.  
If test Postgres is unreachable: exits non-zero — **do not treat as PASS**.

---

## 4. Platform DB CI path-filter (force-run / local evidence)

Workflow: `.github/workflows/platform-db-security-ci.yml`

| Trigger | Behavior |
|---------|----------|
| `pull_request` with path match | Runs when changes touch `apps/api/src/modules/auth/**`, `apps/api/prisma/**`, platform-db scripts, `docker-compose.test.yml`, or the workflow file |
| `workflow_dispatch` | **Force-run** anytime (manual) |
| PR outside path filter | Job **skipped** — green PR ≠ Platform DB security green |

**Phase 49 expectation:** at hardening accept SHA, either:

1. Force-run via **Actions → Platform DB Security → Run workflow**, **or**
2. Capture **local** evidence under `apps/api/.ci-evidence/phase49-k6-<shortsha>/` (uncommitted) using the named wrapper / commands above.

Do **not** change required GitHub checks in K6.

---

## 5. Optional / heavy (pointers only)

| Command | Note |
|---------|------|
| `npm run test:phase48-onepass` | Full Wave I — optional; **not** required for K6 |
| `npm run test:step28-security-final-onepass` | Includes Platform DB among other gates — heavy |
| `npm run test:step28-closure-focused` | Includes `platform-auth.boundary` / RBAC unit proofs |

---

## 6. Incident

`docs/SECURITY_RUNBOOKS.md` §3 — Cross-tenant incident.
