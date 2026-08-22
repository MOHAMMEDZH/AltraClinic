# Round 17 — Canonical Path Parity

All refund reversal paths invoke `assertRealizableRefundEffectSet` via `assertRealizableRefundEffectsOnRoot`:

- `reverseAccrual` (new creation)
- Existing-refund replay (`acceptExistingRootRefundReversal`)
- P2002 recovery (same accept path)
- Correction carry (`carryForwardPriorRefundReversals`)
- Correction replay (same correction event idempotency)

## R17-C carry optimization

Previously: O(n) complete-set validations during carry (transaction timeout at n=125).

Now:
1. One validation on **old root** before carry projection
2. Per-row **identity** validation on new root with `deferCompleteSetValidation: true`
3. One validation on **new root** after all carries

Same fail-closed semantics; creation cannot produce state that carry rejects.

## Tests
- R17-A-T2 replay
- R17-A-T3/T4 correction + replay
- R17-B-T1/T2 invalid planted history on replay/correction
- R17-B-T4 P2002 concurrent on invalid set
