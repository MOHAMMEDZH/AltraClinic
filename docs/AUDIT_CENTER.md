# Flexible Step 21 — Audit Center

**Canonical roadmap:** Super Admin Flexible Plans & Entitlements Implementation Playbook v4  
**Release:** 47 — Flexible Super Admin MVP  
**Status:** **Accepted / Complete** — Case C uninterrupted one-pass green (2026-08-09); A08 D11 exact durable success audit delta = 1; evidence hygiene = 0; Steps 22–29 unauthorized  
**Authority:** Playbook v4 → `SUPER_ADMIN_ARCHITECTURE` / Super Admin docs → `PHASE_47_EXECUTION_PLAN.md` → this freeze → Steps 06–20 / U01 → repository evidence  

**Flexible Steps 22–29 remain unauthorized.** Operations Console, future sales, and billing are out of scope.

---

## 1. Discovery summary (repository evidence)

| Concern | Evidence | Decision |
|---------|----------|----------|
| Platform audit SoR | `AuditEntry` (`audit_entries`) under sentinel tenant `PLATFORM_AUDIT_SENTINEL_TENANT_ID` | **Reuse** — primary searchable SoR |
| Licensing audit | `LicenseAuditEvent` (append-only triggers) | **Reuse** — domain filter / evidence class |
| Object history | `PlatformFeatureFlagHistory`, `PlatformGlobalSettingHistory` | **Reuse** — Step 20 evidence views |
| Commercial immutability | Published `PlatformPlanVersion`, Override rows + existing AuditEntry writes | Evidence views + correlation |
| Provisioning / lifecycle | Request ledgers + AuditEntry adapters | Correlate via resource/correlation IDs |
| Clinic audit API | `GET/POST /audit/entries` (tenant JWT) | **Not** Platform Audit Center |
| Platform Audit Center API | Absent | **New** `/platform/audit/*` |
| Permissions | `audit.view`, `audit.export` (export step-up) | Reuse; add narrow `audit.sensitive.view`, `audit.network-metadata.view` |
| DB immutability | Triggers on `audit_entries`, `license_audit_events` | Preserve; prove I01–I12 |
| Export jobs | Import-export is tenant-scoped | **New** bounded Platform export (streamed + metadata) |
| Super Admin nav | `/audit` placeholder, `operations` group, `audit.view` | Promote to live Audit Center |
| Sales audits | None (Steps 23+) | A17 = N/A for future sales |
| Phase 39 clinic Audit Center | Distinct product | Do not merge |

---

## 2. Sources of Record (frozen)

| Domain | SoR | Mutability |
|--------|-----|------------|
| Platform commercial/security/admin evidence | `AuditEntry` (sentinel tenant) | Append-only |
| Licensing decisions | `LicenseAuditEvent` | Append-only |
| Feature flag / global setting history | Step 20 history tables | Append-only (application) |
| Plan Version evidence | Immutable Plan Version rows + AuditEntry | No rewrite via Audit Center |
| Override evidence | Override rows + AuditEntry | No rewrite via Audit Center |
| EER sensitive decisions | Model A — read existing provenance/snapshots | Prefer no new decision log flood |
| Secrets / PHI | Never stored in Audit Center payloads | — |
| Step 22 ops | Out of scope | — |

Audit Center is a **read / export / evidence** surface. It does not replace domain SoRs.

---

## 3. Event taxonomy (canonical action keys)

Reuse existing adapter action strings. Categories:

| Category | Examples |
|----------|----------|
| `platform_security` | Platform user/RBAC/MFA/session (A01–A02) |
| `catalog` | Healthcare catalog edits (A03) |
| `plan` | Plan / Plan Version draft/publish/retire (A04–A05) |
| `entitlement` | Entitlement / Limit changes (A06–A07) |
| `addon` | Add-on assign/remove (A08) |
| `override` | Override lifecycle (A09) |
| `subscription` | Assign / migrate (A10) |
| `provisioning` | Tenant creation/provisioning (A11) |
| `lifecycle` | Suspend/reactivate/archive/… (A12) |
| `feature_flag` | Flag/target/kill-switch (A13–A14) — via history + AuditEntry when present |
| `global_setting` | Setting/reference (A15) |
| `eer_decision` | Sensitive runtime decisions (A16) — Model A adapter |
| `sales` | Existing sales actions only (A17) — none today |
| `audit_export` | Export request/success/failure (A18) |

