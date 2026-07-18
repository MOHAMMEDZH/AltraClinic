import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { STATIC_IMPORT_EXPORT_CATALOG } from '../catalog/static-import-export.catalog';
import type {
  ImportExportRegistrationInput,
  ImportExportRegistrationMetadata,
  ImportExportRegistrationValidationIssue,
  ImportExportRegistrationKind,
} from '../domain/import-export-registration.contracts';
import type { ImportAdapter } from '../domain/import/import-adapter.contracts';
import type { ExportAdapter } from '../domain/export/export-adapter.contracts';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';
import {
  toRegistrationMetadata,
  validateImportExportRegistration,
} from './import-export-registration.validator';

export class ImportExportRegistrationRejectedError extends Error {
  constructor(
    public readonly typeId: string,
    public readonly issues: ImportExportRegistrationValidationIssue[],
  ) {
    super(`Import/Export registration rejected for ${typeId}: ${issues.map((i) => i.code).join(', ')}`);
    this.name = 'ImportExportRegistrationRejectedError';
  }
}

export interface ImportExportRegistryHealth {
  healthy: boolean;
  registeredCount: number;
  byKind: Record<ImportExportRegistrationKind, number>;
  disabledCount: number;
  inactiveCount: number;
  activeCount: number;
  deprecatedCount: number;
  invalidCount: number;
  adapterAttachedCount: number;
  executableCount: number;
}

interface RejectedRegistration {
  typeId: string;
  issues: ImportExportRegistrationValidationIssue[];
}

/**
 * Phase 42b/42d/42e — runtime registry for metadata + attached import/export adapters.
 */
@Injectable()
export class ImportExportRuntimeRegistry implements OnModuleInit {
  private readonly logger = new Logger(ImportExportRuntimeRegistry.name);
  private readonly registrations = new Map<string, ImportExportRegistrationMetadata>();
  private readonly importAdapters = new Map<string, ImportAdapter>();
  private readonly exportAdapters = new Map<string, ExportAdapter>();
  private readonly rejected: RejectedRegistration[] = [];
  private staticCatalogLoaded = false;

  onModuleInit(): void {
    this.loadStaticCatalog();
  }

