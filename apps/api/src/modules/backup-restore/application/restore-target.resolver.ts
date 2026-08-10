import { BadRequestException, Injectable } from '@nestjs/common';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';
import type {
  ResolvedRestoreTarget,
  RestoreTargetKind,
} from '../domain/restore/restore-engine.types';

/**
 * Phase 43e — restore target resolution (compatibility checks only).
 * No live DB / media writes beyond logical scratch destinations.
 */
@Injectable()
export class RestoreTargetResolver {
  readonly ready = true;
  readonly contractVersion = '43e' as const;

  resolve(job: BackupRestoreJob, mode: 'drill' | 'controlled'): ResolvedRestoreTarget {
    const rawKind = String(job.metadata.restoreTargetKind ?? '').trim() as RestoreTargetKind | '';
    const kind: RestoreTargetKind =
      rawKind === 'original' ||
      rawKind === 'alternate' ||
      rawKind === 'tenant_sandbox' ||
      rawKind === 'temporary_validation' ||
      rawKind === 'custom'
        ? rawKind
        : mode === 'drill'
          ? 'temporary_validation'
          : 'original';

    if (mode === 'drill' && kind === 'original') {
      throw new BadRequestException(
        'Drill restore cannot target original location — use temporary_validation or tenant_sandbox',
      );
    }

    if (mode === 'controlled' && kind === 'temporary_validation') {
      throw new BadRequestException(
        'Controlled restore cannot use temporary_validation target',
      );
    }

    const targetId =
      (typeof job.metadata.restoreTargetId === 'string' && job.metadata.restoreTargetId.trim()) ||
      job.metadata.targetId ||
      `${kind}:${job.tenantId}`;

    const destinationKey = [
      'tenants',
      job.tenantId,
      'restore',
      mode,
      kind,
      job.id,
    ].join('/');

    return {
      kind,
      targetId,
      displayName: `Restore target (${kind})`,
      destinationKey,
      compatible: true,
      mode,
    };
  }
}
