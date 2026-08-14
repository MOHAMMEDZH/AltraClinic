# Phase 48 — Migration & Backward Compatibility Review

| Field | Value |
|-------|--------|
| **Stage** | Architecture Review only |
| **Decision** | AR-18 (updated for shared canonical definitions) |
| **Destructive remapping** | **NO** |
| **Implementation** | NOT AUTHORIZED |

---

## 1. Goals

1. Preserve every historical appointment, invoice, dental plan item, beauty annotation, and ServicePrice row.
2. Introduce **shared** `CanonicalClinicalServiceDefinition` (SYSTEM_CANONICAL) + TenantServiceConfiguration + PriceVersion + AppointmentServiceSnapshot revisions without incorrect mappings.
3. Dual-read → dual-write → prefer-canonical → freeze legacy write paths.
4. Feature-flag rollback of *new* writes; historical data always forward-readable.

---

## 2. Compatibility layers

| Layer | Behavior |
|-------|----------|
| Legacy fields retained | `Appointment.serviceType`, `ServicePrice.serviceCode`, plan `code`, beauty `treatment` strings remain stored |
| Mapping tables | `LegacyServiceMapping` / `LegacyPriceMapping` with `MAPPED` \| `LEGACY_UNMAPPED` \| `AMBIGUOUS` |
| Snapshots | New bookings write snapshot **revision 1**; legacy get synthetic snapshot when MAPPED, else `clinicalServiceId=null` + frozen legacy display |
| Feature flags | `catalog.canonical.write`, `booking.eligibility.enforcement`, `billing.invoice.from.snapshot` |

---

## 3. Shared canonical vs tenant copies (AR-B01 closure)

**Do NOT** automatically create a new tenant-local ClinicalService copy for every existing ServicePrice row that maps to a known standard service.

| Legacy case | Strategy |
|-------------|----------|
| Known standard code (e.g. scheduling types) | Map → **shared SYSTEM_CANONICAL** definition |
| | Create **TenantServiceConfiguration** (enable) separately |
| | Create **PriceVersion** from unitPrice separately |
| Unknown / garbage / ambiguous | `LEGACY_UNMAPPED` or `AMBIGUOUS` — remain readable |
| True custom after review | Explicit **TENANT_CUSTOM** only after deterministic/human-approved classification |
| Auto-promote garbage to published canonical | **FORBIDDEN** |

```text
destructive remapping = NO
tenant duplicates of standard services for pricing = NO
```

---

## 4. Existing appointments

| Case | Strategy |
|------|----------|
| `serviceType` matches known SCHEDULING_SERVICE_TYPES | Map to shared SYSTEM_CANONICAL stableKeys |
| Custom free-text | `LEGACY_UNMAPPED`; raw string on snapshot; display forever |
| Null | UNKNOWN; no invented service |
| Soft-deleted | Readable; not rewritten |

Silent remapping to wrong service = **FORBIDDEN**. AMBIGUOUS → human review queue.

Reschedule of legacy: keep legacy snapshot unless staff explicitly selects canonical service (new revision with reason).

**New bookings when `catalog.canonical.write=ON`:** free-text service identity **FORBIDDEN**.

---

## 5. Existing ServicePrice rows

| Case | Strategy |
|------|----------|
| Maps to known SYSTEM_CANONICAL | Config + PriceVersion only — **no** definition copy |
| nameEn/nameAr | May seed tenant presentation override or remain on legacy row until mapped |
| isActive=false | Configuration disabled + price INACTIVE |
| Duplicate bilingual codes same meaning | AMBIGUOUS — do not merge automatically |
| Unmatched | LEGACY_UNMAPPED; legacy billing path until mapped |

---

## 6. Dental TreatmentPlanItem codes

| Decision | Keep `code`/`description`/`toothNumbers`/`estimatedCost` as clinical plan detail |
|----------|----------------------------------------------------------------------------------|
| Historical | `clinicalServiceId?` **nullable** |
| New plan booking links (canonical ON) | Require canonical identity where workflow books a service |
| Pricing | Plan estimates ≠ appointment snapshot; invoice uses effective snapshot revision |

---

## 7. Beauty free-text history

| Decision | Preserve `treatment` / zone / parameters forever |
|----------|--------------------------------------------------|
| Historical | `clinicalServiceId?` **nullable** |
| New catalog-managed aesthetic treatments | Must link canonical identity; free-text = note/history only |
| New catalog-managed injectable/aesthetic material consumption | Create authoritative **InventoryUsageLedger** event → link existing **InventoryBatch** → attach injectable/clinical specialization fields where needed. **No separate ProductBatchUsage consumption ledger.** |
| Historical treatment material evidence | Preserve as-is; batch mapping may remain nullable when unknown |
| Historical batch usage | **Do not fabricate** |
| Historical employee attribution | **Do not fabricate** (`LEGACY_UNATTRIBUTED`) |

---

## 8. Hardcoded SCHEDULING_SERVICE_TYPES

Seed once as **SYSTEM_CANONICAL** definitions (shared).  
Per-tenant: create TenantServiceConfiguration on cutover — **not** per-tenant definition clones.  
Hardcoded list = fallback only while `catalog.canonical.write=false`.

---

## 9. Eligibility enforcement transition (AR-B02)

| Flag | Behavior |
|------|----------|
| `booking.eligibility.enforcement=OFF` | Legacy preserved |
| `ON` | Fail-closed; zero rows = DENY |
| Activation | Coverage report required before ON |

---

## 10. Invoice-from-appointment

| Phase | Behavior |
|-------|----------|
| Pre-flag | Legacy (Release 47) |
| Flag on | Invoice from **effective snapshot revision**; never live PriceVersion; fail closed if new appt missing snapshot |
| Backfill | Synthetic snapshots; do not auto-correct historical zero invoice amounts |

---

## 11. Consent / forms

Existing TreatmentPlan consent timestamps remain historical. New PatientFormInstance does not invalidate them.

---

## 12. Rollback / forward-fix

| Strategy | Detail |
|----------|--------|
| Rollback | Disable feature flags; legacy columns authoritative |
| Forward-fix | Retain new tables; no DROP of legacy columns in Phase 48 waves |
| Data loss | Forbidden |
| Destructive remapping | **NO** |

---

## 13. Acceptance statements

```text
destructive remapping = NO
legacy appointment serviceType preserved = YES
legacy ServicePrice preserved = YES
dental codes preserved = YES (nullable historical mapping)
beauty free-text history preserved = YES (nullable historical mapping)
unmatched legacy data = LEGACY_UNMAPPED or AMBIGUOUS
new canonical booking free-text identity = NO
known standard → shared canonical + config + price = YES
rollback/forward-fix = feature-flag rollback + retain new tables
invented historical employee attribution = NO
invented historical commission = NO
existing users commission default = OFF
```

## 14. Inventory usage & commission migration (addendum)

| Case | Strategy |
|------|----------|
| Existing `InventoryConsumptionLog` / `InventoryStockMovement` | Preserve; evolve to InventoryUsageLedger fields when deterministic |
| Unknown historical usedBy | `LEGACY_UNATTRIBUTED` — **never invent** |
| Existing `CommissionRule` / calculations | Preserve as LEGACY-compatible; map to versioned plans carefully |
| Existing users | `commissionEnabled` default **FALSE** |
| Retroactive commission accruals | **Forbidden** unless controlled import with provenance |

```text
invented historical employee attribution = NO
invented historical commission = NO
destructive remapping = NO
```

See `docs/PHASE_48_ARCHITECTURE_REVIEW_ADDENDUM_INVENTORY_COMMISSION.md`.
