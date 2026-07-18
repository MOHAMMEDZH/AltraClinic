import { Injectable, Logger } from '@nestjs/common';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { AnalyticsReport, ReportStatus } from '../../domain/entities/analytics-report.entity';

const PRODUCER_MODULE_ID = 'analytics.report-delivery';

@Injectable()
export class ReportDeliveryService {
  private readonly logger = new Logger(ReportDeliveryService.name);

  constructor(private readonly producer: NotificationIntentProducerService) {}

  async deliverCompletedReport(report: AnalyticsReport): Promise<void> {
    if (!report.downloadUrl || report.status !== ReportStatus.COMPLETED) return;

    const title = `Report ready: ${report.name}`;
    const body = `${report.name} (${String(report.format).toUpperCase()}) is ready to download.`;

    await this.producer.produceInApp({
      tenantId: report.tenantId,
      recipientId: report.createdBy,
      title,
      body,
      priority: 'medium',
      idempotencyKey: `analytics-report:${report.reportId}:in-app`,
      producerModuleId: PRODUCER_MODULE_ID,
      metadata: {
        reportId: report.reportId,
        downloadUrl: report.downloadUrl,
        format: report.format,
        kind: 'analytics-report',
      },
    });

    for (const addr of report.recipientEmails) {
      await this.sendReportEmail(report, addr, title, body);
    }
  }

  private async sendReportEmail(
    report: AnalyticsReport,
    to: string,
    title: string,
    body: string,
  ): Promise<void> {
    await this.producer.produceEmail({
      tenantId: report.tenantId,
      recipientId: report.createdBy,
      recipientEmail: to,
      title,
      body: `${body}\n\nDownload: ${report.downloadUrl}`,
      priority: 'medium',
      idempotencyKey: `analytics-report:${report.reportId}:email:${to}`,
      producerModuleId: PRODUCER_MODULE_ID,
      metadata: {
        reportId: report.reportId,
        downloadUrl: report.downloadUrl,
        format: report.format,
        kind: 'analytics-report',
      },
    });
    this.logger.log(`Report email delivered ${report.reportId} → ${to}`);
  }
}
