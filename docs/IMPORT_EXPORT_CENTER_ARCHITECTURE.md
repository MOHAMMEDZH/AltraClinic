# Phase 42 — Import/Export Center Architecture

**Phase:** 42 (Architecture **COMPLETE** · Implementation **NOT AUTHORIZED**)  
**Status:** **ARCHITECTURE SSOT PUBLISHED** (2026-07-17) · Implementation **NOT AUTHORIZED** · Phase **41 FROZEN**  
**Prerequisite:** Phase 41 — Notification Center & Communication Platform (**CLOSED · FROZEN**, 2026-07-17); Dynamic Platform Phases **28–36** and **38–41** **frozen**; Phase **37** remains reserved (Department / franchise hardening — not started); Phase **39d** / **40d** not started  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Clinical Ops · Platform · Backend · Frontend · Security · Compliance · DevOps  
**SSOT for:** Import/Export Center (orchestration hub), importer/exporter adapters, job lifecycle, artifacts, validation, templates, marketplace packs, discoverability  

**Numbering note:** Earlier roadmap drafts labeled **Import/Export Center** as draft Phase **40** (alongside Notification Center). Phase **40** is permanently **Patient Journey & Workflow Automation**. Phase **41** is permanently **Notification Center**. **This architecture permanently assigns Phase 42 to the Import/Export Center.** Phase **37** remains reserved — not started here. Product roadmap “Phase 3” in `FEATURE_INVENTORY.md` is a **different taxonomy** and does not override Dynamic Platform phase numbering.  
**Authority note:** This document is the permanent architectural SSOT for Phase 42. Discovery findings live in [`PHASE_42_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_42_ARCHITECTURE_DISCOVERY_AND_READINESS.md) (informational). Pre-existing fragmented domain export/import is **foundation only** — it is **not** Phase 42 progress. Audit “Partial / 50%” refers to that foundation, **not** Phase 42 completion. Do **not** redesign Phases 1–41. Do **not** begin implementation without explicit owner + architecture authorization. Do **not** modify Phase 41 Notification Delivery Engine, intents, jobs, workers, adapters, receipts, history, retry, or dead-letter behavior.

**Companion frozen SSOTs (consume, do not redesign):**  
[`DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md`](./DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md) · [`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md) · [`NOTIFICATION_DELIVERY_OPERATIONS.md`](./NOTIFICATION_DELIVERY_OPERATIONS.md) · [`DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md`](./DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md) · [`DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md`](./DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md) · [`DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md`](./DYNAMIC_MULTI_BRANCH_ARCHITECTURE.md) · [`DYNAMIC_WHITE_LABEL_ARCHITECTURE.md`](./DYNAMIC_WHITE_LABEL_ARCHITECTURE.md) · [`LICENSING_ARCHITECTURE.md`](./LICENSING_ARCHITECTURE.md) · [`MEDIA-ARCHITECTURE.md`](./MEDIA-ARCHITECTURE.md) · [`BACKGROUND-ARCHITECTURE.md`](./BACKGROUND-ARCHITECTURE.md)

---

## 1. Purpose

### 1.1 Platform purpose statement

The Import/Export Center is the clinic’s **governed data movement control plane**: a licensed, RBAC-gated, tenant- and branch-aware orchestrator for **asynchronous import and export jobs** that move operational (and carefully classified clinical-adjacent) data **into and out of** the Healthcare ERP — **without** becoming the source of truth for any business entity.

### 1.2 Business goals

- Unify fragmented “export” and “import” entry points into one discoverable hub.
- Make bulk data movement **auditable, cancelable, retryable, and recoverable**.
- Reduce go-live and migration cost for new clinics (staff loads, catalogs, reference data).
- Provide accountant- and ops-ready extracts with consistent formats and retention.
- Preserve vendor-neutral **data portability** (Project Constitution) without locking clinics into opaque silos.

### 1.3 Healthcare goals

- Enforce **PHI minimization** and purpose limitation on every job type.
- Ensure every download and bulk write is **attributable** (Audit) and **observable** (Activity).
- Fail closed on missing license, permission, tenant, or branch context.
- Never use client-side assembly as authority for PHI exports.
- Support compliance evidence packs without replacing clinical documentation SoRs.

### 1.4 Operational goals

- Predictable job lifecycle with queue-backed workers and explicit SLAs.
- Safe large-file handling (streaming, size caps, memory bounds).
- Coexistence with legacy domain export routes during migration (compatibility wrappers).
- Clear operator UX: preview/dry-run, validation reports, artifact download, error rows.

### 1.5 Problems solved

| Problem | How the Center addresses it |
|---------|----------------------------|
| Scattered export buttons with inconsistent formats | Catalog + shared format policies |
| No job history or re-download control | Job + artifact model with TTL |
| Weak PHI controls on downloads | Redaction class, signed URLs, audit on access |
| Bulk import without validation preview | Dry-run / preview mode + validators |
| Dual client/server export paths | Server-authoritative jobs; client download of artifacts only |
| Silent permission widening | RBAC + licensing + tenant/branch gates on every operation |

