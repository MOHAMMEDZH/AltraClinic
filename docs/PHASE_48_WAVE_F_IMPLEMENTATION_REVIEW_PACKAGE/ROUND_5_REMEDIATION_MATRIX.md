# ROUND_5_REMEDIATION_MATRIX

| ID | Blocker | Status | Evidence |
|----|---------|--------|----------|
| R5-PKG-1 | Server-authoritative package basis + currency | CLOSED | TreatmentCourse.packagePriceVersionId → ClinicalServicePriceVersion unitPrice/currency/pricingUnit; client hints equality-only |
| R5-PKG-2 | Concurrent package allocation cap | CLOSED | pg_advisory_xact_lock(tenantId:pkg-alloc:courseId) before post-lock reread |
| R5-PKG-3 | Package RLS app.current_tenant_id | CLOSED | Additive migration 20260820230000; pg_policies + app-role tests |
| R5-BIND | Two-way fail-closed provenance | CLOSED | requireMatchTwoWay + courseSession via appointment relation |
| R5-CSVC | clinicalServiceId TENANT_CUSTOM ownership | CLOSED | Trigger: tenantId IS NULL OR = line.tenantId |
| R5-PKG-CORR | Package allocation + correction | CLOSED | SUPERSEDED prior line reuses same packageAllocationId; cumulative unchanged |
| R5-HYGIENE | git diff --check | CLOSED | Verified at gate |

Migration: `20260820230000_phase48_wave_f_round5_remediation`
Tests: `wave-f-round5.postgres.integration.spec.ts` — 21 PASS
