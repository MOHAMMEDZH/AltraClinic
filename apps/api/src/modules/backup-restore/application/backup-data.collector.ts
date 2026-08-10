import { Injectable } from '@nestjs/common';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';
import type { ResolvedBackupTarget } from '../domain/backup/backup-engine.types';
import { BACKUP_MANIFEST_SCHEMA_VERSION } from '../domain/backup/backup-engine.types';

export interface CollectedBackupPayload {
  schemaVersion: string;
  collectedAt: string;
  tenantId: string;
  target: ResolvedBackupTarget;
  resources: Array<{
    resourceType: string;
    resourceId: string;
    version: string;
    entityCount: number;
  }>;
  /** Deterministic logical bytes — not a live pg_dump / media walk. */
  logicalData: Record<string, unknown>;
}

/**
 * Phase 43c — deterministic logical data collection for registered targets.
 * Does not call live Postgres or Media storage (adapters stay logical).
 */
@Injectable()
export class BackupDataCollector {
  collect(job: BackupRestoreJob, target: ResolvedBackupTarget): CollectedBackupPayload {
    const collectedAt = new Date().toISOString();
    if (target.kind === 'postgres') {
      return {
        schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
        collectedAt,
        tenantId: job.tenantId,
        target,
        resources: [
          {
            resourceType: 'database',
            resourceId: 'primary',
            version: BACKUP_MANIFEST_SCHEMA_VERSION,
            entityCount: 1,
          },
          {
            resourceType: 'tenant',
            resourceId: job.tenantId,
            version: '1',
            entityCount: 1,
          },
        ],
        logicalData: {
          kind: 'postgres-logical',
          tenantId: job.tenantId,
          branchId: job.branchId,
          correlationId: job.correlationId,
          note: 'Logical backup payload (deterministic; no live dump)',
        },
      };
    }

    if (target.kind === 'media') {
      return {
        schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
        collectedAt,
        tenantId: job.tenantId,
        target,
        resources: [
          {
            resourceType: 'media_prefix',
            resourceId: target.targetId,
            version: '1',
            entityCount: 0,
          },
        ],
        logicalData: {
          kind: 'media-prefix',
          prefix: target.targetId,
          tenantId: job.tenantId,
          note: 'Logical media prefix inventory (no byte copy of media store)',
        },
      };
    }

    return {
      schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
      collectedAt,
      tenantId: job.tenantId,
      target,
      resources: [
        {
          resourceType: 'script_bridge',
          resourceId: target.providerKey,
          version: '1',
          entityCount: 1,
        },
      ],
      logicalData: {
        kind: 'script_bridge',
        providerKey: target.providerKey,
        tenantId: job.tenantId,
        note: 'Script-bridge logical payload (compatibility; no shell execution)',
      },
    };
  }
}
