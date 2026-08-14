import type {
  ClinicalPricingUnit,
  ClinicalServiceDomain,
  ClinicalServiceProvenance,
} from '@prisma/client';

export interface TranslationInputDto {
  locale: string;
  displayName: string;
  shortDescription?: string | null;
  longDescription?: string | null;
}

export interface CreateClinicalServiceDraftDto {
  provenance: ClinicalServiceProvenance;
  stableKey: string;
  domain?: ClinicalServiceDomain;
  categoryKey?: string | null;
  defaultDurationMin?: number | null;
  translations: TranslationInputDto[];
}

export interface UpdateClinicalServiceDraftDto {
  stableKey?: string;
  domain?: ClinicalServiceDomain;
  categoryKey?: string | null;
  defaultDurationMin?: number | null;
  translations?: TranslationInputDto[];
}

export interface UpsertTenantServiceConfigDto {
  clinicalServiceId: string;
  branchId?: string | null;
  enabled?: boolean;
  defaultDurationOverride?: number | null;
  requiresResourceTypes?: string[];
  bookingVisibleOnPortal?: boolean;
}

export interface CreateClinicalPriceDraftDto {
  clinicalServiceId: string;
  branchId?: string | null;
  serviceVariantId?: string | null;
  pricingUnit?: ClinicalPricingUnit;
  currency: string;
  unitPrice: number;
  taxPercent?: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface PublishClinicalPriceDto {
  reason?: string | null;
}
