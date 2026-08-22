# Wave F Open Architecture Questions

## Status

**No blocking ambiguity** for the authorized first-wave scope.

Frozen documents define:

- calculation basis default (`SERVICE_NET_AFTER_DISCOUNT`)
- earning trigger (`INVOICE_OR_CHARGE_FINALIZED`)
- refund full/partial reversal
- performer SoR (`ServicePerformanceParticipant`)
- plan versioning / no historical recalculation
- rounding (minor-unit half-up)
- first wave = user default plans (overrides extension-ready)

## Deferred / extension-ready (documented, not invented)

| Topic | Handling |
|-------|----------|
| Branch/service-specific plan overrides | Schema fields optional; resolution precedence documented; first wave ships user-default resolution only |
| Multi-currency conversion policy | Fail closed on currency mismatch (frozen) |
| Full payroll / statutory tax | Out of scope |

## Residual rounding (implementation of frozen requirement)

Frozen QA requires deterministic residual handling for multi-participant splits. Wave F assigns half-up amounts to participants in stable `userId` order and applies any 1-minor-unit residual to the last participant so attributed commission sums exactly to the performance commission pool.