---

## 4. Safe field contract

**Allowed:** immutable id, occurredAt (`createdAt` UTC), actor type/id/safe summary, action, category/result, target type/id/safe summary, bounded reason, bounded before/after (`changes`/`details` redacted), approval/request ids when present, correlation/causation/request ids, Plan/PlanVersion/Subscription/Add-on/Override ids, snapshot fingerprint/source type when safe, tenant id when permitted, retention/access class.

**Prohibited:** PHI/clinical data, passwords/keys/tokens/MFA secrets, cookies/session ids/auth headers, raw bodies, raw snapshots/subscription rows, raw UA fingerprints (unless `audit.network-metadata.view`), unbounded JSON, SQL/Prisma/stacks.

### IP / device

| Aspect | Policy |
|--------|--------|
| Storage | Existing `ipAddress` / `userAgent` columns when callers supply; many platform adapters pass null |
| API default | Masked / omitted |
| Full network metadata | Requires `audit.network-metadata.view` |
| Export | Same permission gate; never raw fingerprinting persistence |
| Retention | Same as audit row (never-delete app policy) |

---

## 5. Runtime decision evidence (A16)

**Model A (preferred):** read-only adapter over Flexible Step 18 provenance / activation snapshot fingerprints.  
**Model B:** not used for ordinary Clinic authorization. Optional bounded capture only if an accepted sensitive path already persists evidence.

Response includes: final result, reason code, tenant, capability key, timestamp/correlation, lifecycle/commercial/operational components, safe source pointers, resolver version — never raw snapshot/PHI/secret.

---

## 6. Immutability

### Application
- No PATCH/PUT/DELETE audit routes
- No edit/delete UI
- Repository exposes create + read only for immutable rows
- Corrections (if ever) append linked events — never rewrite

### Database
- Preserve `audit_entries` / `license_audit_events` UPDATE/DELETE triggers
- Runtime app role cannot UPDATE/DELETE audit rows
- Prove I01–I12 with real Postgres

---

## 7. Search and correlation

- Server-side filters: date range, actor, action, category/domain, target, tenant, result, correlation/request/approval, Plan Version / Subscription / Add-on / Override, flag/setting key, evidence class
- Cursor pagination: `(createdAt, id)` descending
- Max page size 100; max date range 366 days (configurable bound)
- UTC storage/compare; locale display; ISO-8601 export timestamps
- Source deep-links require source-domain permission
- No client-side full dataset; no PHI search; no existence oracle across unauthorized tenants

---

## 8. Evidence views

| View | Content | Mutates source? |
|------|---------|-----------------|
| Plan Version | Draft/publish/retire/entitlement/limit audit trail + version identity | No |
| Override | Create/update/expire/revoke + capability/Limit + Plan/Subscription context | No |
| Flag / Setting | History rows + correlation | No |
| Correlation timeline | Bounded related events by correlationId | No |

---

## 9. Export

- Permission: `audit.export` + fresh step-up + reason
- Frozen filter fingerprint; date/row bounds; actual 429 rate limit
- UTF-8 CSV, deterministic columns, formula injection neutralized
- Permission-based redaction; no public URL
- Durable export audit (A18); completed-only idempotency
- Persistent download only if metadata row + authorized expiring token; else streamed response
- No generic report builder

---

## 10. Permissions

| Permission | Purpose |
|------------|---------|
| `audit.view` | List/detail/timeline/evidence (existing) |
| `audit.export` | Export (existing; step-up) |
| `audit.sensitive.view` | Sensitive entitlement-decision / high-risk details (new, narrow) |
| `audit.network-metadata.view` | Unmasked IP/UA (new, narrow) |

Clinic/tenant principals denied. Wildcard/role-name bypass denied. Platform Owner has no immutability bypass.

---

## 11. Containment

`AUDIT_CENTER_ENABLED` env, default **false**.  
When off: mutation/export routes → `503` `audit_center_disabled`; optional empty safe status for reads with view permission per ops policy.  
Does not disable domain audit **writes**.

