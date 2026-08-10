# Phase 43 — Architecture Discovery and Readiness Report

**Document type:** Architecture discovery & readiness (planning only)  
**Date:** 2026-07-18  
**Authoring posture:** Independent architecture review against repository SSOT  
**Release 42.0 status:** **COMPLETE · FROZEN · tagged `v42.0.0`**  
**Development branch:** `release/43`  
**Phase 43 implementation:** **NOT AUTHORIZED** until Architecture SSOT owner approval

| Constraint | Status |
|------------|--------|
| Production / application code changed | **No** |
| Migrations created | **No** |
| APIs / UI / modules modified | **No** |
| Architecture redesign of Phases 28–42 | **No** |
| Implementation performed | **No** |

**Companion Architecture SSOT (proposed):** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)

---

## 1. Executive Summary

After Release **42.0** (Import/Export Center), the Dynamic Platform roadmap permanently numbers **Phase 43** as **Backup & Restore**. That numbering is consistent across Import/Export Architecture, Phase 42 discovery, and the Current System Audit.

Existing foundation is **ops scripts + DR docs only** (~5%): `backup-postgres.*`, `verify-backup.sh`, `restore-postgres.sh`, `DISASTER_RECOVERY.md`, and a one-time Docker drill. There is **no** platform Backup Center, job engine, tenant-aware artifact model, encrypted off-host retention, scheduled platform jobs, restore orchestration UI, or production enablement gates comparable to Phase 41/42.

**Discovery verdict:** The next major ERP capability should be an **Enterprise Backup & Restore Center** — a licensed, RBAC-gated, audited control plane for scheduled and on-demand backups, integrity verification, retention, and controlled restore drills — consuming existing Scheduler, Media/storage ports, Notification Intent producer, Activity, Audit, Health, and Feature Flags **without** redesigning Import/Export Runtime, Notification Delivery, Journey execution, or domain SoRs.

**Explicit recommendation:** **READY FOR ARCHITECTURE REVIEW**  
**Implementation:** blocked until owner approval of [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)

---

## 2. Release Baseline Verification

| Check | Result |
|-------|--------|
| Release 42.0 docs frozen | [`RELEASE_42.0.md`](./RELEASE_42.0.md) — freeze date **2026-07-18** |
| Annotated tag `v42.0.0` | **Created** (workspace previously lacked `.git`; repository initialized, baseline committed, tag applied) |
| Development branch | **`release/43`** checked out from tagged baseline |
| Phase 41 / 42 code changes in this phase | **None** |

**Owner note (OD-GIT-1):** Canonical remote history may need reconciliation if a prior remote repository exists outside this workspace. Local baseline SHA and tag are the Phase 43 starting point in this environment.

---

## 3. Current Platform Assessment

| Platform / Capability | Status | Evidence | Notes |
|----------------------|--------|----------|-------|
| Authentication | **Completed** (mature) | `auth` module, MFA, JWT | Consume |
| Authorization / RBAC | **Completed** (mature) | Permission matrix + guards | Consume; gaps on decoration remain residual debt |
| Licensing / Subscription | **Completed** | Phase 28 closed | Consume |
| Tenant Platform | **Partial** | App-level isolation; RLS unwired | Consume; do not redesign |
| Notification Platform | **Completed · FROZEN** | Phase 41a–41e | Consume Intent producer only |
| Activity Platform | **Completed · FROZEN** | Phase 38 | Observe |
| Audit Platform | **Completed · FROZEN** | Phase 39 | Prove |
| Configuration / Settings | **Completed** | Settings center | Consume |
| Feature Flags | **Completed** | Env + settings patterns | Consume |
| Health | **Partial → strong for hubs** | Platform + IE health | Extend probe pattern |
| Scheduler | **Completed** | Background schedulers | Consume |
| Media Platform | **Completed** | Storage + virus scan ports | Reuse ports for backup blobs where appropriate |
| Import/Export Center | **Completed · FROZEN** | Release 42.0 | Distinct from DR dumps; do not redesign |
| Workflow | **Partial / config closed** | Module + Phase 40 journey | Not Phase 43 SoR |
| Patients / Appointments / Inventory / Billing | **Partial–strong domain** | Domain modules | Remain SoRs |
| Reporting / Analytics | **Completed** (Dynamic 33/34) | Catalog platforms | Consume for DR reports later |
| Messaging | **Completed** via Notification Center | Phase 41 | Consume |
| Backup & Restore | **Missing** (scripts only) | DR docs + scripts + drill | **Selected Phase 43** |
| API Keys & Integrations | **Partial** | Settings developer keys | Candidate Phase 44 |
| System Monitoring / APM | **Partial / Missing** | Logs partial | Candidate after/with DR |
| Patient Portal | **Partial** | Backend slice | Product surface, not next platform spine |
| Marketplace / Plugin SDK | **Future** | Schema readiness only | Later |
| Department / Franchise (37) | **Reserved · Missing** | Multi-Branch §23 | Reserved; not next after 42 |

