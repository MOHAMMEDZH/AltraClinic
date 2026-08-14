-- Phase 48 Wave A PA-04: additive SCHEDULED status for future-effective published prices.
-- Preserves append-only commercial history while keeping ACTIVE ranges non-overlapping.

ALTER TYPE "ClinicalPriceVersionStatus" ADD VALUE 'SCHEDULED';
