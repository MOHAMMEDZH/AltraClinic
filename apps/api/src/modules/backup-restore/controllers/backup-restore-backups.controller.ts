import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupExecutor } from '../application/backup.executor';
import {
  toPublicBackupRestoreJob,
  toPublicSnapshot,
} from '../application/public-backup-restore.mapper';
import { BACKUP_RESTORE_PERMISSION_RESOURCE } from '../backup-restore.constants';

class CreateBackupBody {
  typeId!: string;
  targetId?: string;
  description?: string;
  compression?: string;
  encryptionClass?: string;
  idempotencyKey?: string;
}

/**
 * Phase 43f — on-demand backup request.
 * Creates a job then delegates execution to BackupExecutor (unchanged).
 */
@Controller('backup-restore/backups')
@UseGuards(TenantScopedAccessGuard)
export class BackupRestoreBackupsController {
  constructor(
    private readonly jobs: BackupRestoreJobManager,
    private readonly backupExecutor: BackupExecutor,
  ) {}

  @Post()
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'create')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateBackupBody,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    const idempotencyKey =
      body.idempotencyKey?.trim() ||
      idempotencyHeader?.trim() ||
      `br-backup:${user.sub}:${body.typeId}:${Date.now()}`;

    const job = await this.jobs.createJob({
      tenantId: user.tenantId,
      branchId: user.branchId,
      kind: 'backup',
      typeId: body.typeId,
      initiatedByUserId: user.sub,
      actorRoles: user.roles.map(String),
      idempotencyKey,
      queueImmediately: false,
      metadata: {
        source: 'api',
        targetId: body.targetId ?? `tgt-${body.typeId}`,
        notes: body.description,
        compression: body.compression,
        encryptionClass: body.encryptionClass,
      },
    });

    const outcome = await this.backupExecutor.executeBackup({
      tenantId: user.tenantId,
      jobId: job.id,
      leaseOwner: `api:${user.sub}`,
    });

    const refreshed = await this.jobs.getJob(user.tenantId, job.id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });

    return {
      job: toPublicBackupRestoreJob(refreshed),
      snapshot: toPublicSnapshot(outcome.snapshot),
      result: {
        stagesCompleted: outcome.stagesCompleted,
        durationMs: outcome.durationMs,
      },
    };
  }
}