---

## 4. Capability Gap Analysis

Candidates evaluated (examples from brief + repository roadmap). **Do not treat listing as requirement.**

| Candidate | Gap severity | Why considered |
|-----------|--------------|----------------|
| **Backup & Restore Center** | **Critical** | Audit gap #16 High; production prerequisite; numbered Phase 43 |
| System Monitoring / Observability Hub | High | Ops maturity; partial logs only |
| Department / Franchise Hardening (37) | Medium–High | Reserved; multi-org clinics |
| API Keys & Integrations Hub | Medium | Partial keys; OAuth/scopes missing |
| Marketplace / Plugin SDK Runtime | Medium | Strategic; high complexity |
| Document Management | Medium | Overlaps Media; clinical DMS incomplete |
| Patient Portal completion | Medium | Product growth; auth model open |
| Super Admin console | Medium | Platform-admin API only |
| Advanced BI / Warehouse | Medium | Reporting/Analytics exist |
| Public Developer API Gateway | Medium | Overlaps keys/integrations |
| Clinical Forms Engine | Medium | EMR partial |
| CRM / Lead Management | Low–Medium | Journey covers lifecycle orchestration |
| Accounting (GL) beyond Billing | Low–Medium | Billing SoR exists |
| Task Management Hub | Low | Workflow/journey cover much |
| AI / ML Platform expansion | Low–Medium | AI module exists; not production blocker |
| Mobile Platform | Low | Future client |
| Workflow Engine redesign | Low | Forbidden pattern; 40d optional only |
| Rules / Automation Engine (generic) | Low | Journey + workflow suffice near-term |
| External HIE/FHIR mesh | Deferred | Explicit future scope |

---

## 5. Ranked Capability Candidates

Scoring (1–5). **Total** = weighted blend favoring Business + Operational + Roadmap Fit + inverse Complexity/Risk.

| Rank | Capability | Biz | Tech | Ops | Complex↓ | Risk↓ | Roadmap | Maint↓ | Scale | Support | **Why** |
|------|------------|-----|------|-----|----------|-------|---------|--------|-------|---------|--------|
| **1** | **Backup & Restore** | 5 | 4 | 5 | 3 | 3 | 5 | 3 | 4 | 4 | Permanent Phase **43**; production data-loss risk; scripts exist but no platform |
| 2 | System Monitoring | 4 | 4 | 5 | 3 | 2 | 4 | 3 | 4 | 4 | Strong ops value; can follow DR or run as 43 companion later |
| 3 | API Keys & Integrations | 4 | 4 | 3 | 3 | 3 | 4 | 3 | 4 | 3 | Numbered ~44; partial foundation |
| 4 | Department / Franchise (37) | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 4 | 3 | Reserved; high design cost; not post-42 numbering |
| 5 | Marketplace Runtime | 3 | 5 | 3 | 5 | 4 | 3 | 4 | 5 | 3 | Strategic; premature before DR/prod spine |
| 6 | Patient Portal | 4 | 3 | 2 | 4 | 3 | 3 | 3 | 3 | 3 | Product; not platform enablement |
| 7 | Document Management | 3 | 3 | 3 | 4 | 3 | 2 | 3 | 3 | 3 | Media covers much |
| 8 | Super Admin App | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | Platform-admin API exists |
| 9 | Advanced BI | 3 | 3 | 2 | 4 | 2 | 2 | 3 | 4 | 3 | Analytics/Reporting closed |
| 10 | AI Platform expansion | 3 | 4 | 2 | 4 | 4 | 2 | 4 | 3 | 2 | Compliance sensitivity |
| 11–N | CRM / Accounting GL / Mobile / HIE | ≤3 | — | — | — | — | — | — | — | — | Lower near-term ERP spine value |