### 1.6 Problems explicitly NOT solved

| Non-goal | Owner / later program |
|----------|----------------------|
| FHIR/HIE full interoperability mesh | Future Scope (FEATURE_INVENTORY “Future”) |
| Lab analyzer auto-import / LIS loops | Deferred (clinical loop; not Import/Export SoR) |
| Pharmacy / imaging exchange protocols | Deferred |
| Backup & disaster recovery dumps | Phase **43** Backup & Restore |
| Becoming patient / invoice / inventory SoR | Domain modules |
| Notification delivery, consent, quiet hours | Phase **41** (frozen) |
| Journey / workflow execution | Phase **40** / Workflow module |
| Department / franchise hierarchy | Phase **37** |
| Redesign of reporting catalog SoR | Reporting / Analytics domains |
| Global design-system rewrite | Out of scope |

---

## 2. Scope

### 2.1 In Scope (Phase 42 architecture and future authorized implementation)

1. Import/Export **type catalog** (direction, entity, formats, PHI class, permission, license feature).
2. **Job orchestration** lifecycle (states, transitions, retries, dead letter, cancellation, expiry).
3. **Adapter registry** for importer/exporter adapters owned by domain modules.
4. **Validation engine** (schema, business, cross-reference, duplicate, dry-run, preview).
5. **Template registry** for import/export column maps and document layouts (non-SoR).
6. **Artifact storage** metadata + blob handling (checksum, TTL, signed download).
7. Dedicated BullMQ queue **`import-export`** (never `notification-delivery`).
8. Workers for validate / import / export / cleanup.
9. Hub **UI** (navigation, wizards, monitoring, history, downloads).
10. Activity + Audit emission for job and artifact lifecycle.
11. Optional **notification intents** via Phase 41 producer APIs only.
12. Feature flag `IMPORT_EXPORT_CENTER_ENABLED` and licensing gates.
13. Compatibility wrappers for selected legacy export/import endpoints.
14. Dynamic Platform extension kind **`importExport`** + static catalog baseline.
15. Playwright acceptance + rollback server pattern (port reserved at implementation planning).

### 2.2 Out of Scope

- Any modification to Phase 41 delivery engine, adapters, receipts, history, retry, DLQ.
- Owning or duplicating domain entities (Patient, Invoice, StockItem, etc.).
- Cross-module Prisma access from the hub (adapters call domain services only).
- Client-authoritative PHI export generation.
- Using notification channel adapters to transport file bytes.
- FHIR R4 resource server, HL7 v2 MLLP gateways (Future Scope).
- Lab/pharmacy clinical integration loops (Deferred).
- Phase 43 backup snapshots.
- Phase 37 franchise/department model.
- Replacing Reporting **Export Center** page in v1 (coexistence required; see §24).

### 2.3 Future Scope (explicitly after Phase 42 closure or separate program)

- FHIR import/export packs.
- Partner marketplace signed import/export packs beyond first-party adapters.
- Scheduled recurring exports.
- Cross-tenant platform-admin migration tools (super-admin app).
- Streaming bidirectional sync connectors.

### 2.4 Deferred Scope (explicit)

| Item | Reason |
|------|--------|
| Lab result auto-import | Clinical SoR + analyzer protocols |
| DICOM bulk exchange | Imaging domain |
| Workflow definition bulk I/O as hub type | Remains Workflow-owned unless adopted later |
| Unredacted clinical note bulk export | PHI risk; requires separate compliance program |

### 2.5 Scope creep prohibition

Any capability not listed in §2.1 requires an **architecture addendum** and owner approval before implementation planning. “Useful export button” in a domain UI is **not** automatic Phase 42 scope.

---

## 3. Guiding Principles

| Principle | Normative rule |
|-----------|----------------|
| **Single Source of Truth** | Domains own entities. Hub owns jobs, artifacts, catalogs, validation reports. |
| **Orchestration over ownership** | Hub schedules and coordinates; domains validate and mutate. |
| **Composable adapters** | One adapter per (domain × direction × format family); registered, versioned, fail-isolated. |
| **Idempotent execution** | Job `idempotencyKey` unique per tenant; re-submit returns same job when in-flight/terminal success. |
| **Tenant isolation** | Every row and blob keyed by `tenantId`; cross-tenant IDOR fail-closed. |
| **Branch isolation** | Jobs declare `branchScope` (`single` \| `all_authorized`); never exceed actor branch grants. |
| **Auditability** | Downloads and import commits produce AuditEntry; jobs produce Activity. |
| **Recoverability** | Retry with backoff; dead letter; operator cancel; artifact TTL cleanup. |
| **Security first** | Fail closed on license/RBAC/tenant/branch; signed URLs; injection defenses. |
| **Healthcare compliance** | PHI class per type; redaction defaults; retention by class. |
| **Backward compatibility** | Legacy domain routes remain until explicitly deprecated behind wrappers. |
| **No Phase 41 mutation** | Notifications only via approved intent producer contracts. |

---

## 4. High-Level Architecture

