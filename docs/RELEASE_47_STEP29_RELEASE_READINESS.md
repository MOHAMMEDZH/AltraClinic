# Release 47 — Flexible Step 29  
## Release Readiness and Operational Handover

| Field | Value |
|-------|--------|
| **Step** | Flexible Step 29 — Release Readiness and Operational Handover |
| **Status** | Implementation/validation complete; acceptance pending external review |
| **Authority** | Healthcare ERP SaaS — Flexible Super Admin Implementation Playbook v4 |
| **Steps 01–28 + U01** | Accepted / Complete |
| **Step 28 Case C** | Attempt 3 authoritative; executable freeze `6dafb4498819a4c0cd5d91dd3704eca3b9a0fb59` |
| **Step 28 checkpoint** | `2a332beafe8a1b6d767cb87b45c6b1eed647b673` |
| **Branch** | `cursor/step29-release-readiness-operational-handover` |
| **Final runner** | `apps/api/scripts/run-step29-final-onepass.mjs` |
| **Test DB** | `booking_test` @ `localhost:5433` |

---

## 1. Purpose

Validate the complete Release 47 MVP and prepare safe deployment, support, rollback, and ownership handover. No new product scope. No Step 30.

---

## 2. Repository discovery (verified)

| Surface | Ownership | Path / note |
|---------|-----------|-------------|
| Deployment topology | **external/deployment-owned** | No prod Docker/k8s in repo (D-17). Document topology before cutover. |
| Migrations | **repository-owned** | `apps/api/prisma/migrations/` (33); `db:migrate:deploy`; `db:rls:apply`; `db:triggers:apply` |
| Rollback | **hybrid** | Forward-fix preferred (`docs/PRODUCTION_MIGRATION_WORKFLOW.md`); restore via backup scripts |
| Monitoring signals | **repository-owned** | `GET /health/live`, `/health/ready`, `/health`, `/metrics` |
| Alerts / on-call | **external/deployment-owned** | No Sentry/Prometheus/on-call wiring in repo |
| Backups | **hybrid** | Scripts in `apps/api/scripts/backup-postgres.*`; offsite/PITR = external |
| Production IAM | **external/deployment-owned** | Platform RBAC in-repo; prod host/DB/secrets access review = cutover gate |
| Runbooks | **repository-owned** | This doc + `SECURITY_RUNBOOKS.md` + `OPERATIONS_CONSOLE_RUNBOOKS.md` |
| Release tests | **repository-owned** | Step 29 runner composes accepted suites |

---

## 3. Frozen Release 47 invariants (must preserve)

```text
Catalog: 68 / 136 / 68 / 13
Plans: plan.lite | plan.pro | plan.enterprise
Business: PRO overlay only; NO plan.business
Limits: CONFIGURED | UNLIMITED | UNCONFIGURED; missing != Unlimited
Commercial SoR: Step 16
EER: active immutable snapshot; managed pending/terminal = deny; LEGACY = NEVER_MANAGED only
U01: supplemental; flags default OFF
Platform principal != Clinic principal
Published Plan Versions immutable
```

---

## 4. Release acceptance scenario matrix

| # | Scenario | SoR / authority | Executable proof | Command (via Step 29 runner) | Manual/external | Rollback note |
|---|----------|-----------------|------------------|------------------------------|-----------------|---------------|
| 1 | Dental clinic, single specialty | Catalog + Plan Version entitlements | Healthcare catalog + plan entitlements DB suites | `test:platform-healthcare-catalog-db`, `test:platform-plan-entitlements-db` | None | Restore backup if migrate fail |
| 2 | Cosmetic clinic | Same | Same suites (specialty grants from published PV) | same | None | same |
| 3 | General clinic | Same | Same + limits | + `test:usage-metering-limit-enforcement-db` | None | same |
| 4 | Multi-specialty clinic | Plan Version specialty policy | Plan entitlements + EER | `test:platform-plan-entitlements-db`, `test:effective-entitlement-runtime-db` | None | same |
| 5 | Add-on purchase | Step 16 add-ons | Add-ons/overrides DB | `test:platform-add-ons-overrides-db` | None | Compensation: deactivate add-on |
| 6 | Temporary tenant override | Step 16 overrides | Add-ons/overrides DB (reason/tenant/expiry) | `test:platform-add-ons-overrides-db` | None | Expire/revoke override |
| 7 | Plan version change | Subscriptions + immutable PV | Subscriptions DB (existing subs unchanged) | `test:platform-subscriptions-db` | None | No silent PV mutation |
| 8 | Trial expiry | Trials + lifecycle | Trials + lifecycle DB | `test:sales-trials-db`, `test:tenant-lifecycle-db` | Trial expiry monitoring = ops | Restore from backup if needed |
| 9 | Limit exceeded | U01 / limits | Usage metering DB + unit flags | `test:usage-metering-limit-enforcement-db` | Claim only modes proven in repo | N/A |
| 10 | Feature flag disabled | Step 20 flags | Feature-flags DB (kill switch ≠ grant) | `test:feature-flags-settings-db` | None | Re-enable flag |
| 11 | Unauthorized API attempt | Step 28 security | Auth boundary + Step 28 closure | `test:step28-closure-focused` | None | N/A |
| 12 | Cross-tenant cache | EER cache | Cache unit (isolates tenants) | `effective-entitlement.cache.unit` via closure-focused | None | Invalidate caches |

