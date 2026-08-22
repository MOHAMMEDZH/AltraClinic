# ROUND_9_SEQUENTIAL_CORRECTION_LINEAGE_PROOF

## Successor key design

When `correctionEventId` is present:

```
earn:{performanceId}:{participantId}:{invoiceLineId}:corr:{correctionEventId}
earn_pay:{performanceId}:{participantId}:{invoiceLineId}:{paymentId}:corr:{correctionEventId}
```

Non-correction posting retains `earn:…` / `earn:…:after:{priorId}`.

Unique-conflict path validates tenant/performance/participant/line/event (and payment for collected). Fully reversed `:after:` predecessor for a **new** non-correction post fails closed (R9-D-T7).

## Results

| Test | Outcome |
|------|---------|
| R9-D-T1 | Correction 2 creates new open successor ≠ correction 1; net 1000.00 |
| R9-D-T2 | Three sequential corrections → exactly one open successor |
| R9-D-T3 | Two participants each get one successor per event |
| R9-D-T4 | Same `packageAllocationId`; net attributed 1000.00 |
| R9-D-T5 | Replay event2 returns same successor ids; zero new rows |
| R9-D-T6 | Concurrent events: winner ACTIVE line matches open economics; loser defined conflict |
| R9-D-T7 | Stale fully reversed `:after:` successor rejected |
