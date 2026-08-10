import { Injectable, Logger } from '@nestjs/common';
import {
  BACKUP_RESTORE_LOG_KIND,
  BACKUP_RESTORE_METRICS_NAMESPACE,
} from '../backup-restore.constants';

/**
 * Phase 43c — Backup Engine instrumentation hooks (in-process only).
 */
@Injectable()
export class BackupEngineObservabilityHooks {
  private readonly logger = new Logger(BackupEngineObservabilityHooks.name);
  private backups = 0;
  private failures = 0;
  private totalDurationMs = 0;
  private totalSnapshotBytes = 0;
  private compressionIn = 0;
  private compressionOut = 0;

  drain() {
    const snapshot = {
      backups: this.backups,
      failures: this.failures,
      totalDurationMs: this.totalDurationMs,
      totalSnapshotBytes: this.totalSnapshotBytes,
      compressionIn: this.compressionIn,
      compressionOut: this.compressionOut,
    };
    this.backups = 0;
    this.failures = 0;
    this.totalDurationMs = 0;
    this.totalSnapshotBytes = 0;
    this.compressionIn = 0;
    this.compressionOut = 0;
    return snapshot;
  }

  onBackupCompleted(input: {
    correlationId: string;
    durationMs: number;
    sizeBytes: number;
    compressionIn: number;
    compressionOut: number;
  }): void {
    this.backups += 1;
    this.totalDurationMs += input.durationMs;
    this.totalSnapshotBytes += input.sizeBytes;
    this.compressionIn += input.compressionIn;
    this.compressionOut += input.compressionOut;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'backup_engine_observability',
      namespace: BACKUP_RESTORE_METRICS_NAMESPACE,
      event: 'backup_completed',
      correlationId: input.correlationId,
      durationMs: input.durationMs,
      sizeBytes: input.sizeBytes,
    });
  }

  onBackupFailed(correlationId: string, failureClass: string): void {
    this.failures += 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'backup_engine_observability',
      event: 'backup_failed',
      correlationId,
      failureClass,
    });
  }
}
