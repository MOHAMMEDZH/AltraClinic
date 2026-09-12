# Disaster Recovery Strategy — Enterprise Healthcare SaaS Platform

Last updated: 2026-09-12 (Phase 50 D2 — day-2 path clarified)

## Purpose

This document defines disaster recovery objectives, backup strategy, recovery procedures, failover mechanisms, and data retention policies for the platform. It provides a robust enterprise-grade approach and identifies potential weaknesses with better alternatives.

## Day-2 operator path (cutover SoR) — start here

**Authoritative cutover backup/restore for Production Hardening** is Phase 49 K3 + ops `pg_dump` scripts — **not** the aspirational weekly/monthly/PITR sections below as in-repo procedure.

| Step | Action | Path |
|------|--------|------|
| 1 | Read SoR boundary (cutover vs Backup Center flag-OFF) | `docs/PHASE_49_K3_BACKUP_RESTORE/01_SOR_BOUNDARY.md` |
| 2 | Pre-deploy backup | `apps/api/scripts/backup-postgres.sh` or `.ps1` |
| 3 | Verify | `apps/api/scripts/verify-backup.sh` |
| 4 | Restore (RM authorize) | `apps/api/scripts/restore-postgres.sh` + K3 drill procedure |
| 5 | Cutover ownership | `docs/RELEASE_47_STEP29_RELEASE_READINESS.md` §8.1 / §9 |
| 6 | Incident SEV / RM | `docs/PHASE_49_K7_INCIDENT_BASICS/` · `docs/SECURITY_RUNBOOKS.md` |

```text
Offsite replication / PITR / multi-region RTO-RPO = EXTERNAL (deployment-owned)
In-repo claim of configured PITR = NO unless cutover evidence proves it
Operator hub = docs/OPERATOR_INDEX.md
```

## Objectives

- Protect clinical, financial, and patient data from loss and corruption.
- Ensure recovery times and recovery point objectives meet enterprise SLAs.
- Maintain high availability and failover readiness across tenant and regional deployments.
- Preserve data for compliance and audit requirements.
- Provide repeatable recovery procedures and verified runbooks.

## Backup Strategy

Operational scripts (see `apps/api/scripts/`):

- **Daily:** `backup-postgres.sh` or `backup-postgres.ps1` — gzip SQL dump + SHA256 checksum, configurable retention
- **Verify:** `verify-backup.sh` — checksum + gzip integrity
- **Restore:** `restore-postgres.sh` — restores from verified backup into `DATABASE_URL`

### Daily Backups

- Perform daily full or incremental backups of transactional databases and critical configuration data.
- Include application metadata, tenant configuration, security policies, and user account data.
- Store daily backups in a secure, geographically separate location.
- Validate backup integrity automatically and monitor backup successes/failures.

### Weekly Backups

- Perform weekly full backups of the entire platform data estate, including databases, file stores, and analytics snapshots.
- Retain weekly backups for a longer period than daily backups to support deeper recovery windows.
- Use a different storage tier or location to protect against region-level failures.
- Ensure weekly backups are discoverable and documented.

### Monthly Backups

- Perform monthly archive backups for long-term retention and compliance.
- Keep monthly backups in cold or archive storage optimized for cost, while preserving accessibility for audited recovery.
- Maintain a minimum of 12 monthly retention points, or longer if regulatory requirements demand.
- Document archive backup retention schedules and access procedures.

### Point-In-Time Recovery (PITR)

- **EXTERNAL / deployment-owned** for production (Step 29 cutover gate; Phase 49 K3 OUT).
- Enable point-in-time recovery for primary transactional databases **when ops configures it outside the repo**.
- Retain WAL/transaction log history for a configurable window that aligns with business recovery objectives.
- Do **not** treat this subsection as an in-repo runnable procedure — confirm at cutover or obtain Release Manager waiver.

## Recovery Procedures

### Recovery planning

- Maintain documented recovery runbooks for different scenarios: data corruption, ransomware, region outage, full system failure.
- Define recovery team roles, responsibilities, and communication channels.
- Establish a recovery command center and incident response coordination.

