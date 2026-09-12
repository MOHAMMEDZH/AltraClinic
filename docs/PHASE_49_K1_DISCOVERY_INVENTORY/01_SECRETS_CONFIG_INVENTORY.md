# K1 — Secrets / Config Hygiene Inventory

**Lineage:** `9eac595+` · **Owner (default):** Platform Security (see `docs/SECURITY_RUNBOOKS.md`)  
**Phase 49 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths / evidence | Status |
|------|------------------|--------|
| Env templates (no secrets) | `apps/api/.env.example`, `apps/clinic-dashboard/.env.example`, `apps/super-admin/.env.example`, `apps/patient-portal/.env.example` | **PASS-local** |
| Step 28 secrets scan | `apps/api/scripts/step28-secrets-scan.mjs`; npm `test:step28-secrets-scan` | **PASS-local** |
| Step 28 dep audit / classify | `apps/api/scripts/step28-dep-audit.mjs`, `step28-dep-classify.mjs`; `test:step28-dep-audit`, `test:step28-dep-classify` | **PASS-local** |
| Step 28 security unit + onepass | `test:step28-security-unit`, `test:step28-security-final-onepass` → `scripts/run-step28-final-onepass.mjs`; unit `step28-security-hardening.unit.spec.ts` | **PASS-local** |
| Step 28 matrix / closure | `test:step28-matrix-evidence-export`, `test:step28-closure-focused` | **PASS-local** |
| Security runbook — credential exposure | `docs/SECURITY_RUNBOOKS.md` §1 | **PASS-local** |
| Security hardening review doc | `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md` | **PASS-local** |
| Playwright Redis absence / env exclusivity | `apps/clinic-dashboard/playwright.config.ts` (`PLAYWRIGHT_REDIS_URL` / `CI_REDIS_ABSENCE_ENFORCEMENT` / `:63999`) | **PASS-local** (CI isolation contract) |
| MFA / session security docs | `docs/SUPER_ADMIN_MFA_AND_SESSION_SECURITY.md` | **PARTIAL** (product security; not a Phase 49 secrets inventory) |
| CI secrets usage catalog | `.github/workflows/*.yml` (5 workflows) — no dedicated “secrets posture” job beyond app tests | **PARTIAL** |
| Unified Phase 49 secrets/config inventory SSOT | — | **MISSING** (this K1 starts it) |
| Continuous secret-leak gate in every PR required check | Not evidenced as branch-protection inventory in-repo | **PARTIAL** / external |
| `.gitignore` blocks `.env` / allows `.env.example` | repo root `.gitignore` | **PASS-local** |
| Pre-commit / gitleaks / husky secret hook | — | **MISSING** |
| `@nestjs/config` + Joi/Zod unified env validation | Roadmap in `docs/AUTH.md` / `docs/SECURITY.md`; not implemented — manual per-module (`platform-security.config.ts`, `redis-config.ts`, JWT builders) | **MISSING** / **PARTIAL** |
| Log / credential redaction | `structured-log-redaction.service.ts`; ops/audit/subscription redaction helpers; Step 28 LOG matrix | **PASS-local** |
| MFA encryption key fail-closed | `platform-security.config.ts` + Playwright MFA key contract | **PASS-local** |
| Step 28 secrets scan in **required** PR CI | Scan/onepass exist locally; **no** workflow job invokes `test:step28-secrets-scan` / dep-audit on every PR | **PARTIAL** |
| Secrets-scan roots | `step28-secrets-scan.mjs` limited roots (api/super-admin/docs) — not full monorepo | **PARTIAL** |

---

## npm / CI pointers (reuse)

```text
apps/api: test:step28-secrets-scan
apps/api: test:step28-dep-audit
apps/api: test:step28-dep-classify
apps/api: test:step28-security-final-onepass
apps/api: test:step29-release-final-onepass
```

Workflows (related hygiene, not secrets-only): `phase28-licensing-ci.yml`, `clinic-dashboard-ci.yml`, `super-admin-ci.yml`, `platform-db-security-ci.yml`.

Also: `docs/STEP_28_PENETRATION_TEST_CHECKLIST.md`, `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md`.

---

## Gaps (for K2)

1. No single Phase 49 **secrets/config surface checklist** tied to accepting SHA (env keys, CI secrets names without values, log-redaction expectations).
2. Step 28 scanners prove Release 47 bar — not packaged as Phase 49 evidence; **not wired into required PR CI**.
3. No unified ConfigModule validation (roadmap only) — fail-closed matrix still partial.
4. No pre-commit secret hook; scan roots incomplete vs monorepo.
5. Risk of local `.env` / evidence dirs (e.g. `.ci-evidence`) — process rule exists; Phase 49 needs explicit non-commit / redaction checklist.
