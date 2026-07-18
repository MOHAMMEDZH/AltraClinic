import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isImportExportCenterEnabled } from '../config/import-export-config';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';
import { ExportRuntimeService } from '../application/export-runtime.service';

function schedulersEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.BACKGROUND_SCHEDULERS_ENABLED === 'false') return false;
  return true;
}

/**
 * Phase 42e — automatic export artifact cleanup (Expired → Deleted).
 */
@Injectable()
export class ExportArtifactCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(ExportArtifactCleanupScheduler.name);
  private runs = 0;
  private lastExpired = 0;
  private lastDeleted = 0;

  constructor(private readonly exportRuntime: ExportRuntimeService) {}

  onModuleInit(): void {
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'artifact_cleanup_scheduler',
        event: 'registered',
        cron: 'EVERY_HOUR',
      }),
    );
  }

  getRunCount(): number {
    return this.runs;
  }

  getLastMetrics(): { expired: number; deleted: number } {
    return { expired: this.lastExpired, deleted: this.lastDeleted };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    if (!schedulersEnabled()) return;
    if (!isImportExportCenterEnabled()) return;
    await this.runOnce();
  }

  /** Manual/test entry. */
  async runOnce(now = new Date()): Promise<{ expired: number; deleted: number }> {
    this.runs += 1;
    const result = await this.exportRuntime.cleanupExpiredArtifacts(now);
    this.lastExpired = result.expired;
    this.lastDeleted = result.deleted;
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'artifact_cleanup_scheduler',
        event: 'ran',
        ...result,
      }),
    );
    return result;
  }
}
