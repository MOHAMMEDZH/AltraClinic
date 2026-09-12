# K2 — Secrets / Config Surface Checklist

Inventory packaged from K1 @ `e9acc52`. **Never paste real secret values into tickets, evidence, or this doc.**

---

## 1. Environment templates (no secrets committed)

| Surface | Path | Expectation |
|---------|------|-------------|
| API | `apps/api/.env.example` | Document required keys; JWT/MFA real values only in untracked `.env` |
| Clinic dashboard | `apps/clinic-dashboard/.env.example` | `VITE_*` only |
| Super Admin | `apps/super-admin/.env.example` | No secrets |
| Patient portal | `apps/patient-portal/.env.example` | Flags + API base |
| Git ignore | `.gitignore` | `.env` / `.env.*` ignored; `!.env.example` allowed |

### Critical API keys (names only)

```text
DATABASE_URL
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET  (min 32, distinct, non-placeholder — K2 fail-closed)
JWT_PLATFORM_ACCESS_SECRET / JWT_PLATFORM_REFRESH_SECRET  (required in production)
PLATFORM_MFA_ENCRYPTION_KEY  (required when NODE_ENV ≠ test; non-placeholder; ≠ JWT secrets)
REDIS_URL / PLAYWRIGHT_REDIS_URL / CI_REDIS_ABSENCE_ENFORCEMENT
```

---

## 2. CI secret patterns (no values)

| Workflow | Pattern |
|----------|---------|
| Clinic Dashboard CI | Inline **test** JWT strings for ephemeral CI (not secret-manager) |
| Phase 28 Licensing CI | Inline test JWT + Redis service URL |
| Platform DB Security | Test DB URLs only |
| Super Admin CI | No API secrets |

**K2 rule:** Do not commit production credentials. CI test material must remain non-production and rotatable.

---

## 3. Redaction / no-leak expectations

| Surface | Path / pointer |
|---------|----------------|
| Structured log redaction | `apps/api/src/modules/observability/application/logging/structured-log-redaction.service.ts` |
| Ops / audit / subscription redaction | platform-operations-console, platform-audit-center, platform-subscriptions helpers |
| Step 28 LOG matrix | `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md` |
| Security runbook §1 | `docs/SECURITY_RUNBOOKS.md` — credential exposure |
| Evidence dirs | `apps/api/.ci-evidence/**` — **do not commit**; redacted logs only |

**Expectation:** Evidence and logs may contain config **names** and exit codes; never raw keys, tokens, connection strings with passwords, or MFA material.

---

## 4. Fail-closed startup (reuse + K2 delta)

| Control | Status |
|---------|--------|
| MFA key validation + placeholder reject | Existing (`platform-security.config.ts`) |
| JWT length checks | Existing |
| JWT placeholder + equal access/refresh reject | **K2 minimal** (`jwt-secrets.config.ts`) |
| Platform JWT required in production | Existing |
| Unified `@nestjs/config` + Joi | **Not in K2** — see `03_CONFIGMODULE_GAP.md` |

---

## 5. Checklist (operator)

- [ ] Local `.env` present and untracked; copied from `.env.example` then **generated** secrets
- [ ] `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`; neither is a known placeholder
- [ ] `PLATFORM_MFA_ENCRYPTION_KEY` set when not `NODE_ENV=test`
- [ ] No secrets in git status / PR diffs
- [ ] Step 28 secrets-scan + dep-audit/classify evidence collected (see runbook)
- [ ] Evidence under `apps/api/.ci-evidence/` remains uncommitted