```
Module Registry
  ↓
EffectiveModuleView (importExport contributions)
  ↓
STATIC_IMPORT_EXPORT_CATALOG (parity baseline; never runtime authority alone)
  ↓
Server ImportExport Resolver (license / RBAC / tenant / branch)
  ↓
EffectiveImportExportView (runtime discoverability authority)
  ↓
DynamicImportExportProvider (configuration & hub discoverability)
  ↓
Import/Export Hub UI + Job APIs
  ↓
Job Orchestrator ──→ Queue `import-export` ──→ Workers
  ↓                      ↓
Validation Engine    Adapter Registry (domain importers/exporters)
  ↓                      ↓
Artifact Store ←──── Domain Services (SoR)
  ↓
Activity (38) · Audit (39) · Notification intents (41) · Licensing (28) · Branch (36)
```

### 4.1 Component responsibilities

| Component | Responsibility | Ownership |
|-----------|----------------|-----------|
| **Import Center** | UX + APIs for inbound jobs, upload, preview, commit | Hub module |
| **Export Center** | UX + APIs for outbound jobs, filter, generate, download | Hub module |
| **Job Scheduler** | Persist jobs, enqueue, lease, transition states | Hub module |
| **Queue** | BullMQ queue name `import-export` | Background infra (consume) |
| **Workers** | Process validate/export/import/cleanup jobs | Hub workers |
| **Artifact Storage** | Blob put/get/delete + metadata | Hub + Media/storage authority |
| **Validation Engine** | Schema + business + cross-ref orchestration | Hub; domain validators invoked |
| **Template Registry** | Column maps / layout templates for types | Hub config (not domain SoR) |
| **Adapter Registry** | Resolve importer/exporter by `typeId` + format | Hub registry; adapters in domains |
| **Notification integration** | Job completion intents via Phase 41 producer | Consume only |
| **Activity integration** | Observational lifecycle events | Consume Phase 38 patterns |
| **Audit integration** | Compliance proof for create/download/commit | Consume Phase 39 |
| **Authorization layer** | RBAC checks before every mutating/read path | Consume Auth/RBAC |
| **Licensing layer** | Feature + `allowDataImport` / `allowDataExport` | Consume Licensing |
| **Observability** | Logs, metrics, traces, health | Hub + platform |

### 4.2 Boundaries

- Hub **may not** write Patient/Invoice/Stock rows except through domain import services.
- Domains **may not** enqueue `import-export` jobs without going through hub APIs (except temporary legacy routes wrapping hub).
- Workers **may not** call external HTTP URLs supplied by users (no SSRF import sources in v1).
- UI **may not** assemble PHI CSV in-browser as the authoritative export.

---

## 5. Domain Ownership Matrix

| Domain | Owner module | Responsibilities | Allowed imports (v1 catalog) | Allowed exports (v1 catalog) | Allowed adapters | Forbidden |
|--------|--------------|------------------|------------------------------|------------------------------|------------------|-----------|
| Identity / Users | `identity` | User SoR, roles | Staff user XLSX/CSV (existing handlers) | Staff user XLSX/CSV/PDF | `users-importer`, `users-exporter` | Owning jobs/artifacts |
| Patients | `patients` | Patient SoR | **None in v1** (Future: demographics-only with compliance pack) | Demographics-only CSV/XLSX (no clinical notes) | `patients-demographics-exporter` | Clinical note/PHI dump export |
| Billing | `billing` | Invoice/payment SoR | **None in v1** | Invoices CSV/XLSX | `invoices-exporter` | Payment gateway secrets |
| Inventory | `inventory` | Catalog/stock SoR | Catalog items CSV/XLSX (reference) | Items + stock summary CSV/XLSX | `inventory-catalog-importer`, `inventory-exporter` | Silent stock qty mutation without domain rules |
| Reporting | `reporting` | Report definitions/runs | **None** | Operational report artifacts via adapter wrapping existing export service | `reporting-export-adapter` | Replacing report catalog SoR |
| Analytics | `analytics` | Metrics/reports | **None** | Report file export via adapter | `analytics-export-adapter` | Metric SoR ownership |
| Notifications | `notifications` | Inbox/config | **None** | Delivery-log metadata export (redacted) optional | `notifications-history-exporter` | Delivery engine changes |
| Workflow | `workflow` | Definitions/instances | **Deferred** | **Deferred** (engine may keep own I/O) | — | Hub must not steal definition SoR in v1 |
| Journey | `journey` | Journey config | **None** | **None** in v1 | — | Execution |
| Scheduling / EMR / Beauty / Dental | respective | Clinical/ops SoR | **None** in v1 | **None** or narrowly future-scoped | — | Broad clinical export |
| Import/Export Hub | `import-export` (new) | Jobs, artifacts, catalog, validation orchestration | N/A | N/A | Registry only | Business entity tables |

**Normative:** Adding a domain to the catalog requires a registered adapter owned by that domain and an architecture addendum if outside §5 v1 set.

---

## 6. Runtime Authorities

