import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { GenerateAnalyticsReportCommand } from '../commands/generate-analytics-report.command';
import { AnalyticsReportRepository } from '../../domain/repositories/analytics-report.repository.interface';
import { AnalyticsReport, ReportFormat } from '../../domain/entities/analytics-report.entity';
import { ReportQueuedEvent } from '../../domain/events/report-queued.event';
import { ANALYTICS_REPORT_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';

/**
 * Generate Analytics Report Handler
 * Executes GenerateAnalyticsReportCommand to create and generate a new analytics report
 */
@Injectable()
export class GenerateAnalyticsReportHandler {
  constructor(
    @Inject(ANALYTICS_REPORT_REPOSITORY) private readonly repository: AnalyticsReportRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: GenerateAnalyticsReportCommand): Promise<{ reportId: string; status: string }> {
    // Map format string to ReportFormat enum
    const formatMap: Record<string, ReportFormat> = {
      pdf: ReportFormat.PDF,
      excel: ReportFormat.EXCEL,
      csv: ReportFormat.CSV,
      json: ReportFormat.JSON,
    };

    const format = formatMap[command.format];
    if (!format) {
      throw new BadRequestException(`Invalid report format: ${command.format}`);
    }

    // Create analytics report aggregate
    const report = AnalyticsReport.create({
      tenantId: command.tenantId,
      branchId: command.branchId,
      name: command.name,
      description: command.description,
      reportType: command.reportType,
      format,
      createdBy: command.createdBy,
      parameters: command.parameters,
      recipientEmails: command.recipientEmails,
      isScheduled: command.isScheduled ?? false,
      scheduleFrequency: command.scheduleFrequency,
    });

    // Save to repository (will be in QUEUED status)
    await this.repository.save(report);

    // Publish an event so downstream workers can start report generation.
    const queuedEvent = new ReportQueuedEvent(
      report.reportId,
      report.tenantId,
      report.name,
      report.reportType,
      report.format,
      report.createdBy,
      report.branchId,
      report.isScheduled,
      report.scheduleFrequency,
    );
    await this.eventPublisher.publish(queuedEvent);

    return {
      reportId: report.reportId,
      status: report.status,
    };
  }
}
