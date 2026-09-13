# L4 — Runbook index for handoff (reuse)

**Purpose:** One index of existing runbooks for launch-day support/ops. **Do not rewrite** procedures here.

---

## Index

| Topic | Path |
|-------|------|
| Operator hub | [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md) |
| Incident SEV / first-15 / RM | [`PHASE_49_K7_INCIDENT_BASICS/`](../PHASE_49_K7_INCIDENT_BASICS/) |
| Class-specific security playbooks | [`SECURITY_RUNBOOKS.md`](../SECURITY_RUNBOOKS.md) |
| Cutover ownership (Form B) | [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md) §8 |
| Deploy / rollback | [`PHASE_49_K5_DEPLOY_ROLLBACK/`](../PHASE_49_K5_DEPLOY_ROLLBACK/) |
| Backup / restore | [`PHASE_49_K3_BACKUP_RESTORE/`](../PHASE_49_K3_BACKUP_RESTORE/) · [`DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md) |
| Observability / health | [`PHASE_49_K4_OBSERVABILITY_ALERTING/`](../PHASE_49_K4_OBSERVABILITY_ALERTING/) |
| Tenant isolation check | [`PHASE_49_K6_TENANT_ISOLATION/`](../PHASE_49_K6_TENANT_ISOLATION/) |
| Notification delivery | [`NOTIFICATION_DELIVERY_OPERATIONS.md`](../NOTIFICATION_DELIVERY_OPERATIONS.md) |
| Patient portal ops | [`PATIENT_PORTAL_OPS_RUNBOOKS.md`](../PATIENT_PORTAL_OPS_RUNBOOKS.md) |
| Operations Console | [`OPERATIONS_CONSOLE_RUNBOOKS.md`](../OPERATIONS_CONSOLE_RUNBOOKS.md) · [`OPERATIONS_CONSOLE.md`](../OPERATIONS_CONSOLE.md) |
| Production migrations | [`PRODUCTION_MIGRATION_WORKFLOW.md`](../PRODUCTION_MIGRATION_WORKFLOW.md) |
| Go-live checklist (one tenant) | [`PHASE_51_L3_GOLIVE_CHECKLIST/`](../PHASE_51_L3_GOLIVE_CHECKLIST/) |
| Pricing / packaging (explain only) | [`PHASE_51_L2_PRICING_PACKAGING/`](../PHASE_51_L2_PRICING_PACKAGING/) |

---

## EXTERNAL (point only — not in-repo)

| Concern | Note |
|---------|------|
| PagerDuty / Opsgenie / phone tree | K7 external interface |
| Jira / ServiceNow tickets | K7 external interface |
| D-17 deploy topology / CD | Step 29 / K5 — deployment-owned |
| Offsite backup / PITR | K3 external boundaries |
| APM / SIEM | K4 OUT |
