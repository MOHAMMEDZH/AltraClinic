import { apiRequest } from '@/lib/api-client';

export interface ClinicalCatalogTranslation {
  locale: string;
  displayName: string;
  shortDescription?: string | null;
  longDescription?: string | null;
}

export interface ClinicalCatalogService {
  id: string;
  stableKey: string;
  provenance: string;
  domain: string;
  categoryKey: string | null;
  defaultDurationMin: number | null;
  lifecycle: string;
  tenantId: string | null;
  translations: ClinicalCatalogTranslation[];
  createdAt: string;
  updatedAt: string;
}

export interface TenantServiceConfig {
  id: string;
  tenantId: string;
  clinicalServiceId: string;
  branchId: string | null;
  enabled: boolean;
  defaultDurationOverride: number | null;
  requiresResourceTypes: string[];
  bookingVisibleOnPortal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalPriceVersion {
  id: string;
  tenantId: string;
  branchId: string | null;
  clinicalServiceId: string;
  serviceVariantId: string | null;
  pricingUnit: string;
  currency: string;
  unitPrice: string | number;
  taxPercent: string | number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantClinicalServiceInput {
  stableKey: string;
  domain?: string;
  translations: ClinicalCatalogTranslation[];
}

export interface UpsertTenantServiceConfigInput {
  clinicalServiceId: string;
  enabled?: boolean;
}

export interface CreateClinicalPriceDraftInput {
  clinicalServiceId: string;
  currency: string;
  unitPrice: number;
  taxPercent?: number;
  effectiveFrom: string;
}

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

export async function fetchClinicalServices(
  token: string,
  tenantId: string,
  query: { lifecycle?: string; provenance?: string; search?: string } = {},
) {
  return apiRequest<ClinicalCatalogService[]>(`/clinical-catalog/services${qs(query)}`, {
    token,
    tenantId,
  });
}

export async function createTenantClinicalServiceDraft(
  token: string,
  tenantId: string,
  body: CreateTenantClinicalServiceInput,
) {
  return apiRequest<ClinicalCatalogService>('/clinical-catalog/services', {
    method: 'POST',
    token,
    tenantId,
    body: {
      provenance: 'TENANT_CUSTOM',
      stableKey: body.stableKey,
      domain: body.domain,
      translations: body.translations,
    },
  });
}

export async function publishClinicalService(token: string, tenantId: string, serviceId: string) {
  return apiRequest<ClinicalCatalogService>(
    `/clinical-catalog/services/${encodeURIComponent(serviceId)}/publish`,
    { method: 'POST', token, tenantId },
  );
}

export async function fetchTenantServiceConfigs(
  token: string,
  tenantId: string,
  query: { clinicalServiceId?: string } = {},
) {
  return apiRequest<TenantServiceConfig[]>(`/clinical-catalog/configs${qs(query)}`, {
    token,
    tenantId,
  });
}

export async function upsertTenantServiceConfig(
  token: string,
  tenantId: string,
  body: UpsertTenantServiceConfigInput,
) {
  return apiRequest<TenantServiceConfig>('/clinical-catalog/configs', {
    method: 'PUT',
    token,
    tenantId,
    body,
  });
}

export async function fetchClinicalPriceVersions(
  token: string,
  tenantId: string,
  query: { clinicalServiceId?: string; status?: string } = {},
) {
  return apiRequest<ClinicalPriceVersion[]>(`/clinical-catalog/prices${qs(query)}`, {
    token,
    tenantId,
  });
}

export async function createClinicalPriceDraft(
  token: string,
  tenantId: string,
  body: CreateClinicalPriceDraftInput,
) {
  return apiRequest<ClinicalPriceVersion>('/clinical-catalog/prices/drafts', {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function publishClinicalPriceVersion(
  token: string,
  tenantId: string,
  priceVersionId: string,
) {
  return apiRequest<ClinicalPriceVersion>(
    `/clinical-catalog/prices/${encodeURIComponent(priceVersionId)}/publish`,
    { method: 'POST', token, tenantId, body: {} },
  );
}
