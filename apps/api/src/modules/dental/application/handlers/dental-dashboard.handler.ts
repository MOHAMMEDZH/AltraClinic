import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { DentalDashboardService } from '../services/dental-dashboard.service';

@Injectable()
export class DentalDashboardHandler {
  constructor(
    private readonly service: DentalDashboardService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.service.getDashboard(tenant.tenantId);
  }
}
