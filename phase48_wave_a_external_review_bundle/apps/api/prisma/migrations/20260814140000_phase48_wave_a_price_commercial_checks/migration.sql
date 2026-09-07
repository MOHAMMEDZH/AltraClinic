-- Phase 48 Wave A PA-08: additive commercial CHECK constraints (non-destructive).
-- Does not mutate 20260814010000_phase48_wave_a_clinical_catalog.

ALTER TABLE "clinical_service_price_versions"
  ADD CONSTRAINT "clinical_service_price_versions_unit_price_nonneg_chk"
  CHECK ("unitPrice" >= 0);

ALTER TABLE "clinical_service_price_versions"
  ADD CONSTRAINT "clinical_service_price_versions_tax_percent_range_chk"
  CHECK ("taxPercent" >= 0 AND "taxPercent" <= 100);

ALTER TABLE "clinical_service_price_versions"
  ADD CONSTRAINT "clinical_service_price_versions_currency_iso_chk"
  CHECK (char_length("currency") = 3 AND "currency" = upper("currency"));
