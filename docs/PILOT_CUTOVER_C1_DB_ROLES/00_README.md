# Pilot Cutover C1 — Production DB roles (template + runbook)

CTO-authorized **C1 only**. Docs + parameterized SQL template.  
**Roles are not claimed to exist in production.** No cloud provision. No secrets in git.

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) — NOT Phase 52 |
| **Lineage** | C0 tip `2d1158d` · base merge `64eb2a9` |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **Status** | C1 packaging — roles **not** provisioned by this slice |

| File | Purpose |
|------|---------|
| [01_ROLE_RUNBOOK.md](./01_ROLE_RUNBOOK.md) | Create / rotate / break-glass |
| [02_CREATE_PROD_DB_ROLES.sql.template](./02_CREATE_PROD_DB_ROLES.sql.template) | Parameterized bootstrap SQL |
| [03_VERIFY_QUERIES.sql](./03_VERIFY_QUERIES.sql) | Prove `rolbypassrls=false` + memberships |
| [04_SECRETS_MAPPING.md](./04_SECRETS_MAPPING.md) | Migrate job vs API vs backup secret names |
| [05_EXPLICIT_OUT.md](./05_EXPLICIT_OUT.md) | Cloud create, vault, cutover, fake PASS |

**Aligns with:**

- [`PILOT_CUTOVER_KICKOFF_PACKAGE/03_DB_CREDENTIAL_MODEL.md`](../PILOT_CUTOVER_KICKOFF_PACKAGE/03_DB_CREDENTIAL_MODEL.md)
- Pattern only: `docker/postgres-test-init/01-app-role.sql` (`booking_app` NOBYPASSRLS)
- Pointers: [`PRODUCTION_MIGRATION_WORKFLOW.md`](../PRODUCTION_MIGRATION_WORKFLOW.md), [`MIGRATION_STRATEGY.md`](../MIGRATION_STRATEGY.md) — do not rewrite those SoRs

```text
C1 = template + runbook only
roles exist in production = NOT CLAIMED
no passwords / .env in git = YES
cutover executed = NO
self-granted Pilot Cutover PA = NO
C2+ = NOT STARTED
```