  loadStaticCatalog(): void {
    if (this.staticCatalogLoaded) return;
    for (const entry of STATIC_IMPORT_EXPORT_CATALOG) {
      try {
        this.register(entry, { source: 'static' });
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            kind: IMPORT_EXPORT_LOG_KIND,
            component: 'registry',
            event: 'static_catalog_entry_rejected',
            typeId: entry.typeId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    this.staticCatalogLoaded = true;
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'registry',
        event: 'static_catalog_loaded',
        registeredCount: this.registrations.size,
        invalidCount: this.rejected.length,
      }),
    );
  }

  register(
    input: ImportExportRegistrationInput,
    options: { source?: 'static' | 'runtime' } = {},
  ): ImportExportRegistrationMetadata {
    const existing = this.listRegistrations();
    const validation = validateImportExportRegistration(input, existing);
    if (!validation.valid) {
      this.rejected.push({ typeId: input.typeId || '(missing)', issues: validation.issues });
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'registry',
          event: 'registration_rejected',
          typeId: input.typeId,
          source: options.source ?? 'runtime',
          issues: validation.issues,
        }),
      );
      throw new ImportExportRegistrationRejectedError(input.typeId || '(missing)', validation.issues);
    }

    const metadata = toRegistrationMetadata(input);
    this.registrations.set(metadata.typeId, metadata);
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'registry',
        event: 'registration',
        typeId: metadata.typeId,
        version: metadata.version,
        registrationKind: metadata.registrationKind,
        status: metadata.status,
        adapterAttached: metadata.adapterAttached,
        executable: metadata.executable,
        source: options.source ?? 'runtime',
      }),
    );
    return metadata;
  }

  /**
   * Attach a real ImportAdapter and activate the catalog entry (Phase 42d).
   */
  attachImportAdapter(adapter: ImportAdapter): void {
    const existing = this.registrations.get(adapter.typeId);
    if (!existing) {
      throw new Error(`Cannot attach adapter: typeId ${adapter.typeId} is not registered`);
    }
    if (existing.direction !== 'import') {
      throw new Error(`Cannot attach import adapter to non-import type ${adapter.typeId}`);
    }
    this.importAdapters.set(adapter.typeId, adapter);
    this.registrations.set(adapter.typeId, {
      ...existing,
      status: 'active',
      adapterAttached: true,
      executable: true,
      supportedFormats: adapter.supportedFormats,
    });
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'registry',
        event: 'adapter_attached',
        typeId: adapter.typeId,
        formats: adapter.supportedFormats,
        executable: true,
      }),
    );
  }

  getImportAdapter(typeId: string): ImportAdapter | undefined {
    return this.importAdapters.get(typeId);
  }

  /**
   * Attach a real ExportAdapter and activate the catalog entry (Phase 42e).
   */
  attachExportAdapter(adapter: ExportAdapter): void {
    const existing = this.registrations.get(adapter.typeId);
    if (!existing) {
      throw new Error(`Cannot attach adapter: typeId ${adapter.typeId} is not registered`);
    }
    if (existing.direction !== 'export') {
      throw new Error(`Cannot attach export adapter to non-export type ${adapter.typeId}`);
    }
    this.exportAdapters.set(adapter.typeId, adapter);
    this.registrations.set(adapter.typeId, {
      ...existing,
      status: 'active',
      adapterAttached: true,
      executable: true,
      supportedFormats: adapter.supportedFormats,
    });
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'registry',
        event: 'export_adapter_attached',
        typeId: adapter.typeId,
        formats: adapter.supportedFormats,
        executable: true,
      }),
    );
  }

  getExportAdapter(typeId: string): ExportAdapter | undefined {
    return this.exportAdapters.get(typeId);
  }

  listRegistrations(): ImportExportRegistrationMetadata[] {
    return [...this.registrations.values()];
  }

  getByTypeId(typeId: string): ImportExportRegistrationMetadata | undefined {
    return this.registrations.get(typeId);
  }

  listByKind(kind: ImportExportRegistrationKind): ImportExportRegistrationMetadata[] {
    return this.listRegistrations().filter((entry) => entry.registrationKind === kind);
  }

  listInvalidRegistrations(): readonly RejectedRegistration[] {
    return this.rejected;
  }

  listExecutableAdapters(): ImportAdapter[] {
    return [...this.importAdapters.values()];
  }

  listExecutableExportAdapters(): ExportAdapter[] {
    return [...this.exportAdapters.values()];
  }

  getHealth(): ImportExportRegistryHealth {
    const all = this.listRegistrations();
    const byKind: ImportExportRegistryHealth['byKind'] = {
      importer: 0,
      exporter: 0,
      templateProvider: 0,
      validatorProvider: 0,
      artifactProvider: 0,
    };
    for (const entry of all) {
      byKind[entry.registrationKind] += 1;
    }
    return {
      healthy: this.rejected.length === 0,
      registeredCount: all.length,
      byKind,
      disabledCount: all.filter((e) => e.status === 'disabled').length,
      inactiveCount: all.filter((e) => e.status === 'inactive').length,
      activeCount: all.filter((e) => e.status === 'active').length,
      deprecatedCount: all.filter((e) => e.status === 'deprecated').length,
      invalidCount: this.rejected.length,
      adapterAttachedCount: all.filter((e) => e.adapterAttached).length,
      executableCount: all.filter((e) => e.executable).length,
    };
  }

  resetForTests(): void {
    this.registrations.clear();
    this.importAdapters.clear();
    this.exportAdapters.clear();
    this.rejected.length = 0;
    this.staticCatalogLoaded = false;
  }
}
