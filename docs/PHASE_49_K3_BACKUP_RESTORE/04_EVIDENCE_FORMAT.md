# K3 — Evidence Format

## Location (UNCOMMITTED)

```text
apps/api/.ci-evidence/phase49-k3-<shortsha>/
  00_SUMMARY.md          # PASS/FAIL honest; tip SHA; path A or B
  01_backup.log
  02_verify.log
  03_restore.log
  04_smoke.log
  05_cleanup.log         # optional
```

**Do not commit** `.ci-evidence` or backup artifacts containing tenant data.

## `00_SUMMARY.md` template

```markdown
# Phase 49 K3 restore drill

| Field | Value |
|-------|--------|
| Tip SHA | … |
| Result | PASS / FAIL |
| Path | A-native / B-docker-helper |
| Source DB | booking_test (disposable test) |
| Restore DB | booking_restore_k3_… |
| Backup artifact | backups/postgres/booking-system-….sql.gz (local; uncommitted) |
| Smoke | public_table_count=N |
| Notes | … |
```

## Redaction

- No production connection strings with real passwords in shared channels.
- Test credentials (`booking` / `booking_test` on localhost:5433) are fixture-only.
