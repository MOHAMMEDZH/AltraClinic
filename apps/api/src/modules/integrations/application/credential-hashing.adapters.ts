import { Injectable } from '@nestjs/common';
import type { HashingService, ScopeAuthorizer } from './ports/services';
import {
  hashApiCredential,
  isPepperConfigured,
  resolvePepperMaterial,
  verifyApiCredentialHash,
} from '../domain/credential-hashing';
import { validateCredentialScopes } from '../domain/credential-scopes';

@Injectable()
export class PepperHashingService implements HashingService {
  readonly contractVersion = '44b' as const;

  hash(raw: string): string {
    const pepper = resolvePepperMaterial();
    if (!pepper || !isPepperConfigured()) {
      throw new Error('Pepper not configured');
    }
    return hashApiCredential(raw, pepper);
  }

  verify(raw: string, storedHash: string): boolean {
    const pepper = resolvePepperMaterial();
    if (!pepper || !isPepperConfigured()) return false;
    return verifyApiCredentialHash(raw, storedHash, pepper);
  }
}

@Injectable()
export class CatalogScopeAuthorizer implements ScopeAuthorizer {
  readonly contractVersion = '44b' as const;

  authorize(
    granted: readonly string[],
    required: readonly string[],
  ): boolean {
    try {
      const validated = new Set(validateCredentialScopes(granted, { allowHighRisk: true }));
      return required.every((r) => validated.has(r));
    } catch {
      return false;
    }
  }
}
