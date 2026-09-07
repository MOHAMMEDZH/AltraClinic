# Release 47 — Flexible Step 29
## Release Readiness and Operational Handover

| Field | Value |
|-------|--------|
| **Step** | Flexible Step 29 — Release Readiness and Operational Handover |
| **Status** | Implementation/validation/handover complete; acceptance pending external final review |
| **Authority** | Healthcare ERP SaaS — Flexible Super Admin Implementation Playbook v4 |
| **Steps 01–28 + U01** | Accepted / Complete |
| **Step 28 Case C** | Attempt 3 authoritative; executable freeze `6dafb4498819a4c0cd5d91dd3704eca3b9a0fb59` |
| **Step 28 checkpoint** | `2a332beafe8a1b6d767cb87b45c6b1eed647b673` |
| **Branch** | `cursor/step29-release-readiness-operational-handover` |
| **Final runner** | `apps/api/scripts/run-step29-final-onepass.mjs` (PASS; freeze `ea076b044b0fd601193e56cfbc0a74d45960c688`) |
| **Test DB** | `booking_test` @ `localhost:5433` |
| **Step 29 acceptance blockers** | **0** |
| **Production cutover gates pending execution** | **YES** (must pass at deploy time; failure blocks production) |

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

## 7. Blocker model (acceptance vs cutover)

Three distinct states — do not conflate:

| State | Meaning | Blocks Step 29 acceptance? | Blocks production deploy? |
|-------|---------|----------------------------|---------------------------|
| **A. Step 29 acceptance blocker** | Missing procedure, missing accountable role, or product/security defect | YES | YES |
| **B. Production cutover gate** | Procedure + accountable role defined; action still must run at deploy time | NO | YES if unmet |
| **C. Accepted limitation / deferred** | Explicit non-blocking residual or out-of-scope | NO | NO (unless separately gated) |

**Authoritative semantics:**

```text
Step 29 acceptance blockers = 0
Production cutover gates pending execution = YES
Production cutover may proceed without satisfying those gates = NO
```

Step 29 can be formally accepted because operational procedures and accountable roles are defined.

Production deployment is **NOT** automatically authorized by Step 29 acceptance.

The listed production cutover gates must still be executed successfully at deployment time.

---

## 8. Authoritative cutover ownership matrix (Form B roles)

Sources: `docs/SECURITY_RUNBOOKS.md` (Release Manager; Platform Security on-call → Eng lead → Release Manager), `docs/PHASE_47_EXECUTION_PLAN.md` (Ops + Platform Admin + Security), `docs/DISASTER_RECOVERY.md`, `docs/PRODUCTION_MIGRATION_WORKFLOW.md`.

No named individuals appear in repository evidence; accountable **roles** below are the handover assignments.

### 8.1 Backup / restore

| Field | Assignment |
|-------|------------|
| **Accountable role** | Database/Backup Operator (Platform Operations) |
| Backup execution | Database/Backup Operator runs `backup-postgres.ps1` / `.sh` immediately before migrate/deploy |
| Backup verification | Database/Backup Operator runs `verify-backup.sh` (checksum + integrity) |
| Restore authorization | **Release Manager** |
| Restore execution | Database/Backup Operator using `restore-postgres.sh` to approved target |
| Pre-cutover confirmation | Signed checklist: backup completed, verified, restore procedure available, restore validation target confirmed |
| Escalation | Platform Operations → Platform Engineering lead → **Release Manager** |
| Evidence location | This doc §9; `docs/DISASTER_RECOVERY.md`; scripts under `apps/api/scripts/` |
| Step 29 acceptance blocker | **NO** |
| Production cutover gate | **YES** — unmet backup/verify **blocks cutover** |

### 8.2 Deployment / topology / edge CSP

| Field | Assignment |
|-------|------------|
| **Accountable role** | Platform Operations (Deploy) |
| Topology validation (D-17) | Platform Operations documents and confirms actual prod topology before cutover |
| Edge CSP / security-header validation | Platform Operations + Platform Security per `SECURITY_RUNBOOKS.md` §11 (manual HTML/header fetch) |
| Deployment artifact responsibility | Platform Operations |
| Pre-cutover confirmation | Topology recorded; edge CSP/header check evidence attached; failure = **block cutover** |
| Escalation | Platform Operations → Platform Security → **Release Manager** |
| Evidence location | This doc §10; `SECURITY_RUNBOOKS.md` §11; PHASE_47 D-17 |
| Step 29 acceptance blocker | **NO** |
| Production cutover gate | **YES** |

