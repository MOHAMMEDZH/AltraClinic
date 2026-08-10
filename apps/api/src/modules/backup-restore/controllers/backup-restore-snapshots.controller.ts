import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  BACKUP_SNAPSHOT_STORE,
  type BackupSnapshotStore,
} from '../infrastructure/in-memory-backup-snapshot.store';
import { Inject } from '@nestjs/common';
import {
  toPublicRecoveryPoint,
  toPublicSnapshot,
} from '../application/public-backup-restore.mapper';
import { BACKUP_RESTORE_PERMISSION_RESOURCE } from '../backup-restore.constants';

/**
 * Phase 43f — snapshot + recovery-point reads (no mutation / deletion).
 */
@Controller('backup-restore')
@UseGuards(TenantScopedAccessGuard)
export class BackupRestoreSnapshotsController {
  constructor(
    @Inject(BACKUP_SNAPSHOT_STORE) private readonly snapshots: BackupSnapshotStore,
  ) {}

  @Get('snapshots')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async list(@CurrentUser() user: JwtClaimsVO) {
    const rows = await this.snapshots.listByTenant(user.tenantId);
    return { snapshots: rows.map(toPublicSnapshot) };
  }

  @Get('snapshots/:id')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async get(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const row = await this.snapshots.findById(user.tenantId, id);
    if (!row) throw new NotFoundException('Snapshot not found');
    return { snapshot: toPublicSnapshot(row) };
  }

  @Get('recovery-points')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async recoveryPoints(@CurrentUser() user: JwtClaimsVO) {
    const rows = await this.snapshots.listByTenant(user.tenantId);
    return { recoveryPoints: rows.map(toPublicRecoveryPoint) };
  }
}