Additional release validations (runner):

| Area | Proof |
|------|--------|
| Provisioning | `test:tenant-creation-provisioning-db` |
| Audit omission + tamper | audit-center core A18 + I05-I06 (integration) |
| Security/dep/secrets | `step28-secrets-scan`, `step28-dep-audit`, `step28-dep-classify` |
| Notifications safety | Prefer accepted Step 27 Case C; runner includes notification DB if enabled in compose |
| Prisma/API/SA/Clinic builds | `prisma validate`, `tsc`, super-admin `typecheck`/`build`, clinic `build` |
| Backup tooling present | Static check of backup/restore/verify scripts |
| Health endpoints | Observability health unit tests |

---

## 5. Catalog and commercial governance guide

### Catalog
- Stable canonical keys only; invariant **68 / 136 / 68 / 13**.
- Do not destructively remove referenced catalog items.
- Change procedure: draft catalog PR → review → migrate/seed via accepted tooling → re-run catalog DB suite.
- Compatibility: facility type, specialty, module, feature remain separate concepts.

### Plans
- `plan.lite`, `plan.pro`, `plan.enterprise` only.
- Business capability = **PRO overlay**; never invent `plan.business`.

### Plan Versions
- Draft → publish; published versions are **immutable**.
- Historical subscriptions remain reproducible from snapshots.
- Plan changes require **explicit migration preview/action** — never silent mutation of existing subscriptions.

### Limits
- `CONFIGURED` / `UNLIMITED` / `UNCONFIGURED`.
- **Missing limit ≠ Unlimited.**
- Claim only enforcement classes proven by U01/limits suites (hard block / warn / advisory as implemented).

### Add-ons / Overrides
- Active-period only; tenant-specific; reason/approval where required; auto-expiry for temporary overrides; audited.

### Feature flags
- Operational kill switches only — **never** entitlement grants.
- U01 supplemental flags **default OFF**.

### Commercial SoR
- Step 16 remains commercial configuration Source of Record.

Authority docs: `docs/SUPER_ADMIN_HEALTHCARE_CATALOG_AND_CAPABILITY_MODEL.md`, `docs/SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md`, `docs/EFFECTIVE_ENTITLEMENT_RUNTIME.md`, `docs/USAGE_METERING_AND_LIMIT_ENFORCEMENT.md`.

---

## 6. Entitlement / licensing operational runbook

1. Confirm tenant lifecycle state (managed pending/terminal → **deny**).
2. Resolve via **active immutable EER snapshot** (not live plan edits).
3. LEGACY fallback only for **NEVER_MANAGED**.
4. Use entitlement explanation/debug surfaces (ops console / EER explain).
5. Check add-on/override contribution and expiry.
6. Check feature-flag kill switch (flag OFF can deny even if purchased).
7. Verify cache key isolation (tenant-scoped); stale allow must deny after invalidation fail-safe.
8. Interpret limit states: missing ≠ unlimited.
9. Escalate: Platform Security on-call → Eng lead → Release Manager (`SECURITY_RUNBOOKS.md`).

### Forbidden operator actions
- Tenant self-grant / manual capability injection  
- Direct DB entitlement edits as normal support  
- Mutating published Plan Versions  
- Treating missing limit as Unlimited  
- Bypassing managed EER via legacy fallback  

---

## 7. Deployment and rollback checklist

