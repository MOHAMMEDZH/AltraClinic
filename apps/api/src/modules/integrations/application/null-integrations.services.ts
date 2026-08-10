import { Injectable } from '@nestjs/common';
import type {
  CredentialService,
  HashingService,
  IntegrationGateway,
  QuotaService,
  ScopeAuthorizer,
  SecretStore,
  WebhookDeliveryService,
} from './ports/services';

/**
 * Phase 44a null contract holders — satisfy DI without execution methods.
 */
@Injectable()
export class NullCredentialService implements CredentialService {
  readonly contractVersion = '44a' as const;
}

@Injectable()
export class NullWebhookDeliveryService implements WebhookDeliveryService {
  readonly contractVersion = '44a' as const;
}

@Injectable()
export class NullScopeAuthorizer implements ScopeAuthorizer {
  readonly contractVersion = '44a' as const;
}

@Injectable()
export class NullSecretStore implements SecretStore {
  readonly contractVersion = '44a' as const;
}

@Injectable()
export class NullHashingService implements HashingService {
  readonly contractVersion = '44a' as const;
}

@Injectable()
export class NullQuotaService implements QuotaService {
  readonly contractVersion = '44a' as const;
}

@Injectable()
export class NullIntegrationGateway implements IntegrationGateway {
  readonly contractVersion = '44a' as const;
}
