import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DashboardOverviewService } from '../../../dashboard/application/dashboard-overview.service';
import { parseDashboardRange } from '../../../dashboard/application/dashboard-range';
import { ANALYTICS_REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AnalyticsReportRepository } from '../../domain/repositories/analytics-report.repository.interface';
import { ReportFormat, ReportStatus } from '../../domain/entities/analytics-report.entity';
import { ReportQueuedEvent } from '../../domain/events/report-queued.event';
import { buildAnalyticsReportCsv, buildAnalyticsReportExcel, countAnalyticsReportRows, resolveReportExportLocale } from './analytics-report-csv';
import { buildAnalyticsReportPdf } from './analytics-report-pdf';
import { ReportDeliveryService } from './report-delivery.service';
import { buildReportDataset, resolveDatasetBranchId } from './report-dataset.service';
import { ReportWorkspaceService } from '../../../reporting/application/services/report-workspace.service';
import { ReportBrandingService } from '../../../reporting/application/services/report-branding.service';

const STORAGE_ROOT = join(process.cwd(), 'storage', 'analytics-reports');

@Injectable()
export class AnalyticsReportGenerationService {
  private readonly logger = new Logger(AnalyticsReportGenerationService.name);

  constructor(
    @Inject(ANALYTICS_REPORT_REPOSITORY)
    private readonly reports: AnalyticsReportRepository,
    private readonly overviewService: DashboardOverviewService,
    private readonly delivery: ReportDeliveryService,
    private readonly workspace: ReportWorkspaceService,
    private readonly brandingService: ReportBrandingService,
  ) {}

  resolveFilePath(tenantId: string, reportId: string, format: ReportFormat): string {
    const ext =
      format === ReportFormat.JSON ? 'json' : format === ReportFormat.EXCEL ? 'xlsx' : format;
    return join(STORAGE_ROOT, tenantId, `${reportId}.${ext}`);
  }

  async generateFromEvent(event: ReportQueuedEvent): Promise<void> {
    const report = await this.reports.findById(event.reportId, event.tenantId);
    if (!report || report.status !== ReportStatus.QUEUED) {
      return;
    }

    try {
      report.markGenerating();
      await this.reports.save(report);

      const rangeParam = report.parameters?.range;
      const range = parseDashboardRange(typeof rangeParam === 'string' ? rangeParam : undefined);
      const fromParam = report.parameters?.from;
      const toParam = report.parameters?.to;
      const branchId = resolveDatasetBranchId(report.branchId, report.parameters);

      const rawOverview = await this.overviewService.getOverview(
        event.tenantId,
        branchId,
        range,
        event.createdBy,
        typeof fromParam === 'string' ? fromParam : undefined,
        typeof toParam === 'string' ? toParam : undefined,
      );

      const overview = buildReportDataset(rawOverview, report.reportType, report.parameters);

      const dir = join(STORAGE_ROOT, event.tenantId);
      await mkdir(dir, { recursive: true });
      const filePath = this.resolveFilePath(event.tenantId, event.reportId, report.format);

      const locale = resolveReportExportLocale(report.parameters);
      const branding = await this.brandingService.resolveBranding(event.tenantId);
      const brandedTitle = branding.clinicName
        ? `${branding.clinicName} — ${report.name}`
        : report.name;
      const exportMeta = {
        clinicName: branding.clinicName ?? '',
        generatedAt: new Date().toISOString(),
        generatedBy: event.createdBy,
        reportType: report.reportType,
        visualization: report.parameters?.visualization,
        dimensions: report.parameters?.dimensions,
        measures: report.parameters?.measures,
        filters: report.parameters,
      };
      let rowCount = countAnalyticsReportRows(overview);

      switch (report.format) {
        case ReportFormat.CSV:
          await writeFile(
            filePath,
            `# ${brandedTitle}\n# Generated: ${exportMeta.generatedAt}\n# Type: ${report.reportType}\n\n${buildAnalyticsReportCsv(overview, brandedTitle, locale)}`,
            'utf8',
          );
          break;
        case ReportFormat.EXCEL: {
          const excel = await buildAnalyticsReportExcel(overview, brandedTitle, locale);
          await writeFile(filePath, excel);
          break;
        }
        case ReportFormat.JSON:
          await writeFile(
            filePath,
            JSON.stringify({ meta: exportMeta, overview }, null, 2),
            'utf8',
          );
          rowCount = Object.keys(overview.kpis).length + overview.revenueTrend.length;
          break;
        case ReportFormat.PDF: {
          const pdf = await buildAnalyticsReportPdf(overview, brandedTitle, locale, {
            clinicName: branding.clinicName,
            logoBytes: branding.logoBytes,
            logoMimeType: branding.logoMimeType,
          });
          await writeFile(filePath, pdf);
          break;
        }
        default:
          throw new Error(`Unsupported format: ${report.format}`);
      }

      report.markCompleted(`/analytics/reports/${event.reportId}/download`, rowCount);
      await this.reports.save(report);
      await this.delivery.deliverCompletedReport(report);
      await this.workspace.recordAudit(event.tenantId, event.createdBy, event.reportId, 'report.generated', {
        format: report.format,
        rowCount,
      });
      this.logger.log(`Generated analytics report ${event.reportId} (${report.format})`);
    } catch (error) {
      this.logger.error(
        `Analytics report generation failed for ${event.reportId}`,
        error instanceof Error ? error.stack : String(error),
      );
      report.markFailed();
      await this.reports.save(report);
      await this.workspace.recordAudit(event.tenantId, event.createdBy, event.reportId, 'report.failed', {
        reason: error instanceof Error ? error.message : 'Unknown',
      }).catch(() => undefined);
    }
  }
}
