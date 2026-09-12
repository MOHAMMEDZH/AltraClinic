# K3 — Production SoR Boundary

## Cutover / Production Hardening SoR (IN)

| Artifact | Role |
|----------|------|
| `apps/api/scripts/backup-postgres.sh` | Scheduled / pre-migrate **pg_dump** → `.sql.gz` + SHA256 |
| `apps/api/scripts/backup-postgres.ps1` | Windows host equivalent (requires `pg_dump` + `gzip` on PATH) |
| `apps/api/scripts/verify-backup.sh` | Integrity: checksum + `gzip -t` |
| `apps/api/scripts/restore-postgres.sh` | Restore gzipped dump into a **target** `DATABASE_URL` |
| `docs/DISASTER_RECOVERY.md` | Strategy pointers |
| Step 29 §8.1 | Cutover ownership: Database/Backup Operator + verify before migrate |

**Phase 49 Production Hardening treats the ops pg_dump path as the cutover backup/restore SoR.**

## Product precursor — NOT Phase 49 cutover SoR

| Artifact | Role |
|----------|------|
| `apps/api/src/modules/backup-restore/` | Phase 43 Backup & Restore Center |
| `BACKUP_RESTORE_CENTER_ENABLED` | **Default OFF** |
| Engines | In-memory / logical pipelines — **not** wired to live `pg_dump` scale |
| Docs PA | `docs/BACKUP_RESTORE_PRODUCTION_ACCEPTANCE.md` (product PA ≠ Phase 49 drill exit) |

```text
Do NOT enable Backup Center as the production backup engine in K3.
Do NOT rewrite Phase 43 Backup Center SoR.
```

## Why the split

1. Cutover gates (Step 29) already name `backup-postgres.*` / `verify-backup.sh`.
2. Backup Center remains a flag-gated product surface for in-app jobs/UI.
3. Mixing them without CTO amendment creates dual SoR confusion.

## Operator rule

```text
Pre-deploy / pre-migrate: run ops backup + verify (native scripts on ops host).
Phase 49 drill: disposable Postgres only (Docker test class).
Never restore over a shared non-disposable database.
```
