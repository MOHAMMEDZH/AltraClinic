import { apiRequest } from '@/lib/api-client';

export interface SettingsOverview {
  setupProgress: number;
  health: 'good' | 'attention' | 'critical';
  alerts: Array<{ id: string; severity: string; messageKey: string; route?: string }>;
  counts: { branches: number; users: number; departments: number };
  recentChanges: Array<{ at: string; sections: string[] }>;
  tenant: {
    name: string;
    timezone: string;
    locale: string;
    hasBranding: boolean;
    hasClinicProfile: boolean;
  };
}

export interface BranchRecord {
  id: string;
  name: string;
  nameAr?: string | null;
  city?: string | null;
  isActive: boolean;
  phone: string | null;
  address: string | null;
  regionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  timezone: string;
  locale: string;
  dataRetentionDays: number;
  clinicProfile: Record<string, unknown>;
  branding: Record<string, unknown>;
  moduleFlags: Record<string, boolean>;
  billingSettings: Record<string, unknown>;
  inventorySettings: Record<string, unknown>;
  securityPolicy: Record<string, unknown>;
  auditSettings: Record<string, unknown>;
  reportSettings: Record<string, unknown>;
  notificationSettings: Record<string, unknown>;
  integrationSettings: Record<string, unknown>;
  developerSettings: Record<string, unknown>;
  advancedSettings: Record<string, unknown>;
  localizationSettings: Record<string, unknown>;
  branches: BranchRecord[];
  updatedAt: string;
}

export interface BillingSequence {
  id: string;
  prefix: string;
  lastNumber: number;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  scopes: string[];
}

export async function fetchSettingsOverview(token: string, tenantId: string) {
  return apiRequest<SettingsOverview>('/settings/overview', { token, tenantId });
}

export async function fetchTenantSettings(token: string, tenantId: string) {
  return apiRequest<TenantSettings>('/settings/tenant', { token, tenantId });
}

export async function updateTenantSettings(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<TenantSettings>('/settings/tenant', {
    method: 'PATCH',
    token,
    tenantId,
    body,
  });
}

export async function fetchSettingsBranches(token: string, tenantId: string) {
  return apiRequest<BranchRecord[]>('/settings/branches', { token, tenantId });
}

export async function createSettingsBranch(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<BranchRecord>('/settings/branches', {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function updateSettingsBranch(
  token: string,
  tenantId: string,
  branchId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<BranchRecord>(`/settings/branches/${branchId}`, {
    method: 'PATCH',
    token,
    tenantId,
    body,
  });
}

export async function archiveSettingsBranch(token: string, tenantId: string, branchId: string) {
  return apiRequest<{ id: string; isActive: boolean }>(`/settings/branches/${branchId}/archive`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function fetchBillingSequences(token: string, tenantId: string) {
  return apiRequest<BillingSequence[]>('/settings/billing/sequences', { token, tenantId });
}

export async function updateBillingSequences(
  token: string,
  tenantId: string,
  sequences: Array<{ prefix: string; lastNumber?: number }>,
) {
  return apiRequest<BillingSequence[]>('/settings/billing/sequences', {
    method: 'PATCH',
    token,
    tenantId,
    body: { sequences },
  });
}

export async function fetchApiKeys(token: string, tenantId: string) {
  return apiRequest<ApiKeySummary[]>('/settings/developer/api-keys', { token, tenantId });
}

export async function createApiKey(token: string, tenantId: string, name: string) {
  return apiRequest<{ id: string; name: string; prefix: string; key: string; createdAt: string }>(
    '/settings/developer/api-keys',
    { method: 'POST', token, tenantId, body: { name } },
  );
}

export async function revokeApiKey(token: string, tenantId: string, keyId: string) {
  return apiRequest<{ revoked: boolean }>(`/settings/developer/api-keys/${keyId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function fetchIdentityFeatures(token: string, tenantId: string) {
  return apiRequest<Record<string, boolean>>('/identity/features', { token, tenantId });
}

export async function fetchSettingsStatus(token: string, tenantId: string) {
  return apiRequest<{ maintenanceMode: boolean; mfaRequired: boolean }>('/settings/status', { token, tenantId });
}

export async function testIntegrationWebhook(token: string, tenantId: string) {
  return apiRequest<{ ok: boolean; statusCode: number; url: string; message?: string }>(
    '/settings/integrations/webhooks/test',
    { method: 'POST', token, tenantId },
  );
}
