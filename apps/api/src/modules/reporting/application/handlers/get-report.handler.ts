import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetReportQuery } from '../queries/get-report.query';
import { ReportRepository } from '../../domain/repositories/report.repository.interface';
import { REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class GetReportHandler {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetReportQuery): Promise<{
    reportId: string;
    name: string;
    type: string;
    format: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    downloadUrl: string | null;
    createdBy: string;
    kind: 'operational';
  }> {
    if (!query.reportId?.trim()) throw new BadRequestException('reportId is required');

    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const report = await this.repository.findById(query.reportId, tenantId);
    if (!report) throw new NotFoundException('Report not found');

    return {
      reportId: report.reportId,
      name: report.name,
      type: report.type.type,
      format: report.format.format,
      status: report.status.status,
      createdAt: report.createdAt.toISOString(),
      completedAt: report.completedAt?.toISOString() ?? null,
      downloadUrl: report.downloadUrl,
      createdBy: report.createdBy,
      kind: 'operational',
    };
  }
}
