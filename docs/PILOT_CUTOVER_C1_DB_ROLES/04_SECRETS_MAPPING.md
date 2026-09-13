# C1 — Secrets mapping (names only)

**Rule:** Document **secret names / slots**, never values. Aligns with [`../PILOT_CUTOVER_KICKOFF_PACKAGE/04_SECRETS_ENV_WIRING.md`](../PILOT_CUTOVER_KICKOFF_PACKAGE/04_SECRETS_ENV_WIRING.md) and K2.

| Consumer | Secret slot (suggested name) | Points at | Notes |
|----------|------------------------------|-----------|--------|
| **Migrate job** | `PILOT_DB_MIGRATE_URL` (or vault path `…/db/migrate`) | `{{MIGRATE_ROLE}}` connection string | Used for `db:migrate:deploy`, `db:rls:apply`, `db:triggers:apply` only |
| **API runtime** | `DATABASE_URL` (existing Nest key) | `{{RUNTIME_ROLE}}` connection string | **NOBYPASSRLS** role only — Nest default |
| **Backup / restore** | `PILOT_DB_BACKUP_URL` or tool-specific vault path | Often migrate-admin or dedicated backup role | K3 / Step 29 §9; encryption key = **ref** only (`BACKUP_RESTORE_ENCRYPTION_KEY_REF`) |
| **Break-glass master** | Cloud provider master secret | Instance superuser | **EXTERNAL** — not an app env key |

```text
DATABASE_URL (API) ≠ migrate URL
Rotate migrate and runtime independently
Do not commit connection strings with passwords
Test INTEGRATION_DATABASE_URL / booking_app ≠ pilot prod secrets
```
