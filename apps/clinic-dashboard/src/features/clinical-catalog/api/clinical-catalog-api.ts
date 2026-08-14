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

export type ClinicalCatalogListScope = 'tenant' | 'branch' | 'all';

export interface CreateTenantClinicalServiceInput {
  stableKey: string;
  domain?: string;
  translations: ClinicalCatalogTranslation[];
}

export interface UpsertTenantServiceConfigInput {
  clinicalServiceId: string;
  branchId?: string | null;
  enabled?: boolean;
  defaultDurationOverride?: number | null;
  bookingVisibleOnPortal?: boolean;
}

export interface CreateClinicalPriceDraftInput {
  clinicalServiceId: string;
  branchId?: string | null;
  serviceVariantId?: string | null;
  pricingUnit?: string;
  currency: string;
  unitPrice: number;
  taxPercent?: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface ClinicalPriceListQuery {
  clinicalServiceId?: string;
  /** Required explicit scope — never omit to mean "all". */
  scope: ClinicalCatalogListScope;
  branchId?: string | null;
  status?: string;
}

export interface ClinicalConfigListQuery {
  clinicalServiceId?: string;
  scope: ClinicalCatalogListScope;
  branchId?: string | null;
}

function qs(params: Record<string, string | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** Normalize tenant-default upsert: omit branchId key for tenant default. */
export function buildConfigUpsertPayload(input: UpsertTenantServiceConfigInput) {
  const body: Record<string, unknown> = {
    clinicalServiceId: input.clinicalServiceId,
  };
  if (input.branchId) {
    body.branchId = input.branchId;
  }
  if (input.enabled !== undefined) body.enabled = input.enabled;
  if (input.defaultDurationOverride !== undefined) {
    body.defaultDurationOverride = input.defaultDurationOverride;
  }
  if (input.bookingVisibleOnPortal !== undefined) {
    body.bookingVisibleOnPortal = input.bookingVisibleOnPortal;
  }
  return body;
}

export function buildPriceDraftPayload(input: CreateClinicalPriceDraftInput) {
  const body: Record<string, unknown> = {
    clinicalServiceId: input.clinicalServiceId,
    currency: input.currency,
    unitPrice: input.unitPrice,
    taxPercent: input.taxPercent ?? 0,
    effectiveFrom: input.effectiveFrom,
    pricingUnit: input.pricingUnit ?? 'PER_VISIT',
  };
  if (input.branchId) {
    body.branchId = input.branchId;
  }
  if (input.serviceVariantId) {
    body.serviceVariantId = input.serviceVariantId;
  }
  if (input.effectiveTo) {
    body.effectiveTo = input.effectiveTo;
  }
  return body;
}

/** Explicit list query — tenant scope never relies on omitted branchId. */
export function buildPriceListQueryParams(query: ClinicalPriceListQuery): Record<string, string> {
  const params: Record<string, string> = { scope: query.scope };
  if (query.clinicalServiceId) params.clinicalServiceId = query.clinicalServiceId;
  if (query.status) params.status = query.status;
  if (query.scope === 'branch') {
    if (!query.branchId) {
      throw new Error('branchId required when scope=branch');
    }
    params.branchId = query.branchId;
  }
  return params;
}

export function buildConfigListQueryParams(query: ClinicalConfigListQuery): Record<string, string> {
  const params: Record<string, string> = { scope: query.scope };
  if (query.clinicalServiceId) params.clinicalServiceId = query.clinicalServiceId;
  if (query.scope === 'branch') {
    if (!query.branchId) {
      throw new Error('branchId required when scope=branch');
    }
    params.branchId = query.branchId;
  }
  return params;
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
  query: ClinicalConfigListQuery,
) {
  return apiRequest<TenantServiceConfig[]>(
    `/clinical-catalog/configs${qs(buildConfigListQueryParams(query))}`,
    { token, tenantId },
  );
}

export async function fetchEffectiveTenantServiceConfig(
  token: string,
  tenantId: string,
  clinicalServiceId: string,
  branchId?: string | null,
) {
  return apiRequest<{ scope: 'branch' | 'tenant'; config: TenantServiceConfig }>(
    `/clinical-catalog/configs/effective${qs({
      clinicalServiceId,
      branchId: branchId ?? undefined,
    })}`,
    { token, tenantId },
  );
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
    body: buildConfigUpsertPayload(body),
  });
}

export async function fetchClinicalPriceVersions(
  token: string,
  tenantId: string,
  query: ClinicalPriceListQuery,
) {
  return apiRequest<ClinicalPriceVersion[]>(
    `/clinical-catalog/prices${qs(buildPriceListQueryParams(query))}`,
    { token, tenantId },
  );
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
    body: buildPriceDraftPayload(body),
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

export async function inactivateClinicalPriceVersion(
  token: string,
  tenantId: string,
  priceVersionId: string,
) {
  return apiRequest<ClinicalPriceVersion>(
    `/clinical-catalog/prices/${encodeURIComponent(priceVersionId)}/inactivate`,
    { method: 'POST', token, tenantId, body: {} },
  );
}

export async function replaceScheduledClinicalPriceVersion(
  token: string,
  tenantId: string,
  canceledScheduleId: string,
  replacementDraftId: string,
) {
  return apiRequest<ClinicalPriceVersion>(
    `/clinical-catalog/prices/${encodeURIComponent(canceledScheduleId)}/replace-scheduled`,
    {
      method: 'POST',
      token,
      tenantId,
      body: { replacementDraftId },
    },
  );
}
