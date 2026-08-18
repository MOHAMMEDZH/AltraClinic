# Inventory Accountability Validation (Round 9)

## Frozen P0-10 authority

- `docs/PHASE_48_ARCHITECTURE_FREEZE.md` §5: every human-driven stock-affecting event has an accountable human; department-only = forbidden.
- `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`: wastage/damage/expired/sample without accountable human → reject; clinical without usedBy → reject; operational department-only → reject; correction/reversal without actor → reject.
- `docs/PHASE_48_INVENTORY_USAGE_ACCOUNTABILITY_ARCHITECTURE.md` §4 (INV-B01 type table): CLINICAL `usedByUserId` required; OPERATIONAL/WASTAGE/DAMAGE/SAMPLE `responsibleUserId` required; EXPIRED accountable/approving user required; CORRECTION correcting user required; REVERSAL reversal actor required.

Wave C maps the accountable human onto ledger `usedByUserId` (no separate `responsibleUserId` column). Recorder (`recordedByUserId`) is never substituted.

## Exact accountable-required types

Canonical `ACCOUNTABLE_REQUIRED` in `inventory-usage-posting.service.ts`:

- CLINICAL_CONSUMPTION
- OPERATIONAL_CONSUMPTION
- WASTAGE
- DAMAGE
- EXPIRED
- SAMPLE_OR_PROMOTIONAL
- CORRECTION

REVERSAL is not client-posted; `reverseUsage` requires the reversal actor (`recordedByUserId`).

## Canonical validation

Missing `usedByUserId` → `BadRequestException` **before** stock / ledger / audit mutation.

Disposal: `usedByUserId` is a required DTO/handler field. Authenticated `disposedBy` is recorder only.

## Round 9 stock-request OPERATIONAL_CONSUMPTION caller

The remaining Round 8 defect was **not** the posting service. `FulfillStockRequestLineHandler` previously set `usedByUserId: actor` from the authenticated fulfiller.

Round 9:

- HTTP body requires explicit `usedByUserId`
- handler `recordedByUserId = fulfilledBy` (auth)
- handler `usedByUserId = input.usedByUserId` (validated body)
- no recorder fallback on this caller

See `STOCK_REQUEST_ACCOUNTABILITY_VALIDATION.md`.

## attributionStatus rules

- New runtime posts with valid usedBy → `ATTRIBUTED`
- No new `LEGACY_UNATTRIBUTED` runtime writes
- Historical legacy rows remain readable (C-INV-34)

## Missing-usedBy results (`wave-c-inventory-accountability`)

| Type | Result | Stock | Ledger | Audit | Disposal log / stock-request |
|------|--------|-------|--------|-------|------------------------------|
| WASTAGE | reject | unchanged | 0 new | 0 new | 0 new |
| DAMAGE | reject | unchanged | 0 new | 0 new | 0 new |
| EXPIRED | reject | unchanged | 0 new | 0 new | 0 new |
| SAMPLE_OR_PROMOTIONAL | reject | unchanged | 0 new | 0 new | 0 new |
| CLINICAL_CONSUMPTION | reject | unchanged | 0 new | 0 new | 0 new |
| OPERATIONAL_CONSUMPTION (posting) | reject | unchanged | 0 new | 0 new | 0 new |
| OPERATIONAL_CONSUMPTION (stock-request fulfill) | reject | unchanged | 0 new | 0 new | line/status unchanged |
| CORRECTION (replacement) | reject | unchanged | 0 new | 0 new | 0 new |
| dispose without usedBy | reject | unchanged | 0 new | 0 new | 0 new |

## Success results

Same-tenant `usedByUserId` succeeds for WASTAGE/DAMAGE/EXPIRED/SAMPLE. Usage row `usedByUserId` matches the explicit accountable user, not recorder. Disposal with explicit usedBy succeeds; `usedBy` ≠ `recordedBy` when they differ. Stock-request fulfill with distinct usedBy persists independent recorder/usedBy on the OPERATIONAL_CONSUMPTION ledger row.

## Legacy behavior

`LEGACY_UNATTRIBUTED` is migration/backfill only. C-INV-34 still proves a historical SQL-inserted legacy row remains readable.
