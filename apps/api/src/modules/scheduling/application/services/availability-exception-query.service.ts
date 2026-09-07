import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { zonedDayBoundsUtc } from '../../domain/scheduling-timezone.util';
import type { AvailabilityExceptionInterval } from '../../domain/availability-exception-evaluator';

@Injectable()
export class AvailabilityExceptionQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listOverlappingDay(input: {
    tenantId: string;
    dateYmd: string;
    timezone: string;
    branchId?: string | null;
  }): Promise<AvailabilityExceptionInterval[]> {
    const { start, end } = zonedDayBoundsUtc(input.dateYmd, input.timezone);
    const rows = await this.prisma.withTenantContext(input.tenantId, async (c) =>
      c.availabilityException.findMany({
        where: {
          tenantId: input.tenantId,
          deletedAt: null,
          startsAt: { lt: end },
          endsAt: { gt: start },
          OR: [
            { branchId: null },
            ...(input.branchId ? [{ branchId: input.branchId }] : []),
          ],
        },
        orderBy: { startsAt: 'asc' },
      }),
    );

    return rows.map((row) => ({
      type: row.type,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      branchId: row.branchId,
      providerId: row.providerId,
      resourceId: row.resourceId,
    }));
  }
}
