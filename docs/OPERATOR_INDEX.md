# Operator Index (day-2 hub)

**Purpose:** Single front door for operators on the accepted Release 47 + Phase 48 + Phase 49 lineage.  
**Lineage:** Phase 49 PA **ACCEPTED** by CTO @ evidence tip `5bfda08` / merge `1501190`.  
**Maintainer note:** Phase 50 D2 docs polish — not a new ops product.

---

## Start here by task

| Task | Go to |
|------|--------|
| Deploy / rollback | [`PHASE_49_K5_DEPLOY_ROLLBACK/`](./PHASE_49_K5_DEPLOY_ROLLBACK/) (`01_DEPLOY_RUNBOOK.md`, `02_ROLLBACK_RUNBOOK.md`) |
| Backup / restore drill (cutover SoR) | [`PHASE_49_K3_BACKUP_RESTORE/`](./PHASE_49_K3_BACKUP_RESTORE/) |
| Health / observability readiness | [`PHASE_49_K4_OBSERVABILITY_ALERTING/`](./PHASE_49_K4_OBSERVABILITY_ALERTING/) |
| Tenant isolation production-check | [`PHASE_49_K6_TENANT_ISOLATION/`](./PHASE_49_K6_TENANT_ISOLATION/) |
| Incident SEV / first 15 / RM | [`PHASE_49_K7_INCIDENT_BASICS/`](./PHASE_49_K7_INCIDENT_BASICS/) + [`SECURITY_RUNBOOKS.md`](./SECURITY_RUNBOOKS.md) |
| Cutover gates / ownership | [`RELEASE_47_STEP29_RELEASE_READINESS.md`](./RELEASE_47_STEP29_RELEASE_READINESS.md) §§7–14 |
| Secrets / config hygiene packaging | [`PHASE_49_K2_SECRETS_CONFIG/`](./PHASE_49_K2_SECRETS_CONFIG/) |
| Pricing / packaging (what we sell) | [`PHASE_51_L2_PRICING_PACKAGING/`](./PHASE_51_L2_PRICING_PACKAGING/) |
| Tenant go-live checklist | [`PHASE_51_L3_GOLIVE_CHECKLIST/`](./PHASE_51_L3_GOLIVE_CHECKLIST/) |
| Support / ops launch handoff | [`PHASE_51_L4_SUPPORT_OPS_HANDOFF/`](./PHASE_51_L4_SUPPORT_OPS_HANDOFF/) |
| Legal / commercial boundaries | [`PHASE_51_L5_LEGAL_COMMERCIAL_BOUNDARIES/`](./PHASE_51_L5_LEGAL_COMMERCIAL_BOUNDARIES/) |
| Launch smoke evidence format | [`PHASE_51_L6_LAUNCH_SMOKE/`](./PHASE_51_L6_LAUNCH_SMOKE/) |
| Deferred register / Phase 51 review | [`PHASE_51_DEFERRED_REGISTER/`](./PHASE_51_DEFERRED_REGISTER/) · [`PHASE_51_IMPLEMENTATION_REVIEW_PACKAGE/`](./PHASE_51_IMPLEMENTATION_REVIEW_PACKAGE/) |

---

## Phase 49 packages (K2–K7 + review)

| Package | Path |
|---------|------|
| Kickoff | [`PHASE_49_KICKOFF_PACKAGE/`](./PHASE_49_KICKOFF_PACKAGE/) |
| K1 Discovery | [`PHASE_49_K1_DISCOVERY_INVENTORY/`](./PHASE_49_K1_DISCOVERY_INVENTORY/) |
| K2 Secrets | [`PHASE_49_K2_SECRETS_CONFIG/`](./PHASE_49_K2_SECRETS_CONFIG/) |
| K3 Backup/Restore | [`PHASE_49_K3_BACKUP_RESTORE/`](./PHASE_49_K3_BACKUP_RESTORE/) |
| K4 Observability | [`PHASE_49_K4_OBSERVABILITY_ALERTING/`](./PHASE_49_K4_OBSERVABILITY_ALERTING/) |
| K5 Deploy/Rollback (+ source index) | [`PHASE_49_K5_DEPLOY_ROLLBACK/`](./PHASE_49_K5_DEPLOY_ROLLBACK/) · [`03_SOURCE_INDEX.md`](./PHASE_49_K5_DEPLOY_ROLLBACK/03_SOURCE_INDEX.md) |
| K6 Tenant isolation | [`PHASE_49_K6_TENANT_ISOLATION/`](./PHASE_49_K6_TENANT_ISOLATION/) |
| K7 Incident basics | [`PHASE_49_K7_INCIDENT_BASICS/`](./PHASE_49_K7_INCIDENT_BASICS/) |
| Implementation review / PA precheck | [`PHASE_49_IMPLEMENTATION_REVIEW_PACKAGE/`](./PHASE_49_IMPLEMENTATION_REVIEW_PACKAGE/) |

