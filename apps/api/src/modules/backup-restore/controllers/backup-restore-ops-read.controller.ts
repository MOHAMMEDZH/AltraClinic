import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  CLEANUP_PLAN_STORE,
  RETENTION_EVALUATION_STORE,
  VERIFICATION_RESULT_STORE,
  type CleanupPlanStore,
  type RetentionEvaluationStore,
  type VerificationResultStore,
} from '../infrastructure/verification-retention.stores';
import {
  toPublicCleanupPlan,
  toPublicRetentionEvaluation,
  toPublicVerificationResult,
} from '../application/public-backup-restore.mapper';
import { BACKUP_RESTORE_PERMISSION_RESOURCE } from '../backup-restore.constants';

/**
 * Phase 43f — verification + retention read views (no execution).
 */
@Controller('backup-restore')
@UseGuards(TenantScopedAccessGuard)
export class BackupRestoreOpsReadController {
  constructor(
    @Inject(VERIFICATION_RESULT_STORE)
    private readonly verificationStore: VerificationResultStore,
    @Inject(RETENTION_EVALUATION_STORE)
    private readonly retentionStore: RetentionEvaluationStore,
    @Inject(CLEANUP_PLAN_STORE) private readonly cleanupStore: CleanupPlanStore,
  ) {}

  @Get('verification')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async verification(@CurrentUser() user: JwtClaimsVO) {
    const results = await this.verificationStore.listByTenant(user.tenantId);
    return { results: results.map(toPublicVerificationResult) };
  }

  @Get('retention')
  @RequirePermission(BACKUP_RESTORE_PERMISSION_RESOURCE, 'view')
  async retention(@CurrentUser() user: JwtClaimsVO) {
    const evaluations = await this.retentionStore.listByTenant(user.tenantId);
    const cleanupPlans = await this.cleanupStore.listByTenant(user.tenantId);
    return {
      evaluations: evaluations.map(toPublicRetentionEvaluation),
      cleanupPlans: cleanupPlans.map(toPublicCleanupPlan),
    };
  }
}
