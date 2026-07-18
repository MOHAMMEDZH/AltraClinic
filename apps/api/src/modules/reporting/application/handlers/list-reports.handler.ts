import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ListReportsQuery } from '../queries/list-reports.query';
import { ReportRepository } from '../../domain/repositories/report.repository.interface';
import { REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListReportsHandler {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    query: ListReportsQuery,
  ): Promise<{ reports: { reportId: string; name: string; type: string; format: string; status: string; createdAt: string; downloadUrl: string | null }[] }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const reports = await this.repository.list({
      tenantId,
      branchId: query.branchId ?? null,
      createdBy: query.createdBy ?? null,
      type: query.type ?? null,
      status: query.status ?? null,
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
    });

    return {
      reports: reports.map((report) => ({
        reportId: report.reportId,
        name: report.name,
        type: report.type.type,
        format: report.format.format,
        status: report.status.status,
        createdAt: report.createdAt.toISOString(),
        downloadUrl: report.downloadUrl,
      })),
    };
  }
}
