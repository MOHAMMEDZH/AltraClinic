import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ANALYTICS_REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AnalyticsReportRepository } from '../../domain/repositories/analytics-report.repository.interface';

export class UpdateAnalyticsReportCommand {
  constructor(
    public readonly reportId: string,
    public readonly tenantId: string,
    public readonly isScheduled?: boolean,
    public readonly scheduleFrequency?: 'daily' | 'weekly' | 'monthly',
    public readonly recipientEmails?: string[],
    public readonly name?: string,
  ) {}
}

@Injectable()
export class UpdateAnalyticsReportHandler {
  constructor(
    @Inject(ANALYTICS_REPORT_REPOSITORY) private readonly repository: AnalyticsReportRepository,
  ) {}

  async execute(command: UpdateAnalyticsReportCommand) {
    const report = await this.repository.findById(command.reportId, command.tenantId);
    if (!report) throw new NotFoundException('Report not found');

    report.updateSchedule({
      isScheduled: command.isScheduled,
      scheduleFrequency: command.scheduleFrequency,
      recipientEmails: command.recipientEmails,
      name: command.name,
    });
    await this.repository.save(report);
    return report.toJSON();
  }
}

@Injectable()
export class DeleteAnalyticsReportHandler {
  constructor(
    @Inject(ANALYTICS_REPORT_REPOSITORY) private readonly repository: AnalyticsReportRepository,
  ) {}

  async execute(reportId: string, tenantId: string): Promise<{ ok: true }> {
    if (!reportId?.trim()) throw new BadRequestException('reportId is required');
    const report = await this.repository.findById(reportId, tenantId);
    if (!report) throw new NotFoundException('Report not found');
    await this.repository.delete(reportId, tenantId);
    return { ok: true };
  }
}