| Authority | Owner | How Import/Export consumes it |
|-----------|-------|-------------------------------|
| Authentication / JWT / session | Auth module | Bearer required; actor from claims; `/auth/me` for user id |
| RBAC | Auth / permissions | `api.importExport` actions + domain resource actions for adapter ops |
| Licensing / entitlements | Phase 28 | Feature entitlement + tenant advanced settings `allowDataImport` / `allowDataExport` |
| Tenant Resolver | Tenant context / RLS | All queries scoped; platform bypass only for worker load with audited reason |
| Branch Resolver | Phase 36 | `branchId` / `branchScope` validated against actor grants |
| Activity | Phase 38 | Emit observational events; never widen Activity SoR |
| Audit | Phase 39 | Write AuditEntry on create job, download, import commit, cancel |
| Notification Platform | Phase 41 **frozen** | Approved intent producer API only |
| Storage / Media | Media architecture | Put/get/delete blobs under hub prefix |
| Queue / Workers | Background architecture | Queue `import-export`; workers disabled when `NODE_ENV=test` or `BACKGROUND_WORKERS_ENABLED=false` |
| White Label | Phase 35 | Optional branding on PDF/cover pages; consume-only |
| Module Registry | Phase 29+ | Extension kind `importExport`; EffectiveImportExportView |

**EffectiveImportExportView** is the runtime **discoverability** authority for which types/surfaces appear.  
**Enforcement authority** remains RBAC + Licensing + domain services. Catalog alone never grants write access.

`STATIC_IMPORT_EXPORT_CATALOG_IS_RUNTIME_AUTHORITY = false` (parity baseline only).

---

## 7. Extension Model

### 7.1 Extension kinds

| Kind | Role |
|------|------|
| `importExport` | Registry contribution: type cards, surfaces, provider packs |
| Importer Adapter | Domain-implemented inbound executor |
| Exporter Adapter | Domain-implemented outbound executor |
| Validator | Schema/business/cross-ref checks |
| Transformer | Column mapping / normalization (no SoR writes) |
| Template Provider | Templates for columns/layouts |
| Artifact Provider | Format writers/readers (CSV/XLSX/JSON/PDF via approved libs) |
| Lifecycle Hooks | `onQueued`, `onValidated`, `onCompleted`, `onFailed` (observability only) |

### 7.2 Adapter contract (normative)

Each adapter declares:

- `typeId`, `direction` (`import` \| `export`), `formats[]`, `phiClass`, `version`
- `permission: { resource, action }`, `licenseFeature`
- `validate(input) → ValidationReport`
- `execute(context) → AdapterResult` (export → artifact bytes/stream; import → commit summary)
- `estimate(input) → { rowCount?, byteEstimate? }` (optional)

### 7.3 Registration

- First-party adapters register in hub Adapter Registry at module init.
- Marketplace packs: signed contributions via Module Registry (same trust model as other Dynamic Platform packs).
- Versioning: semver on adapter; incompatible major → type hidden until upgraded.
- Compatibility: hub rejects adapters missing required contract methods.
- Error isolation: adapter throw → job failure class (`retryable` \| `permanent`); never crash worker process.

---

## 8. Job Lifecycle

### 8.1 States

| State | Meaning |
|-------|---------|
| `draft` | Created; not queued (optional UI save) |
| `queued` | Persisted and enqueued |
| `validating` | Validation worker running |
| `exporting` | Export adapter running |
| `importing` | Import adapter running (after successful validation when required) |
| `completed` | Success; artifacts available |
| `completed_with_warnings` | Success with non-fatal warnings |
| `cancelled` | Operator or system cancel |
| `failed` | Terminal failure (non-retry or exhausted) |
| `retrying` | Scheduled retry after retryable failure |
| `dead_letter` | Attempts exhausted; needs manual intervention |
| `expired` | Artifacts/job past retention; terminal |

### 8.2 Transition table

| From | To | Entry condition | Exit / emit |
|------|-----|-----------------|-------------|
| — | `draft` | `POST` create with `queue=false` | Activity `job_created` |
| — / `draft` | `queued` | Create/queue; idempotency OK | Activity `job_queued`; Audit `job.created` |
| `queued` | `validating` | Worker lease validate | Activity `job_validating` |
| `validating` | `exporting` \| `importing` | Validation passed | Activity `job_validated` |
| `validating` | `failed` | Fatal validation | Activity `job_failed`; Audit `job.failed` |
| `validating` | `completed_with_warnings` | Export dry-run only / preview | Artifact = report |
| `exporting` | `completed` / `completed_with_warnings` | Adapter success | Activity `job_completed`; optional notify |
| `importing` | `completed` / `completed_with_warnings` | Commit success | Activity `job_completed`; Audit `import.committed` |
| `exporting`/`importing`/`validating` | `retrying` | Retryable error; attempts < max | Activity `job_retry`; schedule |
| `retrying` | `queued` | Delay elapsed | Re-enqueue |
| `*` in-flight | `cancelled` | Cancel API; cooperative abort | Activity `job_cancelled`; Audit |
| `retrying` / fail path | `dead_letter` | Attempts ≥ max | Activity `job_dead_letter`; Audit |
| `completed*` | `expired` | TTL cleanup worker | Activity `job_expired`; delete blobs |
| any | `failed` | Permanent error | Activity + Audit |