---

## 6. Dependency Analysis (Top Candidates)

### 6.1 Backup & Restore (recommended)

| Dimension | Assessment |
|-----------|------------|
| Consumed Platforms | Scheduler, Background workers/queues, Health, Feature Flags, RBAC, Licensing, Audit, Activity, Notification Intent, Config/Settings, Media storage port patterns, Logging/metrics |
| New Infrastructure | Backup job store, artifact registry, off-host object storage (or durable volume), encryption-at-rest keys, optional WAL/PITR integration |
| Shared Services | Correlation IDs, tenant context, virus scan **not** primary (egress dumps); checksum verify |
| Cross-Cutting | PHI in backups → encryption, access audit, retention, break-glass restore |
| Security Impact | **High** — backups are concentrated PHI/PII; restore is high-privilege |
| Licensing Impact | Likely plan feature `allowBackupRestore` / SKU tier |
| RBAC Impact | New permissions: backup.run, backup.download, restore.execute, restore.drill |
| Feature Flags | `BACKUP_RESTORE_CENTER_ENABLED=false` by default |
| Operational Impact | Cron schedules, retention workers, restore drills, alerting on failure |
| Deployment Impact | Storage credentials, KMS/key config, worker enablement |
| Migration Impact | New tables for jobs/artifacts/policies; no domain SoR migration |

### 6.2 System Monitoring

Consumes Health + logs; needs APM/metrics store; lower security blast radius than restore; does not close audit gap #16 alone.

### 6.3 API Keys & Integrations

Consumes Settings; needs hashing, scopes, rotation; complements but does not replace DR.

---

## 7. Business Value Assessment (Selected)

| Criterion | Backup & Restore Center |
|-----------|-------------------------|
| Business Value | Enables production trust, customer contracts, compliance continuity |
| Technical Value | Unifies scripts into governed platform jobs; testable RTO/RPO |
| Operational Value | Scheduled verify, alerts, drill cadence, runbook automation hooks |
| Implementation Complexity | Medium — storage/encryption/RBAC harder than CRUD; reuse IE job patterns carefully **without copying IE runtime** |
| Risk | Medium — restore misuse; encryption key loss; storage cost |
| Long-Term Roadmap | Unlocks safer Phase 42 enablement + marketplace/tenant ops later |
| Maintenance Cost | Medium — retention, drills, storage lifecycle |
| Scalability | Object storage + per-tenant policies scale better than local dumps |
| Supportability | Clear job IDs, checksums, audit trails reduce incident MTTR |

---

## 8–11. Architecture / Integration / Runtime / Security / Ops

**Authoritative proposed design:** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)

Summary:

- **Purpose:** Governed backup, verify, retain, restore-drill, and controlled restore.
- **Non-goals:** Not Import/Export SoR; not Notification delivery; not full multi-region active/active HA product in v1.
- **Runtime:** Dedicated queue `backup-restore`; schedulers for policy runs; workers for dump/upload/verify/cleanup; restore orchestration with dual-control.
- **Integrations:** Consume Notification/Activity/Audit/RBAC/Licensing/Flags/Scheduler/Media ports/Health — **no redesign**.
- **Security:** Fail-closed; encrypted artifacts; least privilege; every access audited.
- **Ops:** Health gates; monitoring checklist; DR runbook evolution from `DISASTER_RECOVERY.md`.