### Recovery steps

- Detect and classify the disaster event quickly.
- Notify stakeholders and activate recovery procedures.
- Identify the latest safe restore point: daily, weekly, monthly, or PITR timestamp.
- Restore data to a recovery environment or standby cluster.
- Validate data integrity, application behavior, and tenant isolation before failback.
- Execute cutover once the recovery environment passes validation.

### Recovery validation

- Use automated recovery drills to verify procedures and timings regularly.
- Validate key customer workflows after restore, such as patient profile access, appointment scheduling, billing, and offline sync.
- Confirm audit logs and compliance data are intact.
- Document recovery lessons and update runbooks.

## Failover

### Failover capabilities

- Employ active/passive or active/active failover patterns depending on tenant SLA and deployment model.
- Use health checks and automated failover orchestration for critical services.
- Ensure failover preserves tenant routing, security context, and data consistency.
- Provide manual failover options for severe incidents or controlled migration.

### Failover design

- Separate control plane and data plane failover logic from application runtime.
- Use DNS, load balancers, and service discovery to redirect traffic to healthy regions.
- Keep standby systems warmed and synchronized with primary data as needed.
- Ensure offline-first clients can reconnect to a fallback endpoint when regional failover occurs.

### Weaknesses and alternatives

- Weakness: full active/active failover is expensive and complex.
  - Alternative: use active/passive with warm standby and targeted failover for critical tenants.
- Weakness: DNS-based failover can be slow due to caching.
  - Alternative: use health-based routing with low TTLs and application-level failover detection.

## Data Retention

### Retention guidance

- Define retention policies by data category: transactional data, audit logs, backups, and analytics data.
- Preserve patient and clinical data according to regulatory and contractual retention requirements.
- Retain compliance artifacts and audit logs for the required period, even if primary data is purged.
- Keep backups and PITR data long enough to support legal discovery and business continuity requirements.

### Retention policy examples

- Daily backups: retain for 30 days.
- Weekly backups: retain for 90 days.
- Monthly backups: retain for 12–24 months, or longer if required.
- PITR logs: retain for 7–30 days depending on recovery needs.
- Audit logs: retain for 1–7 years based on regulatory requirements.

### Weaknesses and alternatives

- Weakness: retention schedules may conflict with storage cost constraints.
  - Alternative: tier backup data to colder storage and automate lifecycle policies.
- Weakness: retaining too little PITR history reduces recovery flexibility.
  - Alternative: tier PITR retention based on tenant criticality and risk profile.

## Competing-Team Critique

### Backup scope and cost

- Weakness: backing up everything daily can be costly and inefficient.
  - Alternative: combine incremental daily backups with less frequent full backups to reduce storage while preserving recovery windows.

### Recovery complexity

- Weakness: assuming recovery is a single automated process ignores human decision points.
  - Alternative: design recovery steps as modular phases with clear handoffs and decision criteria.

### Failover assumptions

- Weakness: failover designs often underestimate data sync and consistency risks.
  - Alternative: validate data consistency regularly and consider read-only failover modes as safer interim options.

### Retention vs compliance

- Weakness: retention policies may be too generic for diverse tenant needs.
  - Alternative: support tenant-specific retention profiles driven by contractual or regulatory requirements.

## Recommended Disaster Recovery Approach

- Use a layered backup strategy: daily incremental, weekly full, monthly archive, and PITR for rapid recovery.
- Maintain documented, practiced recovery procedures for multiple scenarios.
- Use active/passive failover for platform-level disaster recovery, with active/active reserved for premium or critical tenant deployments.
- Apply tenant-aware retention policies and ensure backup data is protected and auditable.
- Continuously test recovery processes and refine them based on drills and real incidents.

## Conclusion

A world-class disaster recovery strategy for this healthcare platform must balance resilient backup cadence, fast recovery procedures, and cost-effective failover. The best approach is a layered backup model, tenant-aware retention, validated recovery runbooks, and failover mechanisms that prioritize both data integrity and operational continuity. The strongest alternative is to avoid overly broad automation and ensure recovery relies on repeatable, tested steps with clear decision points.