### Pre-deploy
- [ ] Step 28 checkpoint `2a332be` verified ancestor  
- [ ] Step 29 release SHA recorded  
- [ ] Working tree clean  
- [ ] Migrations reviewed (`prisma migrate status`)  
- [ ] Backup confirmed (operator)  
- [ ] Secrets/config validated  
- [ ] Least-privilege prod access confirmed (manual)  
- [ ] Dependency critical/high = 0  
- [ ] Edge CSP/header validation (deployment-owned)  
- [ ] Notification real-delivery policy confirmed  
- [ ] Runbook owners confirmed  

### Deploy
- [ ] `db:migrate:deploy` → `db:rls:apply` → `db:triggers:apply`  
- [ ] Application deploy (external topology)  
- [ ] `/health/live` + `/health/ready` green  
- [ ] Smoke: auth boundary, EER explain, one limit path, audit write  
- [ ] No real external notifications unless authorized  

### Post-deploy
- [ ] Scenario smoke (dental/general/limit/unauthorized)  
- [ ] Monitoring scrape of `/metrics` if configured  
- [ ] Audit append verified  
- [ ] Support owner confirmation  

### Rollback
- [ ] Decision: Release Manager  
- [ ] App rollback to previous artifact  
- [ ] DB: restore from pre-deploy backup (preferred) or documented forward-fix  
- [ ] Re-apply RLS/triggers after restore if required  
- [ ] Invalidate entitlement caches  
- [ ] Preserve audit history (append-only; do not delete)  
- [ ] Notification: no blind resend of ambiguous deliveries  
- [ ] Re-verify health + smoke  

---

## 8. Backup / restore checklist

| Item | Detail |
|------|--------|
| Repository scripts | `backup-postgres.ps1` / `.sh`, `verify-backup.sh`, `restore-postgres.sh` |
| When | Immediately before migrate/deploy |
| What | Full Postgres dump of target DB + checksum |
| Offsite/PITR | **external/deployment-owned** — operator must confirm |
| Restore validation | `verify-backup` then restore to non-prod clone; app boot + tenant smoke |
| Owner | Ops (named human **TO BE ASSIGNED BEFORE CUTOVER**) |
| Cutover blocker if backup unconfirmed | **YES** |

---

## 9. Monitoring and alerts checklist

| Signal | Ownership | Validation |
|--------|-----------|------------|
| Liveness `/health/live` | repository | Unit + post-deploy curl |
| Readiness `/health/ready` | repository | Unit + post-deploy curl |
| Metrics `/metrics` | repository (scrape = external) | Restrict network; confirm scrape job |
| Auth failures | app logs / metrics | External SIEM if used |
| Rate-limit / EER / provision / audit / notification failures | repository metrics + logs | Alert routing **external** |
| Migration failure | deploy pipeline | CI/deploy owner |
| CSP/edge headers | **external** | Manual fetch HTML/headers |
| On-call | **external** | Owner **TO BE ASSIGNED BEFORE CUTOVER** |

---

## 10. Production access / least privilege

| Gate | Status |
|------|--------|
| Platform RBAC (in-repo) | Verified by Step 08/28 suites — `docs/SUPER_ADMIN_RBAC_AND_PLATFORM_USERS.md` |
| Deploy access | external — least privilege; named humans **TO BE ASSIGNED BEFORE CUTOVER** |
| DB admin access | external — break-glass only |
| Secrets access | external — vault/least privilege |
| MFA / step-up | repository-enforced for sensitive platform actions |
| Access review cadence | organizational — manual cutover confirmation |

Result: **repository RBAC PASS**; **production host/DB/secrets access = manual cutover gate**.

---

## 11. Support / ownership handover matrix

| Domain | Owner (role) | Named human |
|--------|--------------|-------------|
| Catalog governance | Platform Admin | TO BE ASSIGNED BEFORE CUTOVER |
| Plan/version operations | Platform Admin | TO BE ASSIGNED BEFORE CUTOVER |
| Subscriptions / add-ons / overrides | Platform Admin | TO BE ASSIGNED BEFORE CUTOVER |
| Provisioning / tenant lifecycle | Ops + Platform Admin | TO BE ASSIGNED BEFORE CUTOVER |
| EER / entitlements / limits | Platform Admin + Security | TO BE ASSIGNED BEFORE CUTOVER |
| Feature flags | Ops | TO BE ASSIGNED BEFORE CUTOVER |
| Audit | Security | TO BE ASSIGNED BEFORE CUTOVER |
| Operations console | Ops | TO BE ASSIGNED BEFORE CUTOVER |
| Security / rate-limit / CSP edge | Security + Deploy | TO BE ASSIGNED BEFORE CUTOVER |
| Notifications | Ops + Platform Admin | TO BE ASSIGNED BEFORE CUTOVER |
| Sales / trials | Sales Ops + Platform Admin | TO BE ASSIGNED BEFORE CUTOVER |
| Migrations / backups / restore | Ops | TO BE ASSIGNED BEFORE CUTOVER |
| Monitoring / alerts | Ops + Security | TO BE ASSIGNED BEFORE CUTOVER |
| Incident escalation | Platform Security on-call → Eng lead → Release Manager | TO BE ASSIGNED BEFORE CUTOVER |