### 8.3 Monitoring / alerts / on-call

| Field | Assignment |
|-------|------------|
| **Accountable role** | On-Call Incident Owner = **Platform Security on-call** (primary); Platform Operations (metrics scrape) |
| Required signals | `/health/live`, `/health/ready`, `/metrics`; auth/rate-limit/EER/provision/audit/notification failure logs |
| Validation method | Post-deploy curl health; confirm scrape job if configured; confirm alert route reaches on-call |
| On-call responsibility | Platform Security on-call |
| Incident escalation | Platform Security on-call → Platform Engineering lead → **Release Manager** (`SECURITY_RUNBOOKS.md`) |
| Pre-cutover confirmation | On-call coverage active; alert path tested or explicitly waived only by Release Manager in writing |
| Evidence location | This doc §11; observability docs; `SECURITY_RUNBOOKS.md` |
| Step 29 acceptance blocker | **NO** |
| Production cutover gate | **YES** |

### 8.4 Rollback authorization

| Field | Assignment |
|-------|------------|
| **Rollback decision authority** | **Release Manager** |
| Application rollback executor | Platform Operations |
| Database restore / compensation owner | Database/Backup Operator (under Release Manager authorization) |
| Cache invalidation owner | Platform Operations (with Platform Security if cross-tenant risk) |
| Post-rollback verification owner | Platform Operations + Platform Security |
| Escalation | Immediate **Release Manager**; Platform Security for leakage/audit risk |
| Evidence location | This doc §12; `PRODUCTION_MIGRATION_WORKFLOW.md` |
| Step 29 acceptance blocker | **NO** |
| Production cutover gate | **YES** (decision/authority exercised at incident/deploy time) |

### 8.5 Production access / least privilege

| Field | Assignment |
|-------|------------|
| **Access approval owner** | **Production Access Approver** = **Release Manager** (with Platform Security concurrence for privileged elevation) |
| Deploy access owner | Platform Operations |
| Database privileged access owner | Database/Backup Operator |
| Secrets access owner | Platform Security |
| Break-glass review owner | Platform Security + Release Manager |
| Pre-cutover access review confirmation | Least-privilege review completed; break-glass path known; evidence filed |
| Evidence location | This doc §13; `SUPER_ADMIN_RBAC_AND_PLATFORM_USERS.md`; `SECURITY_RUNBOOKS.md` |
| Step 29 acceptance blocker | **NO** |
| Production cutover gate | **YES** |

---

## 9. Backup / restore checklist (cutover gate)

**Accountable role:** Database/Backup Operator (Platform Operations)
**Authorize restore:** Release Manager

Before production cutover, **all** must be true or cutover is **BLOCKED**:

- [ ] Pre-deploy backup completed (`backup-postgres.ps1` / `.sh`)
- [ ] Backup verification completed (`verify-backup.sh`)
- [ ] Restore procedure available (`restore-postgres.sh` + `DISASTER_RECOVERY.md`)
- [ ] Restore target / validation procedure confirmed (non-prod clone smoke)
- [ ] Accountable Database/Backup Operator acknowledged
- [ ] Offsite/PITR status confirmed if used (external) — absence without Release Manager waiver **blocks cutover**

```text
Step 29 acceptance blocker = NO
production cutover gate = YES
production deployment blocking if unmet = YES
```

---

## 10. Deployment / topology / edge CSP checklist (cutover gate)

**Accountable role:** Platform Operations (Deploy)
**Security concurrence:** Platform Security (CSP/headers)

Before production cutover:

- [ ] Production deployment topology validated and recorded (D-17)
- [ ] Deployment artifact identity recorded
- [ ] Edge CSP / security-header validation performed (manual fetch; `SECURITY_RUNBOOKS.md` §11)
- [ ] Evidence attached to release record
- [ ] Failure behavior acknowledged: **block cutover**

```text
Step 29 acceptance blocker = NO
production cutover gate = YES
production deployment blocking if unmet = YES
```

Do not invent topology; record the actual external topology at cutover.

---

## 11. Monitoring / alerts / on-call checklist (cutover gate)

**Accountable roles:** Platform Operations (health/metrics scrape); On-Call Incident Owner = Platform Security on-call

Required signals: `/health/live`, `/health/ready`, `/metrics`; failure classes for auth, rate-limit, EER, provisioning, audit, notifications, migrations.

Before production cutover:

