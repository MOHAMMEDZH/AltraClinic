/**
 * Phase 44b — repository ports for Credential Engine.
 */
import type {
  ApiCredential,
  IntegrationRegistration,
  SecretReference,
  ServiceAccount,
  WebhookSubscription,
} from '../../domain/integrations.entities';

export const API_CREDENTIAL_REPOSITORY = Symbol('API_CREDENTIAL_REPOSITORY');
export const SERVICE_ACCOUNT_REPOSITORY = Symbol('SERVICE_ACCOUNT_REPOSITORY');
export const WEBHOOK_SUBSCRIPTION_REPOSITORY = Symbol(
  'WEBHOOK_SUBSCRIPTION_REPOSITORY',
);
export const INTEGRATION_REGISTRATION_REPOSITORY = Symbol(
  'INTEGRATION_REGISTRATION_REPOSITORY',
);
export const SECRET_REFERENCE_REPOSITORY = Symbol('SECRET_REFERENCE_REPOSITORY');

export interface ApiCredentialRepository {
  findById(tenantId: string, id: string): Promise<ApiCredential | null>;
  findByPrefix(tenantId: string, prefix: string): Promise<ApiCredential | null>;
  findByKeyHash(tenantId: string, keyHash: string): Promise<ApiCredential | null>;
  /**
   * Phase 44d — global hash lookup for OD-AUTHN when tenant hint absent.
   * keyHash is unique in practice (CSPRNG raw + pepper); still tenant-isolated after resolve.
   */
  findByKeyHashGlobal?(keyHash: string): Promise<ApiCredential | null>;
  listByTenant(tenantId: string): Promise<readonly ApiCredential[]>;
  save(credential: ApiCredential): Promise<ApiCredential>;
  /** Persist multiple credentials atomically when supported. */
  saveMany(credentials: readonly ApiCredential[]): Promise<void>;
}

export interface ServiceAccountRepository {
  findById(tenantId: string, id: string): Promise<ServiceAccount | null>;
  listByTenant(tenantId: string): Promise<readonly ServiceAccount[]>;
  save(account: ServiceAccount): Promise<ServiceAccount>;
}

export interface WebhookSubscriptionRepository {
  findById(id: string): Promise<WebhookSubscription | null>;
  listByTenant(tenantId: string): Promise<readonly WebhookSubscription[]>;
}

export interface IntegrationRegistrationRepository {
  findById(id: string): Promise<IntegrationRegistration | null>;
  listByTenant(tenantId: string): Promise<readonly IntegrationRegistration[]>;
}

export interface SecretReferenceRepository {
  findById(id: string): Promise<SecretReference | null>;
  listByTenant(tenantId: string): Promise<readonly SecretReference[]>;
}
