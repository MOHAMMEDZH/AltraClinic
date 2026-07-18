import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestReportCommand } from '../commands/request-report.command';
import { ReportRepository } from '../../domain/repositories/report.repository.interface';
import { Report } from '../../domain/entities/report.entity';
import { ReportType } from '../../domain/value-objects/report-type.vo';
import { ReportFormat } from '../../domain/value-objects/report-format.vo';
import { DateRange } from '../../domain/value-objects/date-range.vo';
import { ReportRequestedEvent } from '../../domain/events/report-requested.event';
import { EVENT_PUBLISHER, REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

/** Report types that require the advancedAnalytics feature flag. */
const ADVANCED_REPORT_TYPES = new Set(['compliance-report']);

@Injectable()
export class RequestReportHandler {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly tenantContext: TenantContextService,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  public async execute(command: RequestReportCommand): Promise<{ reportId: string }> {
    const type = this.resolveType(command.type);
    const format = this.resolveFormat(command.format);
    const dateRange = DateRange.create(command.startDate, command.endDate);

    const tenantId = await this.resolveTenantId(command);

    await this.enforcement.enforceReportLimit(tenantId);

    // Compliance reports are an advanced feature (Pro/Enterprise only)
    if (ADVANCED_REPORT_TYPES.has(command.type)) {
      await this.enforcement.enforceFeature(tenantId, 'advancedAnalytics');
    }

    const report = Report.create({
      tenantId,
      branchId: command.branchId ?? null,
      createdBy: command.createdBy,
      name: command.name,
      type,
      format,
      dateRange,
      parameters: command.parameters ?? {},
    });

    await this.repository.save(report);

    await this.eventPublisher.publish(
      new ReportRequestedEvent({
        reportId: report.reportId,
        tenantId: report.tenantId,
        branchId: report.branchId,
        createdBy: report.createdBy,
        reportType: report.type.type,
        format: report.format.format,
        dateRange: report.dateRange.toJSON(),
        parameters: report.parameters,
      }),
    );

    return { reportId: report.reportId };
  }

  private resolveType(type: string): ReportType {
    switch (type) {
      case 'appointment-report': return ReportType.appointment();
      case 'revenue-report':     return ReportType.revenue();
      case 'patient-report':     return ReportType.patient();
      case 'compliance-report':  return ReportType.compliance();
      default: throw new BadRequestException('Invalid report type');
    }
  }

  private resolveFormat(format: string): ReportFormat {
    switch (format) {
      case 'pdf':   return ReportFormat.pdf();
      case 'csv':   return ReportFormat.csv();
      case 'excel': return ReportFormat.excel();
      default: throw new BadRequestException('Invalid report format');
    }
  }

  private async resolveTenantId(command: RequestReportCommand): Promise<string> {
    try {
      const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
      const tenantId = tenantCtx?.tenantId?.trim();
      if (tenantId) return tenantId;
    } catch {
      // fall through to legacy path
    }
    const parts = command.createdBy.split('@');
    if (parts.length === 2 && parts[1].trim()) {
      return parts[1].trim();
    }
    throw new BadRequestException('Tenant context could not be resolved');
  }
}
