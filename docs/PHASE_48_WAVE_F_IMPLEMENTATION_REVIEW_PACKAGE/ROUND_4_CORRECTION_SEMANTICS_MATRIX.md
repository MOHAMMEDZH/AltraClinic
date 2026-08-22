# R4-F4A Correction Semantics

- Identity: correctionEventId (not refundId)
- Reverse: full remaining via reverseAccrualForCorrection
- Replacement: replacementInvoiceLineId (stale SUPERSEDED)
- Atomicity: single withPlatformBypass transaction