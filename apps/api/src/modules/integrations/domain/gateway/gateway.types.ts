/**
 * Phase 44d — Gateway principal + auth result types (OD-AUTHN).
 */

export type IntegrationsAuthRejectionReason =
  | 'missing_credential'
  | 'invalid_prefix'
  | 'jwt_not_api_key'
  | 'feature_disabled'
  | 'pepper_missing'
  | 'license_denied'
  | 'not_found'
  | 'hash_mismatch'
  | 'revoked'
  | 'expired'
  | 'not_eligible'
  | 'service_account_disabled'
  | 'scope_denied'
  | 'quota_exceeded'
  | 'tenant_mismatch';

export type IntegrationsCredentialSource = 'bearer' | 'x_api_key';

export interface IntegrationsGatewayPrincipal {
  kind: 'integrations_api_key';
  tenantId: string;
  branchId: string | null;
  credentialId: string;
  credentialPrefix: string;
  ownerType: 'user' | 'service_account';
  ownerId: string;
  serviceAccountId: string | null;
  scopes: readonly string[];
  correlationId: string;
  authSource: IntegrationsCredentialSource;
}

export interface IntegrationsAuthSuccess {
  ok: true;
  principal: IntegrationsGatewayPrincipal;
  authLatencyMs: number;
  authorizationLatencyMs: number;
  quotaLatencyMs: number;
  remainingQuota: number;
}

export interface IntegrationsAuthFailure {
  ok: false;
  reason: IntegrationsAuthRejectionReason;
  statusCode: 401 | 403 | 429;
  message: string;
  authLatencyMs: number;
}

export type IntegrationsAuthResult =
  | IntegrationsAuthSuccess
  | IntegrationsAuthFailure;

export interface ParsedApiKeyCredential {
  raw: string;
  source: IntegrationsCredentialSource;
  prefixKind: 'bk_' | 'bki_';
}

/** Request property keys (avoid colliding with JWT user). */
export const INTEGRATIONS_PRINCIPAL_REQUEST_KEY = 'integrationsPrincipal';
export const INTEGRATIONS_AUTHENTICATED_REQUEST_KEY =
  'integrationsApiKeyAuthenticated';
