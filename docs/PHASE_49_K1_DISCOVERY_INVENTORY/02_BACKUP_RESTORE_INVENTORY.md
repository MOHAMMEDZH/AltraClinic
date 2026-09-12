# K1 — Backup / Restore Inventory

**Lineage:** `9eac595+` · **Owner (cutover):** Database/Backup Operator → Release Manager (`docs/RELEASE_47_STEP29_RELEASE_READINESS.md` §8.1)  
**Phase 49 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths / evidence | Status |
|------|------------------|--------|
| Ops backup scripts | `apps/api/scripts/backup-postgres.sh`, `backup-postgres.ps1`, `verify-backup.sh`; restore via `restore-postgres.sh` (referenced in `docs/DISASTER_RECOVERY.md`) | **PASS-local** |
| DR strategy doc | `docs/DISASTER_RECOVERY.md` | **PARTIAL** (strategy + script pointers; RTO/RPO / offsite / PITR external) |
| Historical drill report | `docs/BACKUP_RESTORE_DRILL_REPORT.md` (2026-07-11, Docker test PG) | **PARTIAL** (dated precursor; not Phase 49 quarterly drill on `9eac595`) |
| Backup & Restore Center (Phase 43) | `docs/BACKUP_RESTORE_*.md` (foundation, engines, ops UI, PA); module `apps/api/src/modules/backup-restore/` | **PASS-local** as product center; flag-gated (`BACKUP_RESTORE_CENTER_ENABLED` default OFF) |
| Backup Center PA | `docs/BACKUP_RESTORE_PRODUCTION_ACCEPTANCE.md` (43g) | **PASS-local** (product PA ≠ Phase 49 restore-drill exit) |
| Health contributor | `GET /backup-restore/health` (docs + module) | **PASS-local** |
| Step 29 cutover backup gates | `docs/RELEASE_47_STEP29_RELEASE_READINESS.md` §§8.1, backup tooling static checks | **PARTIAL** (gates defined; production cutover still pending execution) |
| Phase 48 migration clean/upgrade | `test:phase48-migration-clean`, `test:phase48-migration-upgrade` | **PASS-local** (schema validators ≠ DB backup/restore) |
| Offsite / PITR / multi-region DR | External per Step 29 | **MISSING** in-repo (expected external) |
| Phase 49 restore-drill evidence on tip | — | **MISSING** |

---

## Evidence pointers

```text
docs/DISASTER_RECOVERY.md
docs/BACKUP_RESTORE_DRILL_REPORT.md
docs/BACKUP_RESTORE_CENTER_ARCHITECTURE.md
docs/BACKUP_RESTORE_PRODUCTION_ACCEPTANCE.md
apps/api/scripts/backup-postgres.*
apps/api/scripts/verify-backup.sh
apps/api/src/modules/backup-restore/
```

---

## Gaps (for K3)

1. No Phase 49–scoped restore drill executed/recorded against `9eac595+` lineage.
2. Product Backup Center (flag OFF) vs ops `pg_dump` scripts — dual paths need clarity in hardening SSOT (which is production SoR for cutover).
3. PITR / offsite / RTO-RPO remain external; Phase 49 must document acceptance boundary without inventing SaaS backup product.
4. Windows PATH / client-tool gap noted in old drill report still relevant for ops hosts.
