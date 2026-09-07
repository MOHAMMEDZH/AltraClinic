# Phase 48 Wave C — External Production Acceptance Precheck

```text
production DB = FORBIDDEN for Wave C implementation / validators
acceptance environment = localhost:5433 test Postgres only
```

## Preconditions

1. Wave B accepted at `ec084dd` (or later accepted SHA)
2. No ACR required for AR-09/10/11/18/19/20 as frozen
3. Migration is additive / non-destructive (`inventory_consumption_logs` table name preserved)
4. Historical `usedByUserId` null → `LEGACY_UNATTRIBUTED` only; no fabricated signatures
5. Clean + upgrade validators park correctly relative to Wave A/B chains

## Blockers if missing

- Test Postgres not available → integration packs SKIP / NOT EXECUTED
- Permission matrices out of sync → permission-routes validator FAIL
- Wave B upgrade not parking Wave C → ordering risk in upgrade script

## Sign-off checklist (external)

- [ ] Clean validator PASS
- [ ] Upgrade validator PASS
- [ ] Permission routes PASS
- [ ] Consent / inventory / injectable / migration packs PASS or explicitly waivable with evidence
- [ ] No production credentials used
