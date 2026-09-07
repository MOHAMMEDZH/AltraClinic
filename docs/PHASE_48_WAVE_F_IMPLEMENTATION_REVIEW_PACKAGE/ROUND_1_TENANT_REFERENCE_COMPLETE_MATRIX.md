# Round 1 Tenant Reference Complete Matrix

Wave F Round 1 expands DB tenant-ref triggers on `commission_accruals` for non-null:
invoiceId, invoiceLineId, paymentId, refundId, appointmentId, branchId, clinicalServiceId, snapshotRevisionId,
plus userId, servicePerformanceId, commissionPlanVersionId, createdBy, reversalOfAccrualId.

Evidence: migration `20260820180000_phase48_wave_f_round1_remediation`, `wave-f-round1.postgres.integration.spec.ts` mixed-parent / parent-switch cases, `ROUND_1_ACCRUAL_APPEND_ONLY_DB_MATRIX.md`.
