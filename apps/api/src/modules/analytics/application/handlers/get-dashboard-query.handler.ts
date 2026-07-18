import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetDashboardQuery, ListDashboardsQuery } from '../queries';
import { DashboardRepository } from '../../domain/repositories/dashboard.repository.interface';
import { DASHBOARD_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { Dashboard } from '../../domain/entities/dashboard.entity';

/**
 * Get Dashboard Query Handler
 */
@Injectable()
export class GetDashboardQueryHandler {
  constructor(@Inject(DASHBOARD_REPOSITORY) private readonly repository: DashboardRepository) {}

  async execute(query: GetDashboardQuery): Promise<Dashboard> {
    const dashboard = await this.repository.findById(query.dashboardId, query.tenantId);
    if (!dashboard) {
      throw new NotFoundException(`Dashboard ${query.dashboardId} not found`);
    }
    return dashboard;
  }
}

/**
 * List Dashboards Query Handler
 */
@Injectable()
export class ListDashboardsQueryHandler {
  constructor(@Inject(DASHBOARD_REPOSITORY) private readonly repository: DashboardRepository) {}

  private readonly maxLimit = 100;

  async execute(query: ListDashboardsQuery): Promise<Dashboard[]> {
    const limit = Math.min(Math.max(query.limit, 1), this.maxLimit);
    const offset = Math.max(query.offset, 0);

    if (query.dashboardType) {
      return await this.repository.listByType(query.tenantId, query.dashboardType, query.branchId, limit, offset);
    }

    return await this.repository.listByTenant(query.tenantId, query.branchId, limit, offset);
  }
}
