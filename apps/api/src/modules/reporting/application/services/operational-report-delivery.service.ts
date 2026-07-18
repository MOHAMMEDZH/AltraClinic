import { Injectable, Logger } from '@nestjs/common';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { Report } from '../../domain/entities/report.entity';

const PRODUCER_MODULE_ID = 'reporting.operational-report-delivery';

@Injectable()
export class OperationalReportDeliveryService {
  private readonly logger = new Logger(OperationalReportDeliveryService.name);

  constructor(private readonly producer: NotificationIntentProducerService) {}

  async deliverCompleted(report: Report, createdBy: string): Promise<void> {
    if (!report.downloadUrl) return;
    const title = `Report ready: ${report.name}`;
    const body = `${report.name} is ready to download.`;

    await this.producer.produceInApp({
      tenantId: report.tenantId,
      recipientId: createdBy,
      title,
      body,
      priority: 'medium',
      idempotencyKey: `operational-report:${report.reportId}:in-app`,
      producerModuleId: PRODUCER_MODULE_ID,
      metadata: {
        reportId: report.reportId,
        downloadUrl: report.downloadUrl,
        kind: 'operational-report',
      },
    });

    const emails = Array.isArray(report.parameters?.recipientEmails)
      ? (report.parameters.recipientEmails as string[])
      : [];
    for (const addr of emails) {
      await this.sendEmail(report, createdBy, addr, title, body);
    }
  }

  private async sendEmail(
    report: Report,
    createdBy: string,
    to: string,
    title: string,
    body: string,
  ): Promise<void> {
    const downloadPath = report.downloadUrl ?? '';
    await this.producer.produceEmail({
      tenantId: report.tenantId,
      recipientId: createdBy,
      recipientEmail: to,
      title,
      body: `${body}\n\nDownload: ${downloadPath}`,
      priority: 'medium',
      idempotencyKey: `operational-report:${report.reportId}:email:${to}`,
      producerModuleId: PRODUCER_MODULE_ID,
      metadata: {
        reportId: report.reportId,
        downloadUrl: report.downloadUrl,
        kind: 'operational-report',
      },
    });
    this.logger.log(`Operational report email sent → ${to}`);
  }
}
