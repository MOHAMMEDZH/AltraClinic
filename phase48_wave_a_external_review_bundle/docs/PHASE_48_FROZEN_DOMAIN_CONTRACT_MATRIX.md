# Phase 48 — Frozen Domain Contract Matrix

| Field | Value |
|-------|--------|
| **SSOT** | `docs/PHASE_48_ARCHITECTURE_FREEZE.md` |
| **Status** | FROZEN (pending external Freeze acceptance) |
| **Implementation** | NOT AUTHORIZED |

Exact Prisma names may vary; semantics below are frozen.

---

| Concept | Source of Record | Scope | Identity | Write Authority | Tenant Isolation | Historical Behavior | Delete Policy | Migration State | Audit | Primary QA Pack | Wave | Frozen ADR |
|---------|------------------|-------|----------|-----------------|------------------|---------------------|---------------|-----------------|-------|-----------------|------|------------|
| CanonicalClinicalServiceDefinition | Clinical catalog (not HealthcareCatalog) | platform SYSTEM_CANONICAL; TENANT_CUSTOM tenant | stableKey immutable after publish | platform / tenant catalog.admin | cross-tenant DENY; A==B for SYSTEM_CANONICAL | publish/deprecate | hard delete forbidden if referenced | known→canonical; no clones | YES | Catalog | A | AR-01 |
| TenantServiceConfiguration | TenantServiceConfiguration | tenant/branch | FK to clinicalServiceId | catalog/branch admin | tenant-scoped | soft | soft | create separately on map | YES | Catalog | A | AR-03 |
| PriceVersion | PriceVersion | tenant/branch | append-only versions | billing.price.admin | tenant-scoped | never overwrite published | deactivate ≠ hard delete | ServicePrice→versions | YES | Pricing/Snapshot | A | AR-04 |
| AppointmentServiceSnapshotRevision | Snapshot revisions | appointment | revisionNumber + effectiveRevisionId | system | tenant via appointment | no in-place identity/price mutate; lock=CONFIRMED | hard delete forbidden | synthetic/LEGACY | YES | Pricing/Snapshot | B | AR-05 |
| ProviderServiceEligibility | ProviderServiceEligibility | tenant/branch | provider+service[+branch] | staffing.admin | DENY cross-tenant | effective dates | soft | flag OFF legacy | YES | Eligibility | B | AR-07 |
| SchedulingResource | SchedulingResource | tenant/branch | ROOM/EQUIPMENT/OPERATORY | schedule.admin | tenant-scoped | soft | soft | — | YES | Operatory/Concurrency | B/D | AR-06/12 |
| ClinicalFormTemplate/Version | Clinical forms | tenant (or pack) | kind + version | clinical.forms.admin | tenant-scoped | published immutable | hard delete forbidden after sign refs | legacy plan consent kept | YES | Consent | C | AR-09/10 |
| PatientFormInstance | PatientFormInstance | patient | pinned versionId | clinical / portal | tenant + PHI | signed immutable | no hard delete signed | — | YES | Consent | C | AR-09/10 |
| InventoryUsageLedger | evolved InventoryConsumptionLog | tenant | usage id + stockMovementId | inventory.usage.* | DENY cross-tenant | append-only | hard delete forbidden | LEGACY_UNATTRIBUTED | YES | P0-10 | C | AR-20 |
| InventoryBatch | InventoryBatch | tenant | lot/expiry/qty | inventory | DENY cross-tenant | deactivated readable | no erase of history | preserve | YES | P0-10 / Injectable | C | AR-11/20 |
| InventoryStockMovement | InventoryStockMovement | tenant | movement ledger | inventory | tenant-scoped | append-only | hard delete forbidden | preserve | YES | P0-10 | C | AR-20 |
| Injectable/clinical specialization | projection of UsageLedger | tenant | 1:1 with usage event | clinical.injectable | tenant-scoped | append-only | no independent stock decrement | nullable historical | YES | Injectable | C | AR-11 |
| ServicePerformance | ServicePerformance | tenant | performance id | service.performance.* | DENY cross-tenant | completed immutable except audited correction | soft | no invented performers | YES | Commission / Combined | D/E/F | AR-21 |
| ServicePerformanceParticipant | Participant | tenant | userId + role + share | service.performance.* | DENY cross-tenant | share sum ≤ 100% | soft | — | YES | Commission | D/E/F | AR-21 |
| StaffCommissionPlanVersion | evolved CommissionRule | tenant/user[/branch/service] | versioned plan | staff.commission.configure | DENY cross-tenant | published immutable | supersede not rewrite | default OFF | YES | P1-14 | F | AR-22 |
| CommissionAccrual | evolved CommissionCalculation/LineItem | tenant | accrual id + planVersionId | staff.commission.* | DENY cross-tenant | append-only; reverse not rewrite | hard delete forbidden | no fabricated history | YES | P1-14 | F | AR-22 |
| TreatmentCourse / CourseSession | TreatmentCourse* | tenant | course + session sequence | clinical/reception | tenant-scoped | soft | soft | — | YES | Course | E | AR-13 |
| DeviceTreatmentRecord | DeviceTreatmentRecord | tenant | device + schema key | clinical.device | tenant-scoped | append/correct+audit | soft | — | YES | Device | E | AR-14 |
| DentalLabCase | DentalLabCase | tenant | case id | dental.lab | tenant-scoped | soft | soft | — | YES | Lab | D | AR-16 |
| RecallRule | RecallRule | tenant | rule id | outreach.admin | tenant-scoped | soft | soft | — | YES | Recall | G | AR-17 |
| PatientRecallInstance | PatientRecallInstance | patient | instance id | outreach/scheduling | tenant + PHI | soft | soft | — | YES | Recall | G | AR-17 |
| AvailabilityException | AvailabilityException | tenant/branch | exception id | schedule.admin | tenant-scoped | soft | soft | — | YES | Availability | G | P1-11 |

### Frozen invariants (cross-cutting)

```text
HealthcareCatalog != Clinical Service Catalog
departmentOnlyStockAccountabilityAllowed = NO
separateProductBatchUsageConsumptionLedger = NO
Appointment.providerId automatic performer = NO
commissionHistoricalRecalculationAllowed = NO
destructiveLegacyRemapping = NO
newBookingFreeTextIdentityAllowed = NO
```