### 8.3 Notifications (Phase 41 consume-only)

- On `completed` / `failed` / `dead_letter`: optional in-app (and configured channels) via **intent producer** with PHI-free titles (“Export ready”, “Import failed”).
- **Never** attach file bytes to notification body; include hub deep link only.

### 8.4 Rollback behavior

- **Export:** no domain mutation; cancel deletes in-flight lease; artifacts retained until TTL unless cancel requests delete.
- **Import dry-run / preview:** no domain writes.
- **Import commit:** domain adapter defines transactional boundary; clinical/reference policy per type (§12–§13). Hub does not compensate across domains automatically.

---

## 9. Domain Model

> Logical model for future migrations. **No migrations in this task.**

### 9.1 `ImportExportJob`

| Aspect | Definition |
|--------|------------|
| Purpose | Orchestration record for one import or export |
| Owner | Hub |
| Key fields | `id`, `tenantId`, `branchId?`, `branchScope`, `direction`, `typeId`, `format`, `status`, `requestedByUserId`, `idempotencyKey`, `filters` (JSON), `attemptCount`, `maxAttempts`, `scheduledAt`, `startedAt`, `completedAt`, `failureCode?`, `failureReason?`, `warningCount`, `errorCount`, `correlationId`, `traceId`, `adapterVersion`, `createdAt`, `updatedAt` |
| Relationships | 1..* `ImportExportArtifact`; 0..* `ImportExportValidationError`; 0..* `ImportExportJobLog` |
| Retention | Metadata retained ≥ artifact TTL; purge policy by tenant setting (default 90 days metadata) |
| PHI | Filters may contain identifiers — treat as **restricted**; never log raw filters at info level |
| Tenant/branch | Required tenant; branch optional |
| Immutability | Status transitions via updates; no rewrite of completed success payloads |
| Uniqueness | `@@unique([tenantId, idempotencyKey])` |
| Idempotency | Client `Idempotency-Key` → `idempotencyKey` |

### 9.2 `ImportExportArtifact`

| Aspect | Definition |
|--------|------------|
| Purpose | Stored input upload or output file |
| Owner | Hub metadata; storage provider owns bytes |
| Key fields | `id`, `tenantId`, `jobId`, `kind` (`upload`\|`output`\|`report`), `storageKey`, `contentType`, `byteSize`, `checksumSha256`, `redactionClass`, `expiresAt`, `deletedAt?` |
| PHI | Usually **PHI or sensitive** |
| Retention | TTL by `phiClass` (see §10) |
| Download | Only via authorized API issuing signed URL |

### 9.3 `ImportExportTypeRegistration` / catalog entries

| Aspect | Definition |
|--------|------------|
| Purpose | Discoverable type definition |
| Owner | Hub catalog + registry contributions |
| Key fields | `typeId`, `direction`, `entity`, `formats`, `phiClass`, `permission`, `licenseFeature`, `commitPolicy`, `maxBytes`, `maxRows`, `version` |
| Runtime | Surfaced via EffectiveImportExportView |

### 9.4 `ImportExportValidationError`

| Aspect | Definition |
|--------|------------|
| Purpose | Per-row or per-field validation failure |
| Fields | `jobId`, `tenantId`, `rowNumber?`, `field?`, `code`, `message` (no raw PHI values), `severity` (`warning`\|`error`) |
| PHI | Messages must not echo full PHI; use masked tokens |

### 9.5 `ImportExportJobLog` / metrics

| Aspect | Definition |
|--------|------------|
| Purpose | Append-only operator-visible timeline + counters |
| Fields | timestamp, level, code, message, `rowsProcessed`, `rowsSucceeded`, `rowsFailed`, durationMs |
| Metrics projection | Redis/platform metrics keyed by `typeId` / tenant |

### 9.6 Templates

`ImportExportTemplate`: named column map / layout; tenant-overridable copies; **not** domain SoR.

### 9.7 Distinctions

| Kind | Examples |
|------|----------|
| New entities | Job, Artifact, ValidationError, JobLog, TypeRegistration, Template |
| Extensions to existing | None required on Patient/Invoice tables for v1 |
| Read-only projections | Domain export queries inside domain repos |
| Derived views | EffectiveImportExportView |

---

## 10. Artifact Strategy

| Topic | Normative rule |
|-------|----------------|
| Storage | Object storage (or media module) under prefix `tenants/{tenantId}/import-export/{jobId}/` |
| Encryption | TLS in transit; at-rest encryption required in production |
| Checksum | SHA-256 stored on upload/generate; verify on download |
| Virus scanning | **Required before import parse** when scanner configured; if not configured in non-prod, log `scan_skipped`; **production requires scanner** |
| Large files | Stream to storage; never buffer entire file in worker memory above threshold (§20) |
| Streaming | Export adapters should stream when `rowCount` estimate > streaming threshold |
| Temporary URLs | Signed GET; TTL ≤ 15 minutes; single-use preferred |
| Download authz | RBAC + license + job tenant/branch check **before** issuing URL; Audit on issue |
| Cleanup | Scheduled worker deletes expired blobs + marks `expired` |
| Retention defaults | `phiClass=none`: 7 days; `restricted`: 72 hours; `phi`: 24 hours (overridable down, not up beyond tenant max) |

