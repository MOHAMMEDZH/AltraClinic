# Phase 48 Wave A — Commercial Identity Evidence (PA-07)

## Tuple (identical for lock, overlap, effective lookup)

```text
tenantId
branchId | default (null → "default")
clinicalServiceId
pricingUnit
currency (normalized UPPER 3-letter)
serviceVariantId | '' (null → empty)
```

Lock key string:

```text
clinical-price|{tenantId}|{branchId|default}|{clinicalServiceId}|{pricingUnit}|{CURRENCY}|{serviceVariantId|}
```

Lookup requires caller to supply `pricingUnit` + `currency` (+ optional `serviceVariantId`).
Missing/invalid dimensions → deterministic validation failure (no first-row guess).
