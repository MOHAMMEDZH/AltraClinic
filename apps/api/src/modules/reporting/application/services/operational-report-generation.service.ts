import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { ReportRepository } from '../../domain/repositories/report.repository.interface';
import { ReportRequestedEvent } from '../../domain/events/report-requested.event';
import { ReportCompletedEvent } from '../../domain/events/report-completed.event';
import { ReportFailedEvent } from '../../domain/events/report-failed.event';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { OperationalReportDataService } from './operational-report-data.service';
import { buildOperationalExcel, buildOperationalPdf } from './operational-report-export.service';
import { ReportWorkspaceService } from './report-workspace.service';
import { ReportBrandingService } from './report-branding.service';
import { OperationalReportDeliveryService } from './operational-report-delivery.service';

const STORAGE_ROOT = join(process.cwd(), 'storage', 'operational-reports');

@Injectable()
export class OperationalReportGenerationService {
  private readonly logger = new Logger(OperationalReportGenerationService.name);

  constructor(
    @Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly dataService: OperationalReportDataService,
    private readonly workspace: ReportWorkspaceService,
    private readonly brandingService: ReportBrandingService,
    private readonly delivery: OperationalReportDeliveryService,
  ) {}

  resolveFilePath(tenantId: string, reportId: string, format: string): string {
    const ext = format === 'excel' ? 'xlsx' : format;
    return join(STORAGE_ROOT, tenantId, `${reportId}.${ext}`);
  }

  async generateFromEvent(event: ReportRequestedEvent): Promise<void> {
    const report = await this.reports.findById(event.reportId, event.tenantId);
    if (!report) return;

    try {
      report.markGenerating();
      await this.reports.save(report);

      const dateStart = new Date(event.dateRange.start);
      const dateEnd = new Date(event.dateRange.end);
      const data = await this.dataService.build(
        event.tenantId,
        event.reportType,
        dateStart,
        dateEnd,
        event.branchId,
      );

      const branding = await this.brandingService.resolveBranding(event.tenantId);

      const dir = join(STORAGE_ROOT, event.tenantId);
      await mkdir(dir, { recursive: true });
      const format = event.format;
      const filePath = this.resolveFilePath(event.tenantId, event.reportId, format);
      const brandedTitle = branding.clinicName ? `${branding.clinicName} — ${report.name}` : report.name;

      if (format === 'excel') {
        const excel = await buildOperationalExcel(data);
        await writeFile(filePath, excel);
      } else if (format === 'pdf') {
        const pdf = await buildOperationalPdf(data, report.name, {
          clinicName: branding.clinicName,
          logoBytes: branding.logoBytes,
          logoMimeType: branding.logoMimeType,
        });
        await writeFile(filePath, pdf);
      } else {
        await writeFile(filePath, OperationalReportDataService.toCsv(data, brandedTitle), 'utf8');
      }

      const downloadUrl = `/reporting/reports/${event.reportId}/download`;
      report.markCompleted(downloadUrl);
      await this.reports.save(report);

      await this.eventPublisher.publish(
        new ReportCompletedEvent({
          reportId: report.reportId,
          tenantId: report.tenantId,
          downloadUrl,
        }),
      );
      await this.workspace.recordAudit(event.tenantId, event.createdBy, event.reportId, 'report.generated', {
        reportType: event.reportType,
        format,
        rowCount: data.rows.length,
      });
      await this.delivery.deliverCompleted(report, event.createdBy);
      this.logger.log(`Generated operational report ${event.reportId}`);
    } catch (error) {
      this.logger.error(
        `Operational report generation failed for ${event.reportId}`,
        error instanceof Error ? error.stack : String(error),
      );
      report.markFailed();
      await this.reports.save(report);
      await this.eventPublisher.publish(
        new ReportFailedEvent({
          reportId: report.reportId,
          tenantId: report.tenantId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
      await this.workspace.recordAudit(event.tenantId, event.createdBy, event.reportId, 'report.failed', {
        reason: error instanceof Error ? error.message : 'Unknown',
      }).catch(() => undefined);
    }
  }
}
