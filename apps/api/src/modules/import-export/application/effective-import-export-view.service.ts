import { Injectable, Logger } from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { isImportExportCenterEnabled } from '../config/import-export-config';
import { IMPORT_EXPORT_EXTENSION_KIND, IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';
import type {
  EffectiveImportExportType,
  ImportExportRegistrationMetadata,
} from '../domain/import-export-registration.contracts';
import { ImportExportExtensionRegistry } from './import-export-extension.registry';
import { ImportExportRuntimeRegistry } from './import-export-runtime.registry';
import {
  evaluateImportExportVisibility,
  isEnvFlagEnabled,
} from './import-export-visibility';

/**
 * Phase 42b — runtime discoverability catalog.
 * Merges registry + RBAC + licensing + tenant/branch + feature flags.
 * Never grants execution capability.
 */
export interface EffectiveImportExportView {
  extensionKind: typeof IMPORT_EXPORT_EXTENSION_KIND;
  featureEnabled: boolean;
  allowDataImport: boolean;
  allowDataExport: boolean;
  /** Visible types only — what the current principal may see. */
  types: readonly EffectiveImportExportType[];
  tenantId: string | null;
  branchId: string | null;
  visible: boolean;
  meta: {
    registeredCount: number;
    visibleCount: number;
    disabledCount: number;
    inactiveCount: number;
    invalidCount: number;
    executableCount: number;
    adapterAttachedCount: number;
  };
}

export interface ResolveImportExportViewInput {
  tenantId?: string | null;
  branchId?: string | null;
  roles?: readonly string[];
  /** When false, catalog is not visible regardless of license. */
  hasReadPermission?: boolean;
  isFeatureEnabled?: (flag: string) => boolean;
}

@Injectable()
export class EffectiveImportExportViewService {
  private readonly logger = new Logger(EffectiveImportExportViewService.name);

  constructor(
    private readonly extensionRegistry: ImportExportExtensionRegistry,
    private readonly runtimeRegistry: ImportExportRuntimeRegistry,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async resolve(input: ResolveImportExportViewInput = {}): Promise<EffectiveImportExportView> {
    const featureEnabled = isImportExportCenterEnabled();
    const hasReadPermission = input.hasReadPermission !== false;

    let allowDataImport = true;
    let allowDataExport = true;
    if (input.tenantId) {
      const advanced = await this.tenantPolicy.getAdvancedPolicy(input.tenantId);
      allowDataImport = advanced.allowDataImport;
      allowDataExport = advanced.allowDataExport;
    }

    const registryHealth = this.runtimeRegistry.getHealth();
    const registered = this.runtimeRegistry.listRegistrations();

    const visibleTypes: EffectiveImportExportType[] = [];
    if (featureEnabled && hasReadPermission && this.extensionRegistry.isRegistered()) {
      for (const entry of registered) {
        const visibility = evaluateImportExportVisibility(entry, {
          tenantId: input.tenantId,
          branchId: input.branchId,
          roles: input.roles,
          allowDataImport,
          allowDataExport,
          centerEnabled: featureEnabled,
          isFeatureEnabled: input.isFeatureEnabled ?? ((flag) => isEnvFlagEnabled(flag)),
        });
        if (visibility.visible) {
          visibleTypes.push(toEffectiveType(entry));
        }
      }
    }

    const catalogVisible =
      featureEnabled &&
      hasReadPermission &&
      this.extensionRegistry.isRegistered() &&
      (allowDataImport || allowDataExport);

    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'effective_view',
        event: 'catalog_rebuild',
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        featureEnabled,
        registeredCount: registered.length,
        visibleCount: visibleTypes.length,
        disabledCount: registryHealth.disabledCount,
        invalidCount: registryHealth.invalidCount,
        executableCount: 0,
      }),
    );

    this.logger.debug(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'effective_view',
        event: 'visibility_calculation',
        visibleTypeIds: visibleTypes.map((t) => t.typeId),
      }),
    );

    return {
      extensionKind: this.extensionRegistry.getExtensionKind(),
      featureEnabled,
      allowDataImport,
      allowDataExport,
      types: visibleTypes,
      tenantId: input.tenantId ?? null,
      branchId: input.branchId ?? null,
      visible: catalogVisible,
      meta: {
        registeredCount: registered.length,
        visibleCount: visibleTypes.length,
        disabledCount: registryHealth.disabledCount,
        inactiveCount: registryHealth.inactiveCount,
        invalidCount: registryHealth.invalidCount,
        executableCount: registryHealth.executableCount,
        adapterAttachedCount: registryHealth.adapterAttachedCount,
      },
    };
  }
}

function toEffectiveType(entry: ImportExportRegistrationMetadata): EffectiveImportExportType {
  return {
    typeId: entry.typeId,
    displayName: entry.displayName,
    category: entry.category,
    direction: entry.direction,
    ownerModule: entry.ownerModule,
    version: entry.version,
    status: entry.status,
    registrationKind: entry.registrationKind,
    supportedFormats: entry.supportedFormats,
    supportsDryRun: entry.supportsDryRun,
    supportsPreview: entry.supportsPreview,
    requiredPermission: entry.requiredPermission,
    requiredLicense: entry.requiredLicense,
    tenantScope: entry.tenantScope,
    branchScope: entry.branchScope,
    featureFlag: entry.featureFlag,
    adapterAttached: entry.adapterAttached,
    executable: entry.executable,
    visible: true,
  };
}