```text
Phase 49 Production Acceptance = ACCEPTED (CTO @ 5bfda08; merge 1501190)
self-granted Phase 49 PA = NO (CTO-granted)
```

---

## Core runbooks (pre–Phase 49)

| Topic | Path |
|-------|------|
| Security class playbooks | [`SECURITY_RUNBOOKS.md`](./SECURITY_RUNBOOKS.md) |
| Disaster recovery (strategy + day-2 pointer) | [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) |
| Production migrations | [`PRODUCTION_MIGRATION_WORKFLOW.md`](./PRODUCTION_MIGRATION_WORKFLOW.md) |
| Operations Console | [`OPERATIONS_CONSOLE_RUNBOOKS.md`](./OPERATIONS_CONSOLE_RUNBOOKS.md) · [`OPERATIONS_CONSOLE.md`](./OPERATIONS_CONSOLE.md) |
| Patient portal ops | [`PATIENT_PORTAL_OPS_RUNBOOKS.md`](./PATIENT_PORTAL_OPS_RUNBOOKS.md) |
| Notification delivery ops | [`NOTIFICATION_DELIVERY_OPERATIONS.md`](./NOTIFICATION_DELIVERY_OPERATIONS.md) |
| Observability precursors | [`SYSTEM_MONITORING_OBSERVABILITY_TRACING_AND_HEALTH.md`](./SYSTEM_MONITORING_OBSERVABILITY_TRACING_AND_HEALTH.md) |

---

## Phase 50 (Docs and UX Polish)

| Package | Path |
|---------|------|
| Kickoff (D0) | [`PHASE_50_KICKOFF_PACKAGE/`](./PHASE_50_KICKOFF_PACKAGE/) |
| D1 Discovery | [`PHASE_50_D1_DISCOVERY_INVENTORY/`](./PHASE_50_D1_DISCOVERY_INVENTORY/) |
| Review / PA | [`PHASE_50_IMPLEMENTATION_REVIEW_PACKAGE/`](./PHASE_50_IMPLEMENTATION_REVIEW_PACKAGE/) |

```text
Phase 50 Production Acceptance = ACCEPTED (CTO @ 2d1f3ec; merge 9a2e89d)
D5 AppointmentForm clinical-catalog picker = DEFERRED (CTO)
```

---

## Phase 51 (Commercial Launch)

| Package | Path |
|---------|------|
| Kickoff (L0) | [`PHASE_51_KICKOFF_PACKAGE/`](./PHASE_51_KICKOFF_PACKAGE/) |
| L1 Discovery | [`PHASE_51_L1_DISCOVERY_INVENTORY/`](./PHASE_51_L1_DISCOVERY_INVENTORY/) |
| L2 Pricing / packaging clarity | [`PHASE_51_L2_PRICING_PACKAGING/`](./PHASE_51_L2_PRICING_PACKAGING/) |
| L3 Tenant go-live checklist | [`PHASE_51_L3_GOLIVE_CHECKLIST/`](./PHASE_51_L3_GOLIVE_CHECKLIST/) |
| L4 Support / ops launch handoff | [`PHASE_51_L4_SUPPORT_OPS_HANDOFF/`](./PHASE_51_L4_SUPPORT_OPS_HANDOFF/) |
| L5 Legal / commercial boundaries | [`PHASE_51_L5_LEGAL_COMMERCIAL_BOUNDARIES/`](./PHASE_51_L5_LEGAL_COMMERCIAL_BOUNDARIES/) |
| L6 Launch smoke evidence | [`PHASE_51_L6_LAUNCH_SMOKE/`](./PHASE_51_L6_LAUNCH_SMOKE/) |
| Deferred register | [`PHASE_51_DEFERRED_REGISTER/`](./PHASE_51_DEFERRED_REGISTER/) |
| L7 Review / PA precheck | [`PHASE_51_IMPLEMENTATION_REVIEW_PACKAGE/`](./PHASE_51_IMPLEMENTATION_REVIEW_PACKAGE/) |

```text
Phase 51 Production Acceptance = ACCEPTED (CTO @ 67a6391)
L7 packaging = delivered (PA CTO-granted; not self-grant)
Stripe / payment live = NOT CLAIMED
Go-live checklist ≠ executed cutover evidence
Paging / SOC SaaS / D-17 / PITR = EXTERNAL
ToS / privacy policy in docs/ = MISSING (honest)
D5 AppointmentForm catalog picker = DEFERRED
Documented deferred items do NOT block Phase 51 PA
Green launch smoke ≠ payment live ≠ cutover
PR merge = wait for CTO authorize
```

---

## Explicit non-goals of this index

- Not a deploy engine / CD pipeline  
- Not Production Acceptance for Phase 51  
- Topology (D-17), offsite/PITR, paging SaaS remain **EXTERNAL** (see Phase 49 packages)  
- Not a billing/payment engine
