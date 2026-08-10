import { Injectable, Logger } from '@nestjs/common';
import {
  BACKUP_RESTORE_LOG_KIND,
  BACKUP_RESTORE_METRICS_NAMESPACE,
} from '../backup-restore.constants';

/**
 * Phase 43e — restore instrumentation hooks (in-process only).
 */
@Injectable()
export class RestoreEngineObservabilityHooks {
  private readonly logger = new Logger(RestoreEngineObservabilityHooks.name);
  private restores = 0;
  private failures = 0;
  private validationFailures = 0;
  private totalDurationMs = 0;
  private totalBytesRestored = 0;
  private recoveryPointSelections = 0;

  drain() {
    const snapshot = {
      restores: this.restores,
      failures: this.failures,
      validationFailures: this.validationFailures,
      totalDurationMs: this.totalDurationMs,
      totalBytesRestored: this.totalBytesRestored,
      recoveryPointSelections: this.recoveryPointSelections,
    };
    this.restores = 0;
    this.failures = 0;
    this.validationFailures = 0;
    this.totalDurationMs = 0;
    this.totalBytesRestored = 0;
    this.recoveryPointSelections = 0;
    return snapshot;
  }

  onRecoveryPointSelected(correlationId: string, snapshotId: string): void {
    this.recoveryPointSelections += 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'restore_engine_observability',
      namespace: BACKUP_RESTORE_METRICS_NAMESPACE,
      event: 'recovery_point_selected',
      correlationId,
      snapshotId,
    });
  }

  onRestoreCompleted(input: {
    correlationId: string;
    durationMs: number;
    bytesRestored: number;
  }): void {
    this.restores += 1;
    this.totalDurationMs += input.durationMs;
    this.totalBytesRestored += input.bytesRestored;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'restore_engine_observability',
      namespace: BACKUP_RESTORE_METRICS_NAMESPACE,
      event: 'restore_completed',
      correlationId: input.correlationId,
      durationMs: input.durationMs,
      bytesRestored: input.bytesRestored,
    });
  }

  onRestoreFailed(correlationId: string, failureClass: string): void {
    this.failures += 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'restore_engine_observability',
      event: 'restore_failed',
      correlationId,
      failureClass,
    });
  }

  onValidationFailed(correlationId: string, reason: string): void {
    this.validationFailures += 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'restore_engine_observability',
      event: 'restore_validation_failed',
      correlationId,
      reason,
    });
  }
}
