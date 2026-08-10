/**
 * Phase 44b — ApiCredential / ServiceAccount aggregates (architecture statuses).
 */

export type ApiCredentialStatus =
  | 'active'
  | 'expiring'
  | 'rotated'
  | 'revoked'
  | 'expired';

export type ApiCredentialOwnerType = 'user' | 'service_account';

export interface ApiCredential {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  /** Public hint — first 12 characters of raw key (never the full secret). */
  prefix: string;
  /** SHA-256(pepper || raw) hex — never returned on read APIs. */
  keyHash: string;
  hashAlgorithm: 'sha256_pepper_v1';
  status: ApiCredentialStatus;
  scopes: readonly string[];
  ownerType: ApiCredentialOwnerType;
  ownerId: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string;
  rotatedFromId: string | null;
  /** When status is rotated: predecessor remains authn-eligible until this instant (OD-GRACE). */
  rotationGraceEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export type ServiceAccountStatus = 'active' | 'disabled';

export interface ServiceAccount {
  id: string;
  tenantId: string;
  displayName: string;
  status: ServiceAccountStatus;
  roleBindings: readonly string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

/** Metadata-only projection — never includes keyHash or raw material. */
export interface ApiCredentialMetadata {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  prefix: string;
  status: ApiCredentialStatus;
  scopes: readonly string[];
  ownerType: ApiCredentialOwnerType;
  ownerId: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string;
  rotatedFromId: string | null;
  rotationGraceEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  source: 'center' | 'legacy_settings';
}

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  name: string;
  targetUrl: string;
  eventFilters: readonly string[];
  status: 'active' | 'disabled' | 'paused';
  secretReferenceId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationRegistration {
  id: string;
  tenantId: string;
  providerKey: string;
  displayName: string;
  status: 'active' | 'disabled' | 'inactive';
  config: Record<string, unknown>;
  secretReferenceId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretReference {
  id: string;
  tenantId: string;
  purpose: 'webhook_signing' | 'provider_client_secret' | 'other';
  algorithm: 'aes256_gcm_v1';
  ciphertextRef: string;
  createdAt: string;
}

export interface TenantCorrelationContext {
  tenantId: string;
  correlationId: string;
  causationId?: string | null;
  actorId?: string | null;
  branchId?: string | null;
}

export function toCredentialMetadata(
  credential: ApiCredential,
  source: 'center' | 'legacy_settings' = 'center',
): ApiCredentialMetadata {
  return {
    id: credential.id,
    tenantId: credential.tenantId,
    branchId: credential.branchId,
    name: credential.name,
    prefix: credential.prefix,
    status: credential.status,
    scopes: credential.scopes,
    ownerType: credential.ownerType,
    ownerId: credential.ownerId,
    expiresAt: credential.expiresAt,
    lastUsedAt: credential.lastUsedAt,
    createdBy: credential.createdBy,
    rotatedFromId: credential.rotatedFromId,
    rotationGraceEndsAt: credential.rotationGraceEndsAt,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
    revokedAt: credential.revokedAt,
    source,
  };
}