---

## 11. File Formats

| Format | v1 support | Use | Limitations |
|--------|------------|-----|-------------|
| **CSV** | Yes | Tabular import/export | UTF-8; RFC4180; injection escaping (§14) |
| **Excel (XLSX)** | Yes | Tabular; user-friendly | Max rows/bytes; no macros executed; formulas stripped on import |
| **JSON** | Yes | Structured export / machine import | Schema-validated |
| **PDF** | Export only | Human-readable packs | Generated via approved builders (`@booking/dashboard-export` or domain) |
| **ZIP** | Yes | Multi-artifact bundle | Zip-slip prevention; max entries |
| **XML** | Future | — | Not v1 |
| **FHIR** | Future | Interop packs | Not v1 |
| **HL7 v2** | Deferred | Clinical interfaces | Not Import/Export Center v1 |

**Versioning:** Each type declares `schemaVersion`; exporters stamp version in artifact metadata; importers reject incompatible majors.

---

## 12. Validation Architecture

| Layer | Owner | Behavior |
|-------|-------|----------|
| Schema validation | Hub + template | Types, required columns, formats |
| Business validation | Domain validator | Uniqueness, status rules, license quotas |
| Cross-reference | Domain | FK existence (e.g. role ids) |
| Duplicate detection | Domain + hub | Idempotent keys / natural keys |
| Conflict resolution | Per-type policy | `reject` (default clinical) \| `skip` \| `update` (reference data only when declared) |
| Preview / dry-run | Hub | `mode=dryRun` runs validate only; produces report artifact |
| Partial success | Only if `commitPolicy=partial` | Record row errors; commit successes per domain batch policy |
| Warnings vs fatal | Severity on ValidationError | Fatal blocks commit; warnings allow `completed_with_warnings` |

**Default commit policies (normative):**

- Patient-related / clinical-adjacent: `all_or_nothing`
- Inventory catalog reference import: `partial` allowed
- Users import: follow existing identity handler semantics (documented by adapter)

---

## 13. Error Handling

| Concern | Rule |
|---------|------|
| Retry | Full-jitter exponential backoff; `maxAttempts` default 5; retryable = transient IO/storage/timeouts |
| Dead letter | Attempts exhausted → `dead_letter`; operator may `POST .../requeue` (manage permission) |
| Rollback | Export: N/A; Import: domain transaction; no cross-domain saga in v1 |
| Compensation | Manual operator runbooks; no automatic multi-domain compensate |
| Idempotency | Create job + adapter execute keys |
| Duplicate submissions | Same idempotency key returns existing job |
| Timeout | Per-phase timeouts (§20); mark retryable on timeout |
| Cancellation | Cooperative; adapter checks abort signal between batches |
| Recovery | Requeue from dead letter creates **new attempt chain** with audit link to prior job |
| Manual intervention | Hub UI dead-letter queue; download error report |

---

## 14. Security Model

| Control | Requirement |
|---------|-------------|
| RBAC | `api.importExport`: `view`, `create`, `import`, `export`, `manage`; plus domain permissions for adapter |
| Licensing | Feature entitlement + `allowDataImport` / `allowDataExport` tenant settings |
| Tenant isolation | Mandatory on all queries and storage keys |
| Branch isolation | Enforce `branchScope` |
| PHI | Per-type `phiClass`; default redaction on previews |
| Encryption | TLS + at-rest |
| Upload authz | `import` permission; size/type allowlist |
| Download authz | `export` or job owner + view; signed URL |
| CSV injection | Escape cells starting with `=`, `+`, `-`, `@` |
| Formula injection | Strip Excel formulas on import |
| Malware scanning | §10 |
| Content validation | Magic-byte / content-type sniff vs declared format |
| Rate limiting | Per-tenant job create and download rate limits |
| Replay protection | Idempotency keys; short-lived signed URLs |
| DoS mitigation | Max bytes/rows; concurrency caps; queue limits |
| SSRF | No user-provided fetch URLs in v1 |
| Logging | No artifact payloads; IDs and counts only |

---

## 15. Activity and Audit

### 15.1 Activity events (observational, PHI-free)

`job_created`, `job_queued`, `job_validating`, `job_validated`, `job_exporting`, `job_importing`, `job_completed`, `job_completed_with_warnings`, `job_failed`, `job_retry`, `job_cancelled`, `job_dead_letter`, `job_expired`, `artifact_ready`, `artifact_download_requested`

Payload: `tenantId`, `branchId?`, `jobId`, `typeId`, `direction`, `status`, `correlationId` — **never** row data.

### 15.2 Audit events (compliance)

| Action | When |
|--------|------|
| `importExport.job.created` | Job queued |
| `importExport.job.cancelled` | Cancel |
| `importExport.import.committed` | Successful import write |
| `importExport.artifact.downloaded` | Signed URL issued / download |
| `importExport.job.dead_lettered` | DLQ |
| `importExport.job.requeued` | Manual requeue |

