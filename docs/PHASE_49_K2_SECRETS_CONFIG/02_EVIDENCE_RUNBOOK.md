# K2 — Evidence Runbook (reuse Step 28)

**Do not invent a second scanner.** All gates below are existing Step 28 scripts.

## Working directory

```bash
cd apps/api
```

## Recommended evidence set (K2)

| Order | Command | Purpose |
|------:|---------|---------|
| 1 | `npm run test:step28-secrets-scan` | Pattern scan (SEC) — redacted findings |
| 2 | `npm run test:step28-dep-audit` | Critical/High runtime audit |
| 3 | `npm run test:step28-dep-classify` | Classify audit findings |
| 4 | `npm run test:step28-security-unit` | Security unit (optional thin) |
| 5 | `npx jest --config jest.config.cjs --runInBand --testPathPattern jwt-secrets.config` | K2 JWT fail-closed unit |
| 6 | `npm run test:step28-security-final-onepass` | Full Step 28 orchestrator (heavy; needs DB for Platform DB segment) |

### Lightweight vs full

- **K2 minimum:** steps 1–3 + jwt-secrets unit (5).  
- **Full regression:** step 6 when Postgres test DB (`:5433`) is available — same as Release 47 / Wave I baselines.

## Evidence directory (uncommitted)

```text
apps/api/.ci-evidence/phase49-k2-<shortsha>/
  00_SUMMARY.md
  secrets-scan.txt
  dep-audit.txt
  dep-classify.txt
  jwt-secrets-unit.txt
  (optional) security-final-onepass.txt / step28-final-onepass.jsonl
```

Capture stdout/stderr with exit codes. Redact any accidental secret-shaped material before sharing.

## CI posture (explicit)

```text
Step 28 secrets-scan / dep-audit / onepass are NOT added as new required PR checks in K2.
```

| Option | K2 stance |
|--------|-----------|
| Required GitHub check | **OUT** for K2 (unless already required by branch protection — do not change protection here) |
| Documented local / optional CI | **IN** — this runbook |
| Existing workflows | Clinic Dashboard / Licensing / Platform DB / Super Admin unchanged |
| Manual pack matrix | `phase48-pack-matrix.yml` remains `workflow_dispatch`; may include `regression-baselines` which runs Step 28/29 — still not a new required check invented by K2 |

Pointers:

```text
apps/api/scripts/step28-secrets-scan.mjs
apps/api/scripts/step28-dep-audit.mjs
apps/api/scripts/step28-dep-classify.mjs
apps/api/scripts/run-step28-final-onepass.mjs
docs/SECURITY_RUNBOOKS.md
docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md
```
