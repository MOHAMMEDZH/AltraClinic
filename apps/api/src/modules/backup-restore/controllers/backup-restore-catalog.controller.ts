import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { EffectiveBackupRestoreViewService } from '../application/effective-backup-restore-view.service';
import { BACKUP_RESTORE_PERMISSION_RESOURCE } from '../backup-restore.constants';
import { STATIC_BACKUP_RESTORE_CATALOG } from '../catalog/static-backup-restore.catalog';

/**
 * Phase 43f — thin catalog read for Operations UI.
 */
@Controller('backup-restore')
@UseGuards(TenantScopedAccessGuard)
export class BackupRestoreCatalogController {
  constructor(private readonly effectiveView: EffectiveBackupRestoreViewService) {}

  @Get('catalog')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async catalog(@CurrentUser() user: JwtClaimsVO) {
    const catalog = await this.effectiveView.resolve({
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles.map(String),
      hasReadPermission: true,
    });
    const types = STATIC_BACKUP_RESTORE_CATALOG.map((t) => ({ ...t }));
    return { catalog, types };
  }
}