---

## 12. Atomicity

Domain mutations remain responsible for atomic business + audit (or accepted outbox).  
Audit Center does not invent success audits.  
Export creates its own A18 audit rows with completed-only idempotency.

---

## 13. Retention

Application policy: **never delete** audit evidence through ordinary routes.  
No retention-shortening UI.  
I12: retention maintenance unavailable through app routes.

---

## 14. Non-goals / Step 22 boundary

Not in Step 21: Operations Console, jobs/queues/backup health controls, notification template admin, generic event store, future sales CRM, billing, Clinic Enterprise Audit Center rewrite, PHI stores, raw secret management.

---

## 15. Catalog / commercial invariants

Catalog remains **68 / 136 / 68 / 13**.  
Migrations create zero business/commercial/lifecycle/provisioning/Step20/U01/secret/PHI side effects and zero invented success audits.

---

## 16. Acceptance pointer

Step 21 is **Accepted / Complete**. Host Docker/PostgreSQL recovery cleared prior `booking_test` zombie backends (77 → 0). Frozen final database: `booking_test` (unchanged for the whole sequence). Case C one-pass 2026-08-09 exit 0; failures/retries/dbRestarts/commandReruns/productEdits/databaseSwitches = 0. A08 D11 durable success audit delta = 1. Catalog **68 / 136 / 68 / 13**. Prohibited evidence artifacts = 0.

**Flexible Step 22 remains unauthorized.**

---

## 17. Real Domain Audit Coverage (Final Proof Correction Gate)

Inventory of production mutation paths used by independently named tests in
`audit-center-real-domain.postgres.integration.spec.ts`. Synthetic `seedAuditEntry` / `appendMatrixAuditOnce` **does not** count as A01–A16 domain coverage.

| ID | Domain action | Controller / handler | Production service | Tx / outbox | Audit / history | Test name | Synthetic shortcut |
|----|---------------|----------------------|--------------------|-------------|-----------------|-----------|--------------------|
| A01 | Role assign | `POST platform/users/:id/roles` | `PlatformUserAdminMutationsService.assignRole` | **Model A** same-tx mutation + `AuditEntry` | `platform.user.role.assigned` | `A01: Platform user role assign…` | no |
| A02 | Session revoke | `POST platform/users/:id/sessions/:sessionId/revoke` | `PlatformUserAdminMutationsService.revokeSession` | **Model A** same-tx mutation + `AuditEntry` | `platform.user.session.revoked` (session id redacted) | `A02: Platform session revoke…` | no |
| A03 | Catalog edit | `HealthcareCatalogService.updateItem` | same | **Model A** same-tx mutation + `AuditEntry` | `healthcare_catalog.item.updated` | `A03: Catalog updateItem…` | no |
| A04 | Plan draft | `PlatformPlansService.createDraftVersion` | same | **Model A** same-tx mutation + `AuditEntry` | `platform_plan_version.created` | `A04: Plan version draft…` | no |
| A05 | Plan publish | `PlatformPlansService.publishVersion` | same | **Model A** same-tx + idempotency + `AuditEntry` | `platform_plan_version.published` | `A05: Plan version publish…` | no |
| A06 | Entitlements | `PlanEntitlementsService.putEntitlements` | same | **Model A** same-tx + idempotency + `AuditEntry` | `platform_plan_version.entitlements_replaced` | `A06: Entitlements replace…` | no |
| A07 | Limits | `PlanEntitlementsService.putLimits` | same | **Model A** same-tx + idempotency + `AuditEntry` | `platform_plan_version.limits_replaced` | `A07: Limits replace…` | no |
| A08 | Add-on assign | `PlatformSubscriptionsService.replaceAddOns` | same | **Model A** same-tx + commercial change + idempotency + `AuditEntry` | `platform_subscription_commercial.addons_replaced` | `A08: Add-on assignment…` | no |
| A09 | Override approve | `PlatformOverridesService.approve` | same | **Model A** same-tx + idempotency + `AuditEntry` | `platform_override.approved` | `A09: Override approve…` | no |
| A10 | Subscription assign | `PlatformSubscriptionsService.assignPlanVersion` | same | **Model A** same-tx + change row + idempotency + `AuditEntry` | `platform_subscription_commercial.plan_version_assigned` | `A10: Subscription plan assign…` | no |
| A11 | Provisioning activate | `TenantProvisioningService.activate` (`runFullHappyPath`) | same | **Model A** same-tx `AuditEntry` (orchestration) | `tenant_provisioning.activated` | `A11: Tenant provisioning activate…` | no |
| A12 | Lifecycle | `TenantLifecycleService.suspend` + `createArchiveRequest`/`approveRequest` | same | **Model A** same-tx `AuditEntry` | `tenant_lifecycle.suspend` + `tenant_lifecycle.request.approved` | `A12: Tenant lifecycle suspend…` | no |
| A13 | Feature flag create | `FeatureFlagsSettingsService.createFlag` | same | Atomic flag + history in-tx | `platform_feature_flag_history` `FEATURE_FLAG_CREATE` | `A13: Feature flag create…` | no |
| A14 | Kill-switch | `FeatureFlagsSettingsService.setKillSwitch` | same | Atomic flag + history in-tx | `FEATURE_FLAG_KILL_SWITCH_ACTIVATE` | `A14: Kill-switch activate…` | no |
| A15 | Global setting | `FeatureFlagsSettingsService.updateSetting` | same | Atomic setting + history in-tx | `GLOBAL_SETTING_UPDATE` | `A15: Global setting update…` | no |
| A16 | Sensitive decision | `OperationalDecisionService.evaluate` + `AuditCenterEvidenceService.eerDecisionEvidence` | Model A read adapter | Read-only decision | No ordinary Clinic auth flood; safe Model A shape | `A16: Sensitive EER/ops decision…` | no |
| A17 | Sales | — | — | — | No sales SoR | `A17: Not Applicable…` | N/A |
| A18 | Export | `AuditCenterExportService` | Export suite | Export idempotency | Export audit rows | existing E / coverage suites | no |

