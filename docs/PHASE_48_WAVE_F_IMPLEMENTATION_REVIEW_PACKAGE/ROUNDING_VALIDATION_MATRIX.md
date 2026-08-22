# Rounding Validation Matrix

| Rule | Implementation |
|------|----------------|
| Half-up to 2 minor units | `roundMoney` ROUND_HALF_UP |
| Multi-share residual | `splitByShares` last participant |
| Storage | Decimal(18,4) / Decimal(5,2) — no float |
| Unit tests | wave-f-money.unit.spec.ts |
