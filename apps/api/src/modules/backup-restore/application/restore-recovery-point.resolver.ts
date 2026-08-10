import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';
import type { BackupSnapshotRecord } from '../domain/backup/backup-engine.types';
import type {
  RecoveryPointSelectionMode,
  ResolvedRecoveryPoint,
} from '../domain/restore/restore-engine.types';
import {
  BACKUP_SNAPSHOT_STORE,
  type BackupSnapshotStore,
} from '../infrastructure/in-memory-backup-snapshot.store';

/**
 * Phase 43e — recovery point selection.
 * Supports latest verified, explicit recovery point id, or snapshot id.
 */
@Injectable()
export class RestoreRecoveryPointResolver {
  readonly ready = true;
  readonly contractVersion = '43e' as const;

  constructor(
    @Inject(BACKUP_SNAPSHOT_STORE) private readonly snapshots: BackupSnapshotStore,
  ) {}

  async resolve(
    job: BackupRestoreJob,
    loadedSnapshot?: BackupSnapshotRecord | null,
  ): Promise<{ recoveryPoint: ResolvedRecoveryPoint; snapshot: BackupSnapshotRecord }> {
    const mode = this.resolveSelectionMode(job);
    const tenantId = job.tenantId;

    if (mode === 'snapshot_identifier' || mode === 'explicit_recovery_point') {
      const snapshotId =
        (typeof job.metadata.snapshotId === 'string' && job.metadata.snapshotId.trim()) ||
        null;
      if (!snapshotId) {
        throw new BadRequestException('Restore requires metadata.snapshotId');
      }
      const snapshot =
        loadedSnapshot && loadedSnapshot.id === snapshotId
          ? loadedSnapshot
          : await this.snapshots.findById(tenantId, snapshotId);
      if (!snapshot) {
        throw new BadRequestException(`Snapshot not found: ${snapshotId}`);
      }
      if (snapshot.tenantId !== tenantId) {
        throw new BadRequestException('Cross-tenant recovery point rejected');
      }
      if (mode === 'explicit_recovery_point') {
        const expectedRp =
          (typeof job.metadata.recoveryPointId === 'string' &&
            job.metadata.recoveryPointId.trim()) ||
          null;
        if (!expectedRp) {
          throw new BadRequestException('Explicit recovery point id required');
        }
        if (snapshot.recoveryPointId !== expectedRp) {
          throw new BadRequestException('Recovery point does not match snapshot');
        }
      }
      return {
        snapshot,
        recoveryPoint: {
          selectionMode: mode,
          recoveryPointId: snapshot.recoveryPointId,
          snapshotId: snapshot.id,
          verified: snapshot.verificationStatus === 'passed',
          label: mode === 'explicit_recovery_point' ? 'explicit' : 'snapshot',
          capturedAt: snapshot.createdAt,
        },
      };
    }

    // latest_verified
    const all = await this.snapshots.listByTenant(tenantId);
    const verified = all
      .filter((s) => s.verificationStatus === 'passed')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const snapshot = verified[0];
    if (!snapshot) {
      throw new BadRequestException('No verified snapshot available for latest_verified');
    }
    return {
      snapshot,
      recoveryPoint: {
        selectionMode: 'latest_verified',
        recoveryPointId: snapshot.recoveryPointId,
        snapshotId: snapshot.id,
        verified: true,
        label: 'latest_verified',
        capturedAt: snapshot.createdAt,
      },
    };
  }

  private resolveSelectionMode(job: BackupRestoreJob): RecoveryPointSelectionMode {
    const raw = String(job.metadata.recoveryPointSelection ?? '').trim();
    if (raw === 'latest_verified') return 'latest_verified';
    if (raw === 'explicit_recovery_point') return 'explicit_recovery_point';
    if (raw === 'snapshot_identifier') return 'snapshot_identifier';
    if (typeof job.metadata.recoveryPointId === 'string' && job.metadata.recoveryPointId.trim()) {
      return 'explicit_recovery_point';
    }
    if (typeof job.metadata.snapshotId === 'string' && job.metadata.snapshotId.trim()) {
      return 'snapshot_identifier';
    }
    return 'latest_verified';
  }
}
