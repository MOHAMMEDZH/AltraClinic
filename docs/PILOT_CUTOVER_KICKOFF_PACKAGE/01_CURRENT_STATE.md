# C0 — Current state (precursors)

**Lineage tip:** `64eb2a9` · **Cutover executed:** NO

What already exists on the accepted Release 47 + Phase 49/50/51 lineage. C0 does not re-prove these; it maps them for pilot cutover packaging.

---

## Ops / cutover packaging present

| Surface | Path | Status |
|---------|------|--------|
| Secrets / config hygiene | [`PHASE_49_K2_SECRETS_CONFIG/`](../PHASE_49_K2_SECRETS_CONFIG/) | PASS-local (packaging) |
| Backup / restore cutover SoR | [`PHASE_49_K3_BACKUP_RESTORE/`](../PHASE_49_K3_BACKUP_RESTORE/) | PASS-local; offsite/PITR **EXTERNAL** |
| Deploy / rollback | [`PHASE_49_K5_DEPLOY_ROLLBACK/`](../PHASE_49_K5_DEPLOY_ROLLBACK/) | PASS-local; dry-run **PARTIAL** without real cutover |
| Tenant isolation production-check | [`PHASE_49_K6_TENANT_ISOLATION/`](../PHASE_49_K6_TENANT_ISOLATION/) | PASS-local (wrappers reuse) |
| Cutover ownership / gates | [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md) **§§7–14** | PASS-local docs; gates **pending execution** |
| Tenant go-live checklist | [`PHASE_51_L3_GOLIVE_CHECKLIST/`](../PHASE_51_L3_GOLIVE_CHECKLIST/) | PASS-local; ≠ executed cutover |
| Operator hub | [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md) | PASS-local |
| Migration workflow | [`PRODUCTION_MIGRATION_WORKFLOW.md`](../PRODUCTION_MIGRATION_WORKFLOW.md) | PASS-local pointer |

---

## DB roles / credentials (honest)

| Item | What exists | Gap for pilot |
|------|-------------|----------------|
| Test app role `booking_app` | `docker/postgres-test-init/01-app-role.sql` — `NOSUPERUSER` **NOBYPASSRLS** | Test/local only |
| Integration URLs | `INTEGRATION_DATABASE_URL` patterns in `.env.example` / K6 commands | Not production |
| Migrate deploy path | `npm run db:migrate:deploy` + RLS apply (K5 / Step 29) | Needs **prod** credential wiring (C1+) |
| **Prod role bootstrap script** | — | **MISSING** — no in-repo prod migrate-admin / runtime-app bootstrap (C1 owns SQL template + runbook) |

---

## Explicit non-claims

```text
K2/K3/K5/K6 packaging PASS ≠ pilot cutover executed
Step 29 gates documented ≠ gates satisfied at deploy time
booking_app test role ≠ production runtime role provisioned
Phase 51 PA ≠ payment live ≠ fake cutover
```
