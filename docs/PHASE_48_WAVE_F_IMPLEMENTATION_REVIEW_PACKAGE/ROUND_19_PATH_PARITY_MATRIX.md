# Round 19 Path Parity Matrix

Complete-set validation via `assertRealizableRefundEffectsOnRoot` unchanged in scope:

| Path | Validation point | Round 19 impact |
|---|---|---|
| reverseAccrual new create | After insert, before audit | Unchanged order; fixed validator |
| Existing replay | `acceptExistingRootRefundReversal` | Same |
| P2002 recovery | Post-create recovery path | Same |
| Correction old root | Before carry | Same |
| Correction replacement root | After carry | Same |
| Package / COLLECTED_REVENUE | Same service paths | Same |

New-create order preserved: **create reversal → validate full root complete set → audit → commit/return**

Evidence: R19-PG-T1/T2/T3/T5/T6, Round 18-B tests still pass.
