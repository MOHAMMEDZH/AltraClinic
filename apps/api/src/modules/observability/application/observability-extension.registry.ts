import { Injectable } from '@nestjs/common';
import { OBSERVABILITY_EXTENSION_KIND } from '../observability.constants';

/**
 * Phase 45a — local extension-kind registration.
 * `observability` remains locally registered (Module Registry unchanged / no redesign).
 * No executable adapters in 45a.
 */
@Injectable()
export class ObservabilityExtensionRegistry {
  private readonly kind = OBSERVABILITY_EXTENSION_KIND;
  private readonly registered = true;

  getExtensionKind(): typeof OBSERVABILITY_EXTENSION_KIND {
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
