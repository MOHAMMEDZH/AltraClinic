import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { BeautyDashboardService } from '../services/beauty-dashboard.service';

@Injectable()
export class BeautyDashboardHandler {
  constructor(
    private readonly service: BeautyDashboardService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    return this.service.getDashboard(ctx.tenantId);
  }
}