---

## 12. Implementation Roadmap (proposed phases)

| Phase | Purpose | Gate |
|-------|---------|------|
| **43a** | Foundation: contracts, catalog, flag, permissions, health stub, static catalog | Architecture approved |
| **43b** | Job engine + policies + scheduler registration | 43a closed |
| **43c** | Backup runtime adapters (Postgres primary; media/files secondary) | 43b closed |
| **43d** | Verify + retention + artifact storage | 43c closed |
| **43e** | Restore drill + controlled restore orchestration | 43d closed |
| **43f** | Operations UI | 43e closed |
| **43g** | Production acceptance + enablement gates | 43f closed |

Details and acceptance criteria: Architecture SSOT § Implementation Roadmap.

---

## 13. Risk Register (summary)

| ID | Category | Risk | Mitigation |
|----|----------|------|------------|
| R1 | Security | Backup exfiltration | Encrypt, short-lived download tokens, RBAC, Audit |
| R2 | Security | Unauthorized restore | Dual-control, environment allow-list, drill vs prod modes |
| R3 | Operational | Silent backup failure | Alerts + health + Notification intents |
| R4 | Performance | Backup load on primary DB | Off-peak windows, throttling, read-replica option (OD) |
| R5 | Migration | Script dual-path confusion | Compatibility period; scripts become adapters or wrappers |
| R6 | Deployment | Key loss | Key escrow / KMS OD |
| R7 | Scalability | Storage growth | Retention tiers + lifecycle |
| R8 | Business | False sense of safety without drills | Mandatory drill cadence gate |
| R9 | Recovery | RTO missed | Measured drills; document SLOs as ODs |

Full register in Architecture SSOT.

---

## 14. Open Decisions (do not resolve here)

See Architecture SSOT § Open Decisions. Critical set:

- OD-RPO / OD-RTO commercial SLAs  
- OD-STORAGE vendor (S3-compatible vs volume)  
- OD-KMS encryption key custody  
- OD-TENANT self-service restore vs ops-only  
- OD-PITR in v1 vs later  
- OD-LICENSE SKU mapping  
- OD-GIT remote reconciliation for `v42.0.0`  

---

## 15. Readiness Assessment

| Dimension | % | Notes |
|-----------|---|-------|
| Architecture completeness (proposed SSOT) | **92%** | Ready for owner review; ODs open by design |
| Implementation readiness | **0%** | Not authorized |
| Remaining unknowns | Owner ODs + remote git reconciliation | Expected |
| Blocking risks for **discovery** | None | Implementation blockers deferred |
| Required research | PITR ops patterns; KMS; storage cost model | Pre-43a |
| **Honest overall readiness for Architecture Review** | **90%** | |

---

## 16. Explicit Recommendation

**Selected capability:** Enterprise **Backup & Restore Center** (Phase **43**).

**Why next:** Permanent roadmap numbering; closes High production gap; enables safe Import/Export and broader production enablement; builds on existing scripts without redesigning frozen platforms.

**Status:**

# READY FOR ARCHITECTURE REVIEW

---

## 17. Acceptance Checklist (Discovery)

| Criterion | Met |
|-----------|-----|
| Release 42.0 baseline verified / tagged | ✓ |
| Development branch `release/43` established | ✓ |
| No implementation / no code / no APIs / no UI / no migrations | ✓ |
| Platform assessed | ✓ |
| Capability ranking justified | ✓ |
| Architecture documented (proposed SSOT) | ✓ |
| Integration / runtime / security / ops defined | ✓ |
| Roadmap / risks / ODs identified | ✓ |
| Architecture SSOT ready for review | ✓ |

---

# PASS — ARCHITECTURE DISCOVERY COMPLETE
