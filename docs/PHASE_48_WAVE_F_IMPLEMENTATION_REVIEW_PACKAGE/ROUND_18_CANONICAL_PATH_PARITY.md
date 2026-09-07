# Round 18 Canonical Path Parity

| Path | Complete-set validation |
|------|-------------------------|
| reverseAccrual new create | **Yes** — after insert, before audit (R18-B) |
| reverseAccrual replay | Yes — acceptExistingRootRefundReversal |
| P2002 recovery | Yes — same accept path |
| carryForwardPriorRefundReversals | Yes — old root once, new root once after batch |
| correctAndRepost carry | Yes — defer during batch, final on replacement root |

Call sites: `commission-accrual.service.ts` — `assertRealizableRefundEffectsOnRoot`, `acceptExistingRootRefundReversal`.
