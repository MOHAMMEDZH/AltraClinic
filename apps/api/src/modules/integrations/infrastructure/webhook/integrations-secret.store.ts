import { Injectable } from '@nestjs/common';
import type { SecretStore } from '../../application/ports/services';
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSigningSecret,
  isIntegrationsSecretStoreReady,
} from './envelope-secret-store';

@Injectable()
export class IntegrationsEnvelopeSecretStore implements SecretStore {
  readonly contractVersion = '44c' as const;

  isReady(): boolean {
    return isIntegrationsSecretStoreReady();
  }

  encrypt(plaintext: string): string {
    return encryptWebhookSecret(plaintext);
  }

  decrypt(envelope: string): string {
    return decryptWebhookSecret(envelope);
  }

  generate(): string {
    return generateWebhookSigningSecret();
  }
}