**Atomicity note:** A01–A15 covered success mutations use **Model A** (same PostgreSQL transaction for business mutation + immutable `AuditEntry` or object-specific history). Rejection-only `safeAudit` paths (e.g. OCC stale, override rejected) remain non-authoritative best-effort and do not document business success. Step 20 history rows are in-transaction with the mutation.

---

## 17b. A01/A02 Durable Audit Atomicity

| Field | Value |
|-------|--------|
| Previous defect | Post-commit `AuditTrailPlatformSecurityAuditLog.record` with swallowed failures — business could commit without durable evidence |
| Selected model | **Model A** — same-transaction AuditEntry append via `prisma.withPlatformBypass` |
| Rejected | Model B outbox (unnecessary — same DB); post-commit best-effort (violates durability invariant) |
| A01 order | authorize → validate → begin tx → `FOR UPDATE` user → role upsert → authz bump → session revoke-all → append AuditEntry (if newly assigned) → commit → optional non-authoritative event publish |
| A02 order | authorize → step-up → begin tx → ownership-scoped session revoke → append AuditEntry → commit → optional non-authoritative event publish |
| Best-effort success audit paths remaining | **0** |
| Failure injection | `PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION` (NODE_ENV=test only): `after_business_mutation_staging`, `after_audit_staging`, `before_commit`, `after_commit_before_response` |
| Suite | `audit-center-a01-a02-durability.postgres.integration.spec.ts` (A01-D01–D12, A02-D01–D12) |
| Model B projector cases | A01-D09/D10, A02-D09/D10 = **N/A** (Model A) |

---

## 17c. A03–A15 Durability and Correlation Semantics Closure

