import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { normalizeTimezone } from '../../domain/scheduling-timezone.util';

@Injectable()
export class TenantTimezoneService {
  private cachedTenantId: string | null = null;
  private cachedTimezone: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async resolve(): Promise<string> {
    const tenant = await this.tenantContext.resolve();
    const fromContext = normalizeTimezone(tenant.timezone);
    if (fromContext !== 'UTC') return fromContext;

    if (this.cachedTenantId === tenant.tenantId && this.cachedTimezone) {
      return this.cachedTimezone;
    }

    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { timezone: true },
    });

    const timezone = normalizeTimezone(row?.timezone);
    this.cachedTenantId = tenant.tenantId;
    this.cachedTimezone = timezone;
    return timezone;
  }
}
