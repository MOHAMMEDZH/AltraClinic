# COURSE_PACKAGE_WORKFORCE_COMMERCIAL_MATRIX (Round 6)

Frozen: allocate per session/performance share via **explicit allocation** at post.

## Round 5 authority (preserved)
- Package commercial basis + currency are **server-derived** from `TreatmentCourse.packagePriceVersionId` → bound `ClinicalServicePriceVersion`.
- Client basis/currency hints are optional anti-tamper equality only.
- Cumulative cap serialized with `pg_advisory_xact_lock(tenantId:pkg-alloc:courseId)` + post-lock reread.
- RLS uses `app.current_tenant_id` (+ platform bypass).
- Correction reuses the same `packageAllocationId` when prior invoice line is SUPERSEDED.

## Round 6 additions
- **COLLECTED_REVENUE** path resolves the same package allocation and caps attributed revenue ≤ `allocatedRevenueAmount` (payment + package caps); no invoice+collected double-earn on same allocation.
- Package/invoice(/payment-inherited) **currency parity** required; mismatch fail-closed; no FX.
- Provenance chain: course patient = performance patient; session appointment requires matching performance appointment; `invoiceLineId` must prove SP + courseSession.
- Bound price version remains usable when **SUPERSEDED**; DRAFT rejected; no silent reprice to current ACTIVE.

Fail-closed when course context present without allocation.
No duplicate TreatmentCourse/CourseSession/ledger.