Include actor, roles, IP if available, `correlationId`, resource ids.

### 15.3 Correlation

Every job carries `correlationId` (client or generated) and `traceId` for distributed tracing.

---

## 16. Notification Integration (Phase 41)

| Rule | Normative |
|------|-----------|
| Consume | Approved Phase 41 intent producer / create-notification path only |
| Do not | Call provider adapters, delivery workers, or mutate delivery tables |
| Content | PHI-free title/body; link to hub job route |
| Channels | Prefer `in-app`; additional channels only if transactional and consented via existing engine |
| Failure | Notification failure must not fail the import/export job |

Phase 41 remains **FROZEN**.

---

## 17. API Contracts (proposed — not implemented)

Base path: `/import-export`  
Versioning: URL stable; additive fields only; breaking changes require `/v2` later.

| Method | Path | Purpose | Permission | Idempotency |
|--------|------|---------|------------|-------------|
| GET | `/types` | Effective catalog | `view` | — |
| GET | `/jobs` | List (filter status, type, direction) | `view` | — |
| POST | `/jobs` | Create/queue job | `create` + import/export | `Idempotency-Key` required |
| GET | `/jobs/:id` | Detail + summary | `view` | — |
| POST | `/jobs/:id/cancel` | Cancel | `manage` or owner | — |
| POST | `/jobs/:id/requeue` | From dead letter | `manage` | New key |
| POST | `/jobs/:id/upload` | Upload import file | `import` | — |
| GET | `/jobs/:id/artifacts/:artifactId/download` | Signed URL | `export`/`view` | — |
| GET | `/jobs/:id/validation-report` | Errors page | `view` | — |

**Errors:** `401`, `403` (RBAC/license/settings), `404`, `409` (idempotency conflict), `413` (too large), `415` (media type), `422` (validation), `429` (rate).

**Pagination:** cursor-based on jobs list.  
**Filtering:** `status`, `typeId`, `direction`, `createdFrom`, `createdTo`, `branchId`.  
**Events (domain/outbox):** `ImportExportJobCompleted`, `ImportExportJobFailed`, `ImportExportArtifactDownloaded` (internal).

**Commands (logical):** `CreateImportExportJob`, `CancelImportExportJob`, `RequeueImportExportJob`.

---

## 18. UI Architecture

| Element | Specification |
|---------|---------------|
| Navigation | **Settings → Data → Import / Export** (registry surface `import-export-hub`) |
| Screens | Hub home; type gallery; export wizard; import wizard; job detail; history; dead-letter; download center |
| Wizard flow | Select type → scope (branch/filters) → format → dry-run optional → confirm → monitor |
| Job monitoring | Status timeline; progress counts; cancel button when allowed |
| History | Filterable job table |
| Downloads | Artifact list with expiry countdown |
| Validation preview | Table of errors/warnings; download report |
| Permission handling | Hide types user cannot use; 403 empty states |
| Tenant switching | Re-bootstrap EffectiveImportExportView |
| Branch switching | Refresh scope; warn if job branch ≠ active branch |
| Accessibility | WCAG 2.1 AA; keyboard wizards; live regions for status |
| Responsive | Desktop-first; mobile = status/history read-only |
| RTL / Localization | All strings via i18n; RTL layout parity |

Reporting **Export Center** (`reports/export`) remains available; hub links to it as “Reporting exports” until coexistence decision executed (§24).

---

## 19. Observability

| Signal | Definition |
|--------|------------|
| Logs | `kind=import_export.job` structured JSON |
| Metrics | `jobs_queued`, `jobs_completed`, `jobs_failed`, `queue_depth`, `artifact_bytes`, `download_count`, `validation_error_rate` |
| Tracing | Distributed spans per phase with `jobId` |
| Health | Worker ready; storage ping; queue ping |
| Dashboards | Per-tenant ops view (internal) |
| Alerts | DLQ > N; queue lag > threshold; export volume anomaly |
| SLA metrics | Time-to-artifact p95; validate duration p95 |

---

## 20. Performance Targets (design expectations — not measured yet)

| Parameter | Target |
|-----------|--------|
| Max upload size (v1) | 50 MiB default; type may lower |
| Max rows (CSV/XLSX) | 100,000 default; type may lower |
| Concurrent jobs per tenant | 3 default |
| Worker concurrency | Configurable; start at 2 |
| Streaming threshold | ≥ 10,000 rows or ≥ 10 MiB |
| Phase timeout | Validate 10m; export 30m; import 30m |
| Signed URL TTL | ≤ 15m |
| Memory | Worker hard cap policy: stream above threshold; fail `permanent` if exceeded |
| Indexes | `(tenantId, createdAt)`, `(tenantId, status)`, `(tenantId, typeId)`, artifact `(expiresAt)` |
| Caching | Catalog/Effective view only; never cache PHI artifacts in Redis |

---

## 21. Deployment Strategy

