# ROUND_5_PACKAGE_AUTHORITATIVE_BASIS_MATRIX

| Test | Result | Notes |
|------|--------|-------|
| R5-PKG1-T1 | PASS | Basis/currency from `TreatmentCourse.packagePriceVersionId` → `ClinicalServicePriceVersion` |
| R5-PKG1-T2 | PASS | Inflated `packageCommercialBasisAmount` rejected (anti-tamper) |
| R5-PKG1-T3 | PASS | Wrong currency hint rejected |
| R5-PKG1-T4 | PASS | Wrong clinicalServiceId on price version rejected |
| R5-PKG1-T5 | PASS | Missing/orphan price version rejected |
| R5-PKG1-T6 | PASS | `PER_VISIT` (non PER_COURSE/PER_PACKAGE) rejected |
| R5-PKG1-T7 | PASS | Explicit allocation under authoritative basis succeeds |
| R5-PKG1-T8 | PASS | Postgres row stores server-derived basis + currency |

**Authority chain:** `packagePriceVersionId` → ACTIVE version → `unitPrice` + `currency` + `pricingUnit` ∈ {PER_COURSE, PER_PACKAGE}.

**Client fields:** optional equality hints only; not authority.
