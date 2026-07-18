import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantTimezoneService } from '../services/tenant-timezone.service';

@Injectable()
export class GetSchedulingContextHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantTimezone: TenantTimezoneService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { timezone: true, locale: true },
    });

    const timezone = await this.tenantTimezone.resolve();

    return {
      timezone,
      locale: row?.locale ?? tenant.locale ?? 'en-US',
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
    };
  }
}
