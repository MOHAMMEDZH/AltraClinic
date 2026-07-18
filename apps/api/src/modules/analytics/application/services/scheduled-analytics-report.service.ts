import { Inject, Injectable, Logger } from '@nestjs/common';
import { ANALYTICS_REPORT_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { AnalyticsReportRepository } from '../../domain/repositories/analytics-report.repository.interface';
import { ReportQueuedEvent } from '../../domain/events/report-queued.event';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';

function hoursSince(date: Date | null, now: Date): number {
  if (!date) return Number.POSITIVE_INFINITY;
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

function isDue(frequency: string | undefined, lastRun: Date | null, now: Date): boolean {
  const h = hoursSince(lastRun, now);
  switch (frequency) {
    case 'daily':
      return h >= 24;
    case 'weekly':
      return h >= 24 * 7;
    case 'monthly':
      return h >= 24 * 28;
    default:
      return h >= 24 * 7;
  }
}

export interface ScheduledReportScanResult {
  templatesScanned: number;
  reportsQueued: number;
  skippedNotDue: number;
}

@Injectable()
export class ScheduledAnalyticsReportService {
  private readonly logger = new Logger(ScheduledAnalyticsReportService.name);

  constructor(
    @Inject(ANALYTICS_REPORT_REPOSITORY) private readonly reports: AnalyticsReportRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanAndRunDueReports(now = new Date()): Promise<ScheduledReportScanResult> {
    const result: ScheduledReportScanResult = {
      templatesScanned: 0,
      reportsQueued: 0,
      skippedNotDue: 0,
    };

    const templates = await this.reports.listAllScheduledTemplates();
    result.templatesScanned = templates.length;

    for (const template of templates) {
      if (!isDue(template.scheduleFrequency, template.lastScheduledRunAt, now)) {
        result.skippedNotDue++;
        continue;
      }

      const allowed = await this.licensing.allowWorkerExecution({
        tenantId: template.tenantId,
        workerName: 'scheduled-reports',
        moduleId: 'analytics',
        featureId: 'analytics',
        source: 'worker.scheduled_reports',
      });
      if (!allowed) continue;

      const run = template.cloneForScheduledRun();
      await this.reports.save(run);
      template.recordScheduledRun();
      await this.reports.save(template);

      await this.eventPublisher.publish(
        new ReportQueuedEvent(
          run.reportId,
          run.tenantId,
          run.name,
          run.reportType,
          run.format,
          run.createdBy,
          run.branchId,
          false,
          undefined,
        ),
      );

      result.reportsQueued++;
      this.logger.log(`Queued scheduled run ${run.reportId} from template ${template.reportId}`);
    }

    return result;
  }
}
