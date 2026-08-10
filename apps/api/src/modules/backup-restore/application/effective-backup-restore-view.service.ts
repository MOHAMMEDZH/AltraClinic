import { Injectable } from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { BackupRestoreExtensionRegistry } from './backup-restore-extension.registry';
import { isBackupRestoreCenterEnabled } from '../config/backup-restore-config';
import { STATIC_BACKUP_RESTORE_CATALOG } from '../catalog/static-backup-restore.catalog';
import type { EffectiveBackupRestoreType } from '../domain/backup-restore-registration.contracts';
import { BACKUP_RESTORE_EXTENSION_KIND } from '../backup-restore.constants';

export interface EffectiveBackupRestoreViewInput {
  tenantId?: string;
  branchId?: string | null;
  roles?: readonly string[];
  hasReadPermission?: boolean;
}

export interface EffectiveBackupRestoreView {
  tenantId: string | null;
  branchId: string | null;
  extensionKind: typeof BACKUP_RESTORE_EXTENSION_KIND;
  featureEnabled: boolean;
  allowBackupRestore: boolean;
  visible: boolean;
  types: readonly EffectiveBackupRestoreType[];
  meta: {
    catalogCount: number;
    executableCount: number;
    staticCatalogIsRuntimeAuthority: false;
  };
}

/**
 * Phase 43a — dormant effective view.
 * Returns empty visible types; static catalog is never authority.
 */
@Injectable()
export class EffectiveBackupRestoreViewService {
  constructor(
    private readonly extensions: BackupRestoreExtensionRegistry,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async resolve(
    input: EffectiveBackupRestoreViewInput = {},
  ): Promise<EffectiveBackupRestoreView> {
    const featureEnabled = isBackupRestoreCenterEnabled();
    const tenantId = input.tenantId ?? null;
    let allowBackupRestore = false;
    if (tenantId) {
      const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
      allowBackupRestore = policy.allowBackupRestore;
    }

    const hasRead = input.hasReadPermission === true;
    const visible = featureEnabled && allowBackupRestore && hasRead;

    return {
      tenantId,
      branchId: input.branchId ?? null,
      extensionKind: this.extensions.getExtensionKind(),
      featureEnabled,
      allowBackupRestore,
      visible,
      types: [],
      meta: {
        catalogCount: STATIC_BACKUP_RESTORE_CATALOG.length,
        executableCount: 0,
        staticCatalogIsRuntimeAuthority: false,
      },
    };
  }
}