- [ ] Health endpoints validated post-deploy
- [ ] Metrics scrape path confirmed or explicitly marked external-not-configured with Release Manager acknowledgment of residual risk
- [ ] Alert routing / on-call coverage confirmed for Platform Security on-call
- [ ] Escalation path confirmed: on-call → Eng lead → Release Manager
- [ ] Failure of signal/on-call confirmation **blocks cutover**

```text
Step 29 acceptance blocker = NO
production cutover gate = YES
production deployment blocking if unmet = YES
```

Do not claim external APM/SIEM is configured unless cutover evidence proves it.

---

## 12. Deployment and rollback checklist

### Pre-deploy (production cutover gates — all required)

- [ ] Step 28 checkpoint `2a332be` verified ancestor — Platform Operations
- [ ] Step 29 release SHA recorded — Platform Operations
- [ ] Working tree / release artifact clean — Platform Operations
- [ ] Migrations reviewed (`prisma migrate status`) — Database/Backup Operator
- [ ] §9 backup/verify complete — Database/Backup Operator
- [ ] Secrets/config validated — Platform Security
- [ ] §13 least-privilege access review — Release Manager + Platform Security
- [ ] Dependency critical/high = 0 — Platform Security
- [ ] §10 topology + edge CSP validated — Platform Operations + Platform Security
- [ ] Notification real-delivery policy confirmed — Platform Operations
- [ ] §11 on-call/alerts confirmed — Platform Security on-call

### Deploy

- [ ] `db:migrate:deploy` → `db:rls:apply` → `db:triggers:apply` — Database/Backup Operator
- [ ] Application deploy — Platform Operations
- [ ] `/health/live` + `/health/ready` green — Platform Operations
- [ ] Smoke: auth boundary, EER explain, one limit path, audit write — Platform Operations + Platform Security
- [ ] No real external notifications unless Release Manager authorized

### Post-deploy

- [ ] Scenario smoke (dental/general/limit/unauthorized) — Platform Operations
- [ ] Monitoring scrape / alert path check — Platform Operations + Platform Security on-call
- [ ] Audit append verified — Platform Security
- [ ] Support/handover confirmation — Platform Admin + Platform Operations

### Rollback

- [ ] Decision: **Release Manager**
- [ ] App rollback: Platform Operations
- [ ] DB restore/compensation: Database/Backup Operator (authorized by Release Manager)
- [ ] Re-apply RLS/triggers after restore if required — Database/Backup Operator
- [ ] Invalidate entitlement caches — Platform Operations
- [ ] Preserve audit history (append-only) — Platform Security
- [ ] Notification: no blind resend of ambiguous deliveries — Platform Operations
- [ ] Post-rollback verification — Platform Operations + Platform Security

```text
Step 29 acceptance blocker = NO
production cutover gate = YES (authority exercised at deploy/incident time)
```

---

## 13. Production access / least privilege

| Gate | Accountable role | Status |
|------|------------------|--------|
| Platform RBAC (in-repo) | Platform Security | PASS (Steps 08/28) — `SUPER_ADMIN_RBAC_AND_PLATFORM_USERS.md` |
| Access approval | Release Manager (+ Platform Security for elevation) | Production cutover gate |
| Deploy access | Platform Operations | Production cutover gate |
| DB privileged access | Database/Backup Operator | Production cutover gate |
| Secrets access | Platform Security | Production cutover gate |
| Break-glass review | Platform Security + Release Manager | Production cutover gate |
| MFA / step-up | Platform Security (repo-enforced) | PASS |

```text
Step 29 acceptance blocker = NO
production cutover gate = YES
production deployment blocking if unmet = YES
```

External IAM execution is **not** claimed complete by Step 29; confirmation is required at cutover.

---

## 14. Support / domain ownership matrix (accountable roles)

| Domain | Accountable role | Escalation |
|--------|------------------|------------|
| Catalog governance | Platform Admin | Release Manager |
| Plan/version operations | Platform Admin | Release Manager |
| Subscriptions / add-ons / overrides | Platform Admin | Release Manager |
| Provisioning / tenant lifecycle | Platform Operations + Platform Admin | Release Manager |
| EER / entitlements / limits | Platform Admin + Platform Security | Release Manager |
| Feature flags | Platform Operations | Release Manager |
| Audit | Platform Security | Release Manager |
| Operations console | Platform Operations | Release Manager |
| Security / rate-limit / edge CSP | Platform Security + Platform Operations | Release Manager |
| Notifications | Platform Operations + Platform Admin | Release Manager |
| Sales / trials | Platform Admin (Sales Ops coordination) | Release Manager |
| Migrations / backups / restore | Database/Backup Operator (Platform Operations) | Release Manager |
| Monitoring / alerts / on-call | Platform Security on-call + Platform Operations | Release Manager |
| Incident / release-block decisions | Release Manager | — |

