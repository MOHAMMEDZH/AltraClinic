# Round 15 — Historical Upgrade Contract

## Chosen strategy: ZERO-HISTORY FAIL-FAST

**Justification:** Wave F Round 14–15 worktree is uncommitted/unpushed and not authorized for production deployment. Authoritative upgrade path is a Wave-E baseline plus Wave F migrations with **no** pre-lineage correction events. Fabricating lineage is forbidden.

## Precondition query (migration)

Distinct `(tenantId, correctionEventId)` on `commission_accruals` where `correctionEventId IS NOT NULL` and no matching `commission_correction_lineages` row — if count > 0, RAISE with exact counts.

## Runtime guard

If lineage missing but any accrual exists for `correctionEventId` in tenant → `BadRequestException` fail closed (no lineage/reversal/repost/carry/audit/line mutation).

## Proof

- Clean deploy: PASS
- Upgrade through R14 with zero history then R15: PASS
- Seeded orphan → migrate deploy fails with `zero-history`: `PHASE48_WAVE_F_UPGRADE_HISTORICAL_NEGATIVE_PASSED`
- R15-C-T5…T8 runtime/concurrency/rollback PASS
