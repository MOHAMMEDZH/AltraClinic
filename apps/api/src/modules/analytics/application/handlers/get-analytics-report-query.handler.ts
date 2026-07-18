import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetAnalyticsReportQuery, ListAnalyticsReportsQuery } from '../queries';
import { AnalyticsReportRepository } from '../../domain/repositories/analytics-report.repository.interface';
import { ANALYTICS_REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AnalyticsReport } from '../../domain/entities/analytics-report.entity';

/**
 * Get Analytics Report Query Handler
 */
@Injectable()
export class GetAnalyticsReportQueryHandler {
  constructor(@Inject(ANALYTICS_REPORT_REPOSITORY) private readonly repository: AnalyticsReportRepository) {}

  async execute(query: GetAnalyticsReportQuery): Promise<AnalyticsReport> {
    const report = await this.repository.findById(query.reportId, query.tenantId);
    if (!report) {
      throw new NotFoundException(`Report ${query.reportId} not found`);
    }
    return report;
  }
}

/**
 * List Analytics Reports Query Handler
 */
@Injectable()
export class ListAnalyticsReportsQueryHandler {
  constructor(@Inject(ANALYTICS_REPORT_REPOSITORY) private readonly repository: AnalyticsReportRepository) {}

  private readonly maxLimit = 100;

  async execute(query: ListAnalyticsReportsQuery): Promise<AnalyticsReport[]> {
    const limit = Math.min(Math.max(query.limit, 1), this.maxLimit);
    const offset = Math.max(query.offset, 0);

    if (query.reportType) {
      return await this.repository.listByType(query.tenantId, query.reportType, query.branchId, limit, offset);
    }

    return await this.repository.listByTenant(query.tenantId, query.branchId, limit, offset);
  }
}
