import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import {
  toPublicBackupRestoreJob,
  toPublicBackupRestoreJobs,
} from '../application/public-backup-restore.mapper';
import { BACKUP_RESTORE_PERMISSION_RESOURCE } from '../backup-restore.constants';
import type {
  BackupRestoreJobKind,
  BackupRestoreJobStatus,
} from '../domain/job/backup-restore-job.types';

/**
 * Phase 43f — job list/detail/cancel for Operations UI.
 * Delegates to Job Manager only (no engine changes).
 */
@Controller('backup-restore/jobs')
@UseGuards(TenantScopedAccessGuard)
export class BackupRestoreJobsController {
  constructor(private readonly jobs: BackupRestoreJobManager) {}

  @Get()
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async list(
    @CurrentUser() user: JwtClaimsVO,
    @Query('kind') kind?: BackupRestoreJobKind,
    @Query('status') status?: BackupRestoreJobStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const actor = {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    };
    let rows = await this.jobs.listJobs(user.tenantId, actor, { kind, status });
    const off = offset ? Number(offset) : 0;
    const lim = limit ? Number(limit) : undefined;
    if (Number.isFinite(off) && off > 0) rows = rows.slice(off);
    if (lim != null && Number.isFinite(lim) && lim >= 0) rows = rows.slice(0, lim);
    return { jobs: toPublicBackupRestoreJobs(rows) };
  }

  @Get(':id')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async get(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.getJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    return { job: toPublicBackupRestoreJob(job) };
  }

  @Post(':id/cancel')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'manage')
  async cancel(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.cancelJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    return { job: toPublicBackupRestoreJob(job) };
  }
}
