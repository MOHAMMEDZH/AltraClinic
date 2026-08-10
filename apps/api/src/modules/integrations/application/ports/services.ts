/**
 * Phase 44b — service contracts. CredentialService is the Credential Engine.
 * Other services remain markers until later sub-phases.
 */

export const CREDENTIAL_SERVICE = Symbol('CREDENTIAL_SERVICE');
export const WEBHOOK_DELIVERY_SERVICE = Symbol('WEBHOOK_DELIVERY_SERVICE');
export const SCOPE_AUTHORIZER = Symbol('SCOPE_AUTHORIZER');
export const SECRET_STORE = Symbol('SECRET_STORE');
export const HASHING_SERVICE = Symbol('HASHING_SERVICE');
export const QUOTA_SERVICE = Symbol('QUOTA_SERVICE');
export const INTEGRATION_GATEWAY = Symbol('INTEGRATION_GATEWAY');

export interface CredentialService {
  readonly contractVersion: '44a' | '44b';
}

export interface WebhookDeliveryService {
  readonly contractVersion: '44a' | '44c';
}

export interface ScopeAuthorizer {
  readonly contractVersion: '44a' | '44b';
}

export interface SecretStore {
  readonly contractVersion: '44a' | '44c';
}

export interface HashingService {
  readonly contractVersion: '44a' | '44b';
}

export interface QuotaService {
  readonly contractVersion: '44a' | '44d';
}

export interface IntegrationGateway {
  readonly contractVersion: '44a' | '44d';
}