Named-human assignment is a **cutover manual gate**, not an in-repo product defect.

---

## 12. Migration readiness

| Item | Value |
|------|--------|
| Path | Prisma migrate deploy → RLS apply → triggers apply |
| New Step 29 schema migration | **NO** |
| Rollback tested (isolated) | Documented + tooling present; full prod drill = manual |
| Rollback documented | YES (`PRODUCTION_MIGRATION_WORKFLOW.md`, this doc) |
| Compensation | Forward-fix preferred; restore from backup for destructive failure |
| Backup prerequisite | YES before migrate |
| Remaining blocker | None in-repo; operator backup confirmation at cutover |

---

## 13. Known limitations and deferred backlog

| Item | Classification | Release blocking | Follow-up |
|------|----------------|------------------|-----------|
| Prod deploy topology (D-17) not in repo | deployment-owned manual validation | Cutover yes / Step 29 docs no | Document topology before prod |
| Edge CSP headers | deployment-owned manual validation | Cutover yes | SECURITY_RUNBOOKS §11 |
| Offsite backup / PITR | deployment-owned manual validation | Cutover yes | Confirm before migrate |
| Named on-call humans | deployment-owned manual validation | Cutover yes | Assign before cutover |
| F-TENANT-SA residual (tenant legacy super_admin) | accepted limitation (Step 28) | NO | Future hardening |
| G-RLS-01 hybrid app-filter | accepted limitation (Step 28) | NO | Explicit release note |
| No commercial APM/SIEM in repo | accepted limitation | NO | Optional external |
| HIPAA/GDPR certification | out-of-scope | NO | Never claim |
| Billing processors beyond R47 | out-of-scope / deferred | NO | Future release |
| Step 30+ product scope | out-of-scope | NO | Do not invent |

---

## 14. Launch checklist (summary)

See §7–§10. All pre-deploy/deploy/post-deploy items must be checked by Ops before production cutover. In-repo Step 29 runner PASS is necessary but not sufficient without external cutover gates.

---

## 15. Global Definition of Done (explicit)

| Requirement | Proof | Result |
|-------------|-------|--------|
| Conventions + changed files reported | This doc + final Cursor report | PASS (at external review) |
| Build/typecheck/unit/integration/relevant e2e | Step 29 runner | Runner counters |
| Server-side auth deny-by-default | Step 28 closure focused | PASS |
| Sensitive actions reason/audit/step-up | Audit + MFA suites | PASS |
| No PHI/secrets in logs/fixtures/frontend | secrets scan + Step 28 | PASS |
| Migrations reversible or documented | PRODUCTION_MIGRATION_WORKFLOW + backup | PASS |
| Concepts remain separate | Governance guide §5 | PASS |
| Published PV immutable / hist. subs reproducible | subscriptions DB | PASS |
| EER explainable, isolated, authoritative | EER DB + cache unit | PASS |
| Limits never overclaim | U01 docs + metering DB | PASS |
| Stable catalog keys; no destructive remove | catalog DB + invariant | PASS |
| Docs/runbooks updated | This doc + PHASE_47 | PASS |
| No accidental future rewrite | Scope = handover only | PASS |

---

## 16. Related documents

- `docs/PHASE_47_EXECUTION_PLAN.md`
- `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md`
- `docs/SECURITY_RUNBOOKS.md`
- `docs/OPERATIONS_CONSOLE_RUNBOOKS.md`
- `docs/PRODUCTION_MIGRATION_WORKFLOW.md`
- `docs/DISASTER_RECOVERY.md`
- `docs/EFFECTIVE_ENTITLEMENT_RUNTIME.md`
- `docs/USAGE_METERING_AND_LIMIT_ENFORCEMENT.md`
- `docs/SYSTEM_MONITORING_OBSERVABILITY_TRACING_AND_HEALTH.md`
