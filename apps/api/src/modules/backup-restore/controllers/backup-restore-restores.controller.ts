import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { RestoreExecutor } from '../application/restore.executor';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import {
  toPublicBackupRestoreJob,
  toPublicRestoreResult,
} from '../application/public-backup-restore.mapper';
import { BACKUP_RESTORE_PERMISSION_RESOURCE } from '../backup-restore.constants';

class CreateRestoreBody {
  typeId!: string;
  snapshotId!: string;
  restoreMode!: 'drill' | 'controlled';
  restoreTargetKind?: string;
  recoveryPointId?: string;
  approvedByUserId?: string;
  idempotencyKey?: string;
}

/**
 * Phase 43f — restore / drill request.
 * Creates a job then delegates to RestoreExecutor (unchanged).
 */
@Controller('backup-restore/restores')
@UseGuards(TenantScopedAccessGuard)
export class BackupRestoreRestoresController {
  constructor(
    private readonly jobs: BackupRestoreJobManager,
    private readonly restoreExecutor: RestoreExecutor,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  @Post()
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'manage')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateRestoreBody,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    const idempotencyKey =
      body.idempotencyKey?.trim() ||
      idempotencyHeader?.trim() ||
      `br-restore:${user.sub}:${body.snapshotId}:${Date.now()}`;

    const job = await this.jobs.createJob({
      tenantId: user.tenantId,
      branchId: user.branchId,
      kind: 'restore',
      typeId: body.typeId,
      initiatedByUserId: user.sub,
      actorRoles: user.roles.map(String),
      idempotencyKey,
      queueImmediately: false,
      metadata: {
        source: 'api',
        snapshotId: body.snapshotId,
        restoreMode: body.restoreMode ?? 'drill',
        restoreTargetKind: body.restoreTargetKind,
        recoveryPointId: body.recoveryPointId,
        approvedByUserId: body.approvedByUserId,
      },
    });

    const policy = await this.tenantPolicy.getAdvancedPolicy(user.tenantId);
    const outcome = await this.restoreExecutor.executeRestore({
      tenantId: user.tenantId,
      jobId: job.id,
      leaseOwner: `api:${user.sub}`,
      allowBackupRestore: policy.allowBackupRestore,
      hasManagePermission: true,
    });

    const refreshed = await this.jobs.getJob(user.tenantId, job.id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });

    return {
      job: toPublicBackupRestoreJob(refreshed),
      result: toPublicRestoreResult(outcome.result),
    };
  }
}
