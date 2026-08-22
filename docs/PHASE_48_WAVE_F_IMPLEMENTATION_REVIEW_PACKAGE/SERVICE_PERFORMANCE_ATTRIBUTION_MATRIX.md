# Service Performance Attribution Matrix

| Rule | Result |
|------|--------|
| Attribution source | ServicePerformanceParticipant only |
| Appointment.providerId | never auto-attributes |
| COMPLETED required to post | yes |
| Share sum ≤ 100% | enforced |
| Multi-participant residual | last share gets residual (deterministic) |
| Inactive / missing user | fail closed |
| commissionEnabled false participant | skipped |
