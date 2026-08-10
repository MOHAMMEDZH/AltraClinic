import { apiRequest } from '@/lib/api-client';

export interface ApiCredentialMetadata {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  prefix: string;
  status: string;
  scopes: readonly string[];
  ownerType: 'user' | 'service_account';
  ownerId: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string;
  rotatedFromId: string | null;
  rotationGraceEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  source?: string;
}

export interface ServiceAccountRow {
  id: string;
  tenantId: string;
  displayName: string;
  status: string;
  roleBindings: readonly string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

export interface WebhookSubscriptionRow {
  id: string;
  tenantId: string;
  name: string;
  targetUrl?: string;
  url?: string;
  eventFilters?: readonly string[];
  events?: readonly string[];
  status: string;
  secretReferenceId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface WebhookDeliveryRow {
  id: string;
  tenantId: string;
  subscriptionId: string;
  eventType?: string;
  status: string;
  attemptCount?: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt?: string;
  deadLetteredAt?: string | null;
}

export interface IntegrationsOpsDashboard {
  phase: string;
  generatedAt: string;
  featureFlag: {
    name: string;
    enabled: boolean;
    flags: Record<string, boolean>;
  };
  license: {
    allowIntegrations: boolean;
    capabilities: readonly string[];
  };
  readiness: {
    pepperReady: boolean;
    secretStoreReady: boolean;
    configValid: boolean;
    visible: boolean;
    dormant: boolean;
  };
  credentialCounts: Record<string, number>;
  serviceAccountCounts: Record<string, number>;
  webhookCounts: Record<string, number>;
  queue: Record<string, unknown>;
  gateway: Record<string, unknown> | null;
  usage: {
    tenantId: string;
    totals: Record<string, number>;
    byCredential: Record<string, Record<string, number>>;
    byServiceAccount: Record<string, Record<string, number>>;
    byEndpoint: Record<string, Record<string, number>>;
    recent: readonly Record<string, unknown>[];
  } | null;
  providers: readonly { key: string; displayName: string; direction: string; adapterKind: string }[];
  catalog: { staticCount: number; scopeCount: number };
  migrationStatus: string;
}

export async function fetchIntegrationsHealth(token: string, tenantId: string) {
  return apiRequest<Record<string, unknown>>('/integrations/health', {
    token,
    tenantId,
  });
}

export async function fetchOpsDashboard(token: string, tenantId: string) {
  return apiRequest<IntegrationsOpsDashboard>('/integrations/ops/dashboard', {
    token,
    tenantId,
  });
}

export async function fetchOpsScopes(token: string, tenantId: string) {
  return apiRequest<{ scopes: readonly { id: string; description?: string }[]; ids: string[] }>(
    '/integrations/ops/scopes',
    { token, tenantId },
  );
}

export async function fetchOpsProviders(token: string, tenantId: string) {
  return apiRequest<{
    runtime: readonly Record<string, unknown>[];
    staticCatalog: readonly Record<string, unknown>[];
    staticIsRuntimeAuthority: boolean;
  }>('/integrations/ops/providers', { token, tenantId });
}

export async function fetchOpsPermissions(token: string, tenantId: string) {
  return apiRequest<{ resource: string; actions: Record<string, string> }>(
    '/integrations/ops/permissions',
    { token, tenantId },
  );
}

export async function fetchOpsConfiguration(token: string, tenantId: string) {
  return apiRequest<Record<string, unknown>>('/integrations/ops/configuration', {
    token,
    tenantId,
  });
}

export async function fetchOpsMetricsCatalog(token: string, tenantId: string) {
  return apiRequest<{
    metrics: string[];
    activityEvents: string[];
    auditActions: string[];
  }>('/integrations/ops/metrics-catalog', { token, tenantId });
}

export async function listCredentials(token: string, tenantId: string) {
  return apiRequest<{ credentials: ApiCredentialMetadata[] }>(
    '/integrations/credentials',
    { token, tenantId },
  );
}

export async function getCredential(token: string, tenantId: string, id: string) {
  return apiRequest<{ credential: ApiCredentialMetadata }>(
    `/integrations/credentials/${id}`,
    { token, tenantId },
  );
}

export async function createCredential(
  token: string,
  tenantId: string,
  body: {
    name: string;
    scopes: string[];
    ownerType?: 'user' | 'service_account';
    ownerId?: string;
    expiresAt?: string | null;
    integrationBound?: boolean;
  },
) {
  return apiRequest<{ credential: ApiCredentialMetadata; key: string }>(
    '/integrations/credentials',
    { method: 'POST', token, tenantId, body },
  );
}

export async function rotateCredential(token: string, tenantId: string, id: string) {
  return apiRequest<{ credential: ApiCredentialMetadata; key: string }>(
    `/integrations/credentials/${id}/rotate`,
    { method: 'POST', token, tenantId, body: {} },
  );
}

export async function revokeCredential(
  token: string,
  tenantId: string,
  id: string,
  reason?: string,
) {
  return apiRequest<{ credential: ApiCredentialMetadata }>(
    `/integrations/credentials/${id}`,
    { method: 'DELETE', token, tenantId, body: { reason } },
  );
}

export async function expireCredentials(token: string, tenantId: string) {
  return apiRequest<{ expired: number; graceRevoked: number }>(
    '/integrations/credentials/ops/expire',
    { method: 'POST', token, tenantId, body: {} },
  );
}

export async function listServiceAccounts(token: string, tenantId: string) {
  return apiRequest<{ serviceAccounts: ServiceAccountRow[] }>(
    '/integrations/service-accounts',
    { token, tenantId },
  );
}

export async function createServiceAccount(
  token: string,
  tenantId: string,
  body: { displayName: string; roleBindings?: string[] },
) {
  return apiRequest<{ serviceAccount: ServiceAccountRow }>(
    '/integrations/service-accounts',
    { method: 'POST', token, tenantId, body },
  );
}

export async function disableServiceAccount(
  token: string,
  tenantId: string,
  id: string,
) {
  return apiRequest<{ serviceAccount: ServiceAccountRow }>(
    `/integrations/service-accounts/${id}/disable`,
    { method: 'POST', token, tenantId, body: {} },
  );
}

export async function listWebhookSubscriptions(token: string, tenantId: string) {
  return apiRequest<{ subscriptions: WebhookSubscriptionRow[] }>(
    '/integrations/webhooks/subscriptions',
    { token, tenantId },
  );
}

export async function createWebhookSubscription(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<{ subscription: WebhookSubscriptionRow; secret?: string }>(
    '/integrations/webhooks/subscriptions',
    { method: 'POST', token, tenantId, body },
  );
}

export async function enableWebhookSubscription(
  token: string,
  tenantId: string,
  id: string,
) {
  return apiRequest(`/integrations/webhooks/subscriptions/${id}/enable`, {
    method: 'POST',
    token,
    tenantId,
    body: {},
  });
}

export async function disableWebhookSubscription(
  token: string,
  tenantId: string,
  id: string,
) {
  return apiRequest(`/integrations/webhooks/subscriptions/${id}/disable`, {
    method: 'POST',
    token,
    tenantId,
    body: {},
  });
}

export async function rotateWebhookSecret(
  token: string,
  tenantId: string,
  id: string,
) {
  return apiRequest<{ secret?: string; version?: number }>(
    `/integrations/webhooks/subscriptions/${id}/rotate-secret`,
    { method: 'POST', token, tenantId, body: {} },
  );
}

export async function deleteWebhookSubscription(
  token: string,
  tenantId: string,
  id: string,
) {
  return apiRequest(`/integrations/webhooks/subscriptions/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function listWebhookDeliveries(token: string, tenantId: string) {
  return apiRequest<{ deliveries: WebhookDeliveryRow[] }>(
    '/integrations/webhooks/deliveries',
    { token, tenantId },
  );
}

export async function listWebhookAttempts(
  token: string,
  tenantId: string,
  deliveryId: string,
) {
  return apiRequest<{ attempts: readonly Record<string, unknown>[] }>(
    `/integrations/webhooks/deliveries/${deliveryId}/attempts`,
    { token, tenantId },
  );
}

export async function retryWebhookDelivery(
  token: string,
  tenantId: string,
  deliveryId: string,
) {
  return apiRequest(`/integrations/webhooks/deliveries/${deliveryId}/retry`, {
    method: 'POST',
    token,
    tenantId,
    body: {},
  });
}

export async function replayWebhookDelivery(
  token: string,
  tenantId: string,
  deliveryId: string,
) {
  return apiRequest(`/integrations/webhooks/deliveries/${deliveryId}/replay`, {
    method: 'POST',
    token,
    tenantId,
    body: {},
  });
}

export async function fetchWebhookDiagnostics(token: string, tenantId: string) {
  return apiRequest<Record<string, unknown>>(
    '/integrations/webhooks/diagnostics',
    { token, tenantId },
  );
}

export async function fetchGatewayDiagnostics(token: string, tenantId: string) {
  return apiRequest<Record<string, unknown>>(
    `/integrations/gateway/diagnostics?tenantId=${encodeURIComponent(tenantId)}`,
    { token, tenantId },
  );
}

export async function fetchGatewayQuotas(token: string, tenantId: string) {
  return apiRequest<Record<string, unknown>>('/integrations/gateway/quotas', {
    token,
    tenantId,
  });
}

export async function fetchGatewayUsage(token: string, tenantId: string) {
  return apiRequest<Record<string, unknown>>(
    `/integrations/gateway/usage?tenantId=${encodeURIComponent(tenantId)}`,
    { token, tenantId },
  );
}

export async function resetGatewayQuotas(
  token: string,
  tenantId: string,
  keyPrefix?: string,
) {
  return apiRequest('/integrations/gateway/quotas/reset', {
    method: 'POST',
    token,
    tenantId,
    body: { keyPrefix },
  });
}
