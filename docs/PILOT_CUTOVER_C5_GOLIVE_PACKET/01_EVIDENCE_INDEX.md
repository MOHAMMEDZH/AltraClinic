# C5 — Evidence index (C0→C4)

| Slice | Tip SHA | Package | Result (honest) | Uncommitted evidence |
|-------|---------|---------|-----------------|----------------------|
| **C0** | `2d1158d` (package `b24a8e7`) | [`PILOT_CUTOVER_KICKOFF_PACKAGE/`](../PILOT_CUTOVER_KICKOFF_PACKAGE/) | **PASS** (docs) | — |
| **C1** | `54d9983` | [`PILOT_CUTOVER_C1_DB_ROLES/`](../PILOT_CUTOVER_C1_DB_ROLES/) | **PASS** (template; roles not claimed “in prod” until applied) | — |
| **C2** | `224229e` | [`PILOT_CUTOVER_C2_STAGING_MIGRATE/`](../PILOT_CUTOVER_C2_STAGING_MIGRATE/) | **PARTIAL** (local disposable) | `apps/api/.ci-evidence/pilot-c2-54d9983/` |
| **C2b** | `b7bbf3a` | [`PILOT_CUTOVER_C2B_NEON/`](../PILOT_CUTOVER_C2B_NEON/) | **PASS** (Neon migrate → RLS → isolation) | `apps/api/.ci-evidence/pilot-c2b-224229e/` |
| **C3** | `1b8b56e` | [`PILOT_CUTOVER_C3_BACKUP_RESTORE/`](../PILOT_CUTOVER_C3_BACKUP_RESTORE/) | **PARTIAL** (schema restore PASS; full-data dump blocked) | `apps/api/.ci-evidence/pilot-c3-b7bbf3a/` |
| **C4** | `5c5698e` (package `d394590`) | [`PILOT_CUTOVER_C4_K5_DRY_RUN/`](../PILOT_CUTOVER_C4_K5_DRY_RUN/) | **PARTIAL** (migrate status + obs + rollback rehearsal; health/CD SKIP) | `apps/api/.ci-evidence/pilot-c4-1b8b56e/` |
| **C5** | *(this tip)* | This packet | **PASS** (docs packaging) | — |

```text
Cite OK without committing .ci-evidence/
C2b Neon PASS · C3 schema restore PARTIAL · C4 dry-run PARTIAL
```
