import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isImportExportCenterEnabled } from '../config/import-export-config';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';
import { ImportExportJobService } from '../application/import-export-job.service';

function schedulersEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.BACKGROUND_SCHEDULERS_ENABLED === 'false') return false;
  return true;
}

/**
 * Phase 42d — automatic Import/Export job expiration.
 */
@Injectable()
export class ImportExportExpirationScheduler implements OnModuleInit {
  private readonly logger = new Logger(ImportExportExpirationScheduler.name);
  private runs = 0;

  constructor(private readonly jobs: ImportExportJobService) {}

  onModuleInit(): void {
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'expiration_scheduler',
        event: 'registered',
        cron: 'EVERY_HOUR',
      }),
    );
  }

  getRunCount(): number {
    return this.runs;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireJobs(): Promise<void> {
    if (!schedulersEnabled()) return;
    if (!isImportExportCenterEnabled()) return;
    await this.runOnce();
  }

  /** Manual/test entry. */
  async runOnce(now = new Date()): Promise<number> {
    this.runs += 1;
    const count = await this.jobs.expireDueJobs(now);
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'expiration_scheduler',
        event: 'ran',
        expired: count,
      }),
    );
    return count;
  }
}