| Topic | Rule |
|-------|------|
| Feature flag | `IMPORT_EXPORT_CENTER_ENABLED` default **false** until acceptance |
| Rollout | Internal → pilot tenant → percentage → default on |
| Rollback | Flag off; stop `import-export` workers; legacy routes unaffected |
| Backfill | Not required for v1 |
| Compatibility | Legacy exports remain; wrappers optional |
| Migration | Additive tables only; no Phase 41 schema changes |
| Zero-downtime | Expand/contract migrations; workers drain on deploy |

**Implementation sub-phases (planning only — not authorized):** 42a Foundation → 42b Core Domain → 42c Integration → 42d UI → 42e Acceptance.

---

## 22. Acceptance Criteria (objectively verifiable)

Phase 42 may be marked complete **only when all** are true:

1. Feature flag can enable/disable hub with no residual job processing when off.  
2. Playwright suite for hub: create export job → artifact download → Audit entry exists for download.  
3. Playwright: unauthorized role receives HTTP 403 on create/download.  
4. Automated test: job for tenant A cannot be read by tenant B.  
5. Automated test: branch-scoped job inaccessible outside grants.  
6. Dry-run import produces validation report artifact and **zero** domain writes (assert row counts unchanged).  
7. Retryable failure schedules retry; exhausted attempts → `dead_letter` with Activity + Audit.  
8. Worker startup logs prove queue `import-export` ready (structured).  
9. Notification completion path (if enabled) uses intent producer only; Phase 41 delivery Playwright suite still passes unchanged.  
10. CSV injection escaping verified by unit tests.  
11. Artifact expired → download returns 404/410.  
12. Rollback mode / flag-off verified.  
13. `STATIC_IMPORT_EXPORT_CATALOG_IS_RUNTIME_AUTHORITY === false` and EffectiveImportExportView is discoverability authority.  
14. No Prisma access from hub into foreign domain tables (static architecture test or module boundary lint).  
15. Ops runbook published for queue, TTL, DLQ.

---

## 23. Risks

| Risk | Category | Mitigation |
|------|----------|------------|
| PHI exfiltration via exports | Security / Compliance | TTL, audit, rate limits, redaction, RBAC |
| Scope creep to FHIR/LIS | Architectural | §2.3–2.4 freeze |
| Breaking Phase 41 | Architectural | Consume-only notification rule + regression suite |
| Dual paths diverge | Maintenance | Compatibility wrappers + deprecation plan |
| Storage cost | Operational | TTL + quotas + alerts |
| Worker/redis contention with notifications | Performance | Separate queue + concurrency caps |
| Adapter trust boundary | Security | Registry signing for marketplace; first-party review |
| Large XLSX memory blowups | Performance | Streaming thresholds; hard fail |
| False “50% complete” governance | Operational | This SSOT + discovery clarification |
| Import partial commits surprising clinics | Compliance | Per-type commit policy; default all-or-nothing for clinical-adjacent |

---

## 24. Open Decisions (owner approval)

Architecture is complete for planning. The following require **owner product approval** before or during implementation planning (they do not block SSOT publication):

| ID | Decision | Options | Architecture default if owner silent at planning start |
|----|----------|---------|------------------------------------------------------|
| OD-1 | Commercial license SKU mapping for each `typeId` | Map to existing plans vs new add-on | Gate all types on `allowDataImport`/`allowDataExport` + module license until SKU matrix provided |
| OD-2 | Coexistence duration of Reporting Export Center vs hub | Keep forever / migrate in 42d / redirect | Keep coexistence through 42e; deep-link from hub |
| OD-3 | Production malware scanner vendor | ClamAV / cloud AV / defer prod | **Block production enablement** until scanner configured |
| OD-4 | Patient demographics export in first production cut | Include / delay | Include behind explicit permission `api.patients` + `export` |
| OD-5 | Rollback Vite port number for Playwright | Assign 5184 vs other | Reserve **5184** unless conflict |

---

## 25. Authority & Status Footer

| Item | Status |
|------|--------|
| Phase 41 Notification Center | **FROZEN** |
| Phase 42 Architecture SSOT | **COMPLETE** (this document) |
| Phase 42a–42f Implementation | **COMPLETE** (Foundation → Ops UI) |
| Phase 42g Production Acceptance | See [`PHASE_42G_PRODUCTION_ACCEPTANCE.md`](./PHASE_42G_PRODUCTION_ACCEPTANCE.md) |
| Release 42.0 | **FROZEN** 2026-07-18 — [`RELEASE_42.0.md`](./RELEASE_42.0.md) |
| Operations runbook | [`IMPORT_EXPORT_CENTER_OPERATIONS.md`](./IMPORT_EXPORT_CENTER_OPERATIONS.md) |

**Production enablement gates (must be true before defaulting flag on):**

1. `MEDIA_VIRUS_SCANNER` is non-noop.  
2. Durable `IMPORT_EXPORT_TEMP_PATH` / `IMPORT_EXPORT_ARTIFACT_PATH` mounts.  
3. Migrations applied; health shows import/export runtimes + queue `import-export`.  
4. Ops runbook followed for rollout/rollback.

---

*End of Import/Export Center Architecture SSOT*