```text
unresolved acceptance-critical owner placeholders = 0
```

---

## 15. Migration readiness

| Item | Value |
|------|--------|
| Path | Prisma migrate deploy → RLS apply → triggers apply |
| New Step 29 schema migration | **NO** |
| Rollback tested (isolated) | Documented + tooling present; full prod drill = production cutover gate |
| Rollback documented | YES |
| Compensation | Forward-fix preferred; restore from backup for destructive failure |
| Backup prerequisite | YES — §9 cutover gate |
| Step 29 acceptance blocker | **NO** |
| Production cutover blocking if unmet | **YES** (backup/migrate confirmation) |

---

## 16. Known limitations and deferred backlog

| Item | Classification | Step 29 acceptance blocking | Production deployment blocking if unmet | Follow-up |
|------|----------------|----------------------------|----------------------------------------|-----------|
| Prod deploy topology (D-17) not in repo | deployment-owned **production cutover gate** | **NO** | **YES** | Platform Operations records topology at cutover |
| Edge CSP headers | deployment-owned **production cutover gate** | **NO** | **YES** | SECURITY_RUNBOOKS §11 validation |
| Offsite backup / PITR | deployment-owned **production cutover gate** | **NO** | **YES** (or Release Manager written waiver) | Database/Backup Operator confirms |
| External APM/SIEM optional | accepted limitation | **NO** | **NO** (health/on-call gate still applies) | Optional |
| F-TENANT-SA residual | accepted limitation (Step 28) | **NO** | **NO** | Future hardening |
| G-RLS-01 hybrid app-filter | accepted limitation (Step 28) | **NO** | **NO** | Explicit release note |
| HIPAA/GDPR certification | out-of-scope | **NO** | **NO** | Never claim |
| Billing beyond R47 | out-of-scope / deferred | **NO** | **NO** | Future release |
| Step 30+ product scope | out-of-scope | **NO** | **NO** | Do not invent |

---

## 17. Launch checklist (summary)

Execute §9–§13 at production cutover. In-repo Step 29 runner PASS is necessary but **not sufficient**.

```text
Step 29 acceptance blockers = 0
Production cutover gates pending execution = YES
Production may proceed if a cutover gate fails = NO
```

---

## 18. Global Definition of Done (explicit)

| Requirement | Proof | Result |
|-------------|-------|--------|
| Conventions + changed files reported | This doc + final Cursor report | PASS (at external review) |
| Build/typecheck/unit/integration/relevant e2e | Step 29 runner | PASS (freeze `ea076b0`) |
| Server-side auth deny-by-default | Step 28 closure focused | PASS |
| Sensitive actions reason/audit/step-up | Audit + MFA suites | PASS |
| No PHI/secrets in logs/fixtures/frontend | secrets scan + Step 28 | PASS |
| Migrations reversible or documented | PRODUCTION_MIGRATION_WORKFLOW + backup | PASS |
| Concepts remain separate | Governance guide §5 | PASS |
| Published PV immutable / hist. subs reproducible | subscriptions DB | PASS |
| EER explainable, isolated, authoritative | EER DB + cache unit | PASS |
| Limits never overclaim | U01 docs + metering DB | PASS |
| Stable catalog keys; no destructive remove | catalog DB + invariant | PASS |
| Docs/runbooks + cutover ownership | This doc §§7–14 | PASS |
| No accidental future rewrite | Scope = handover only | PASS |

---

## 19. Related documents

- `docs/PHASE_47_EXECUTION_PLAN.md`
- `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md`
- `docs/SECURITY_RUNBOOKS.md`
- `docs/OPERATIONS_CONSOLE_RUNBOOKS.md`
- `docs/PRODUCTION_MIGRATION_WORKFLOW.md`
- `docs/DISASTER_RECOVERY.md`
- `docs/EFFECTIVE_ENTITLEMENT_RUNTIME.md`
- `docs/USAGE_METERING_AND_LIMIT_ENFORCEMENT.md`
- `docs/SYSTEM_MONITORING_OBSERVABILITY_TRACING_AND_HEALTH.md`