| Field | Value |
|-------|--------|
| Previous defects | (1) A03–A15 durability unproven / post-commit best-effort success audit; (2) `actor.jti` used as operation correlation |
| Selected model | **Model A** for every applicable A03–A15 path (same-tx `recordInTransaction` or object history append) |
| Model B | Not selected — same DB; D09/D10 = N/A |
| Transaction order | authorize → validate → begin `withPlatformBypass` → business mutation → immutable evidence append → commit → optional non-authoritative cache/metrics/events |
| Required best-effort success audit paths remaining | **0** |
| Allowed non-authoritative best-effort | rejection `safeAudit`, metrics, cache invalidation, notifications, logs, telemetry |
| Correlation helper | `resolveOperationCorrelationId` (`platform-audit-center/application/operation-correlation.ts`) |
| Correlation precedence | explicit → ALS/request context (CorrelationMiddleware) → server-generated UUID |
| Rejected correlation sources | `actor.jti`, raw session ID, tenant ID, raw idempotency key, email, display name |
| Distinct fields | `actorId` ≠ token/session ≠ `correlationId` ≠ idempotency reference ≠ `targetId` |
| Durability suite | `audit-center-a03-a15-durability.postgres.integration.spec.ts` |
| Correlation suite | `audit-center-correlation.postgres.integration.spec.ts` (CORR01–CORR15) |
| Regression | **Case C** — production durability + correlation changes; new uninterrupted Step 21 one-pass **required** |
| Final one-pass | Pending this gate |
| Step 22 | Unauthorized / absent |

---

## 18. Actual Route Inventory

Controller: `PlatformAuditCenterController`.

| Method | Path | Permission | Sensitive | Step-up | Rate limit | Cache |
|--------|------|------------|-----------|---------|------------|-------|
| GET | `/platform/audit/entries` | `audit.view` | `audit.sensitive.view` / network | — | expensive-query | `private, no-store` |
| GET | `/platform/audit/entries/:id` | `audit.view` | same | — | — | `private, no-store` |
| GET | `/platform/audit/correlation/:correlationId` | `audit.view` | same | — | — | `private, no-store` |
| GET | `/platform/audit/plan-versions/:planVersionId/evidence` | `audit.view` | source-domain | — | — | `private, no-store` |
| GET | `/platform/audit/overrides/:overrideId/evidence` | `audit.view` | source-domain | — | — | `private, no-store` |
| GET | `/platform/audit/feature-flags/:flagId/evidence` | `audit.view` | — | — | — | `private, no-store` |
| GET | `/platform/audit/eer-decisions` | `audit.view` | `audit.sensitive.view` | — | — | `private, no-store` |
| POST | `/platform/audit/exports/preview` | `audit.export` | redaction | — | export RL | `private, no-store` |
| POST | `/platform/audit/exports` | `audit.export` | redaction | fresh step-up | export RL | — |
| GET | `/platform/audit/exports/:exportId` | `audit.export` | — | — | — | `private, no-store` |
| GET | `/platform/audit/exports/:exportId/download` | `audit.export` | token | — | — | `private, no-store` |

Exhaustive Passport matrix: `audit-center-http-exhaustive.postgres.integration.spec.ts` (R01–R11 × H01–H30 applicable).

---

## 19. Query-plan and performance evidence

Suite: `audit-center-query-plans.postgres.integration.spec.ts`.

- Representative fixture: ≥2500 `audit_entries` with shared timestamps, multi-tenant, multi-action, correlation chain length 80, Plan Version / Override pointer clusters.
- P01–P16: `EXPLAIN (ANALYZE, BUFFERS)` against production query shapes; common filters use `audit_entries` indexes (`tenantId+createdAt`, `tenantId+action+createdAt`, `tenantId+category+createdAt`, `tenantId+resourceType+resourceId`, `correlationId`, `createdAt+id`).
- N+1: list/search projects actor/target from the audit row (no per-row `platform_users` lookup); correlation hard-capped at `AUDIT_CENTER_CORRELATION_MAX`; evidence `take` ≤ 200.

---

## 20. Step 17 C17 timeout investigation

| Field | Value |
|-------|-------|
| Exact test | `C17: retry versus retry` |
| Suite | `apps/api/src/modules/tenant-provisioning/tests/tenant-provisioning-concurrency.postgres.integration.spec.ts` |
| Scenario | Concurrent `retry` vs `retry` after injected failure at `after_commercial_configuration` |
| Sync | `Promise.allSettled` + `raceEvidence` |
| Previous timeout | 120_000 ms |
| Current timeout | 300_000 ms |
| Focused durations (2026-08-06) | body ~59s; suite walls ~99s / 101s / **124s** (exceeds 120) |
| Prior Step 21 one-pass | Timed out at 120s under sequential load |
| Assertions | Unchanged (ok ≥ 1; commercialCount ≤ 1) |
| Deadlock / open handles / orphans | None observed in focused reruns |
| Conclusion | **Outcome A** — keep 300s; deterministic long-running concurrency under DB load; 120s insufficient even in isolation (suite wall can exceed 120) |

