import { Injectable } from '@nestjs/common';
import { IMPORT_EXPORT_EXTENSION_KIND } from '../import-export.constants';

/**
 * Phase 42a/42b — local extension-kind registration.
 * Decision: `importExport` remains locally registered (Module Registry unchanged / no redesign).
 * Type metadata lives in ImportExportRuntimeRegistry. No executable adapters.
 */
@Injectable()
export class ImportExportExtensionRegistry {
  private readonly kind = IMPORT_EXPORT_EXTENSION_KIND;
  private readonly registered = true;

  getExtensionKind(): typeof IMPORT_EXPORT_EXTENSION_KIND {
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
