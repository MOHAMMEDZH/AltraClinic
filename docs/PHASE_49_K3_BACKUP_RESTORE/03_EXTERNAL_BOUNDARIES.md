# K3 — External Boundaries (OUT / deployment-owned)

| Topic | Phase 49 K3 stance |
|-------|--------------------|
| Offsite / geo-redundant backup storage | **External / deployment-owned** — document that ops must copy `.sql.gz` + `.sha256` off-host; not automated in K3 |
| PITR / WAL archiving | **OUT** — not invented in K3 |
| Multi-region DR / commercial backup SaaS | **OUT** |
| Formal RTO/RPO SLAs | Documented as **ops-owned** in `docs/DISASTER_RECOVERY.md` / Step 29; K3 does not redefine numbers |
| Enabling Backup Center for production dumps | **OUT** |

```text
K3 proves disposable restore drill readiness for the ops pg_dump path.
K3 does not claim enterprise DR completion or production cutover.
```