---

## 21. Final proof correction status

| Gate item | Status |
|-----------|--------|
| Real A01–A16 | **Passed** — Model A for A01–A15 covered success paths; A16 read adapter |
| A01/A02 durability D01–D12 | **Passed** — Model A; D09/D10 N/A |
| A03–A15 durability matrices | **Passed (focused)** — Model A; suite green with CORR |
| A08-D11.1–D11.10 | **Passed (focused)** — exact duplicate concurrent `replaceAddOns`: business=1, completed idempotency=1, durable success audit delta=**1**, duplicates=0, orphans=0 |
| CORR01–CORR15 | **Passed (focused)** — `actor.jti` not operation correlation |
| Exhaustive H-matrix | **Passed** — all 11 routes |
| P01–P16 / N+1 | **Passed** |
| C17 | **Outcome A** — 300s kept |
| Clean / upgrade validators | **Passed (focused)** — unique per-run DB names; no `DROP … WITH (FORCE)` on shared names; overall deadline 10m |
| Regression case | **Case C** — A08 D11 claim fix + validator/runner resilience |
| One-pass | **Passed** — 2026-08-09 `01:19:53Z`–`03:05:43Z` (~105.8m); frozen DB `booking_test`; exit 0; failures/retries/dbRestarts/commandReruns/productEdits/databaseSwitches = 0 |
| Evidence hygiene | **Passed** — `br-step21-*`, `step21-final-onepass*`, and related raw evidence removed; remaining prohibited = 0 |
| Best-effort A03–A15 required success audit | **0** remaining |
| Step 22 | Unauthorized / absent |

### Host recovery + Case C closure (2026-08-08 → 2026-08-09)

| Field | Value |
|-------|-------|
| Stale backends before | ~77 on `booking_test` (Aug-7 zombies; `pg_terminate_backend` ineffective) |
| Host action | Restart Docker Desktop / recreate `postgres-test` |
| Stale backends after | **0**; long tx / idle-in-tx / ungranted locks = 0 |
| Frozen final DB | `booking_test` @ `localhost:5433` (frozen before command 1; no mid-sequence switch) |
| Focused preflight | clean/upgrade validators, A08-D11+A03–A15+CORR, subscriptions, platform-db-security, tenant-lifecycle, audit-center-db — all exit 0 |
| Final one-pass | `node apps/api/scripts/run-step21-final-onepass.mjs` — exit **0** |
| A08 D11 | businessEffect=1, completedIdem=1, durable success audit delta=**1**, duplicates=0, orphans=0 |
| Catalog | **68 / 136 / 68 / 13** |
| Evidence | **0** remaining prohibited artifacts |

### A08 D11 claim model (2026-08-08)

- **Root cause:** completed-only `beginOrReplay` let concurrent exact-duplicate callers both enter the business transaction before a durable claim existed.
- **Fix:** `SubscriptionIdempotencyService.claimInTransaction` — unique-index `INSERT … ON CONFLICT DO NOTHING RETURNING` of the completed claim **before** Add-on mutation; loser gets `SubscriptionIdempotencyEquivalentRaceLostError` → replay DTO (no second mutation / no second success audit). Claim rolls back with the business transaction on failure.
- **Rejected:** post-hoc audit deletion, timing sleeps, accepting audit delta `1–2`, global tenant serialization, weakened D11 assertions.

### Clean validator hang (root cause)

- Fixed-name `DROP DATABASE … WITH (FORCE)` blocked indefinitely (`wait_event=CheckpointDone` / non-terminable backends).
- **Correction:** unique `test_ac_clean_<ts>` / `test_ac_upgrade_<ts>` per run; `CREATE` only; overall 10-minute deadline; per-command timeouts; Prisma `SELECT 1` readiness (no Docker CLI gate).

**Flexible Step 22 remains unauthorized.**

**Step 21 is Accepted / Complete.**
