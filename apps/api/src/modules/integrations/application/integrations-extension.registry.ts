import { Injectable } from '@nestjs/common';
import { INTEGRATIONS_EXTENSION_KIND } from '../integrations.constants';

/**
 * Phase 44a — local extension-kind registration.
 * `integrations` remains locally registered (Module Registry unchanged / no redesign).
 * No executable adapters in 44a.
 */
@Injectable()
export class IntegrationsExtensionRegistry {
  private readonly kind = INTEGRATIONS_EXTENSION_KIND;
  private readonly registered = true;

  getExtensionKind(): typeof INTEGRATIONS_EXTENSION_KIND {
    return this.kind;
  }

  isRegistered(): boolean {
    return this.registered;
  }

  /** Foundation: zero adapters. */
  listAdapterRegistrations(): readonly never[] {
    return [];
  }
}
