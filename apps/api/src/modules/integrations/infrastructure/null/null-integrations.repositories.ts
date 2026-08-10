import { Injectable } from '@nestjs/common';
import type {
  ApiCredential,
  IntegrationRegistration,
  SecretReference,
  ServiceAccount,
  WebhookSubscription,
} from '../../domain/integrations.entities';
import type {
  ApiCredentialRepository,
  IntegrationRegistrationRepository,
  SecretReferenceRepository,
  ServiceAccountRepository,
  WebhookSubscriptionRepository,
} from '../../application/ports/repositories';

/** Phase 44a null holders retained for non-credential ports. */
@Injectable()
export class NullApiCredentialRepository implements ApiCredentialRepository {
  async findById(): Promise<ApiCredential | null> {
    return null;
  }
  async findByPrefix(): Promise<ApiCredential | null> {
    return null;
  }
  async findByKeyHash(): Promise<ApiCredential | null> {
    return null;
  }
  async listByTenant(): Promise<readonly ApiCredential[]> {
    return [];
  }
  async save(credential: ApiCredential): Promise<ApiCredential> {
    return credential;
  }
  async saveMany(): Promise<void> {}
}

@Injectable()
export class NullServiceAccountRepository implements ServiceAccountRepository {
  async findById(): Promise<ServiceAccount | null> {
    return null;
  }
  async listByTenant(): Promise<readonly ServiceAccount[]> {
    return [];
  }
  async save(account: ServiceAccount): Promise<ServiceAccount> {
    return account;
  }
}

@Injectable()
export class NullWebhookSubscriptionRepository
  implements WebhookSubscriptionRepository
{
  async findById(_id: string): Promise<WebhookSubscription | null> {
    return null;
  }
  async listByTenant(
    _tenantId: string,
  ): Promise<readonly WebhookSubscription[]> {
    return [];
  }
}

@Injectable()
export class NullIntegrationRegistrationRepository
  implements IntegrationRegistrationRepository
{
  async findById(_id: string): Promise<IntegrationRegistration | null> {
    return null;
  }
  async listByTenant(
    _tenantId: string,
  ): Promise<readonly IntegrationRegistration[]> {
    return [];
  }
}

@Injectable()
export class NullSecretReferenceRepository implements SecretReferenceRepository {
  async findById(_id: string): Promise<SecretReference | null> {
    return null;
  }
  async listByTenant(_tenantId: string): Promise<readonly SecretReference[]> {
    return [];
  }
}
