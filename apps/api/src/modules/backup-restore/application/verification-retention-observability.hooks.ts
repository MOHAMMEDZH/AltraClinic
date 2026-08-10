import { Injectable, Logger } from '@nestjs/common';
import {
  BACKUP_RESTORE_LOG_KIND,
  BACKUP_RESTORE_METRICS_NAMESPACE,
} from '../backup-restore.constants';

/**
 * Phase 43d — verification/retention instrumentation hooks (in-process only).
 */
@Injectable()
export class VerificationRetentionObservabilityHooks {
  private readonly logger = new Logger(VerificationRetentionObservabilityHooks.name);
  private verificationSuccess = 0;
  private verificationFailures = 0;
  private verificationDurationMs = 0;
  private retentionEvaluations = 0;
  private expiredSnapshots = 0;
  private orphanedSnapshots = 0;
  private cleanupPlans = 0;
  private cleanupPlanItems = 0;
  private estimatedReclaimedBytes = 0;

  drain() {
    const snapshot = {
      verificationSuccess: this.verificationSuccess,
      verificationFailures: this.verificationFailures,
      verificationDurationMs: this.verificationDurationMs,
      retentionEvaluations: this.retentionEvaluations,
      expiredSnapshots: this.expiredSnapshots,
      orphanedSnapshots: this.orphanedSnapshots,
      cleanupPlans: this.cleanupPlans,
      cleanupPlanItems: this.cleanupPlanItems,
      estimatedReclaimedBytes: this.estimatedReclaimedBytes,
    };
    this.verificationSuccess = 0;
    this.verificationFailures = 0;
    this.verificationDurationMs = 0;
    this.retentionEvaluations = 0;
    this.expiredSnapshots = 0;
    this.orphanedSnapshots = 0;
    this.cleanupPlans = 0;
    this.cleanupPlanItems = 0;
    this.estimatedReclaimedBytes = 0;
    return snapshot;
  }

  onVerificationSuccess(correlationId: string, durationMs: number): void {
    this.verificationSuccess += 1;
    this.verificationDurationMs += durationMs;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'verification_retention_observability',
      namespace: BACKUP_RESTORE_METRICS_NAMESPACE,
      event: 'verification_success',
      correlationId,
      durationMs,
    });
  }

  onVerificationFailure(correlationId: string, reason: string): void {
    this.verificationFailures += 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'verification_retention_observability',
      event: 'verification_failure',
      correlationId,
      reason,
    });
  }

  onRetentionEvaluated(
    correlationId: string,
    expired: number,
    orphaned: number,
  ): void {
    this.retentionEvaluations += 1;
    this.expiredSnapshots += expired;
    this.orphanedSnapshots += orphaned;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'verification_retention_observability',
      event: 'retention_evaluated',
      correlationId,
      expired,
      orphaned,
    });
  }

  onCleanupPlanned(correlationId: string, items: number, bytes: number): void {
    this.cleanupPlans += 1;
    this.cleanupPlanItems += items;
    this.estimatedReclaimedBytes += bytes;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'verification_retention_observability',
      event: 'cleanup_planned',
      correlationId,
      items,
      bytes,
    });
  }
}
