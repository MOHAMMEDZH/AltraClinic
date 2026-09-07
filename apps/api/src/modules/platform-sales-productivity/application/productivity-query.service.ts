import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { SALES_PRODUCTIVITY_PERMISSIONS } from '../platform-sales-productivity.constants';
import { utcMonthPeriod } from '../domain/period.util';
import {
  SalesProductivityForbiddenError,
  SalesProductivityNotFoundError,
  SalesProductivityValidationError,
} from '../domain/sales-productivity.errors';
import type { ProductivityMetricsBundle } from '../domain/sales-productivity.types';
import { ProductivityMetricsService } from './productivity-metrics.service';
import {
  assertRepresentativeInScope,
  resolveProductivityVisibility,
  scopedRepresentativeIds,
} from './productivity-visibility';

/**
 * Flexible Step 26 — productivity self/team read queries (scope-enforced).
 */
@Injectable()
export class ProductivityQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: ProductivityMetricsService,
  ) {}

  private assertPlatform(user: JwtClaimsVO): void {
    if (user.principalType !== 'platform' || user.sessionClass !== 'platform') {
      throw new SalesProductivityForbiddenError('Clinic principals are denied.');
    }
  }

  private parsePeriod(periodKey?: string): string {
    if (!periodKey?.trim()) {
      throw new SalesProductivityValidationError('periodKey query parameter is required (YYYY-MM).');
    }
    try {
      return utcMonthPeriod(periodKey.trim()).periodKey;
    } catch {
      throw new SalesProductivityValidationError('Invalid periodKey; expected YYYY-MM.');
    }
  }

  async self(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    periodKey?: string,
  ): Promise<ProductivityMetricsBundle> {
    this.assertPlatform(user);
    if (!perms.has(SALES_PRODUCTIVITY_PERMISSIONS.reportView)) {
      throw new SalesProductivityForbiddenError(
        `Missing ${SALES_PRODUCTIVITY_PERMISSIONS.reportView}`,
      );
    }
    const key = this.parsePeriod(periodKey);
    return this.prisma.withPlatformBypass(async (client) => {
      const rep = await client.platformSalesRepresentative.findUnique({
        where: { platformUserId: user.sub },
        select: { id: true, status: true },
      });
      if (!rep) throw new SalesProductivityNotFoundError('No representative profile for actor.');
      if (rep.status === 'SUSPENDED' || rep.status === 'DISABLED') {
        throw new SalesProductivityForbiddenError('Representative profile is not active.');
      }
      return this.metrics.computeForRepresentative({
        representativeId: rep.id,
        periodKey: key,
      });
    });
  }

  async team(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    query: { periodKey?: string; representativeId?: string },
  ): Promise<{ items: ProductivityMetricsBundle[]; periodKey: string }> {
    this.assertPlatform(user);
    if (!perms.has(SALES_PRODUCTIVITY_PERMISSIONS.reportView)) {
      throw new SalesProductivityForbiddenError(
        `Missing ${SALES_PRODUCTIVITY_PERMISSIONS.reportView}`,
      );
    }
    const key = this.parsePeriod(query.periodKey);

    const repIds = await this.prisma.withPlatformBypass(async (client) => {
      const scope = await resolveProductivityVisibility(client, user.sub, perms, 'report');
      if (scope.kind === 'own') {
        throw new SalesProductivityForbiddenError(
          'Team productivity requires manager/review scope.',
        );
      }
      if (query.representativeId) {
        assertRepresentativeInScope(scope, query.representativeId);
        return [query.representativeId];
      }
      const scoped = scopedRepresentativeIds(scope);
      if (scoped === null) {
        const all = await client.platformSalesRepresentative.findMany({
          where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 500,
        });
        return all.map((r) => r.id);
      }
      return scoped;
    });

    const items: ProductivityMetricsBundle[] = [];
    for (const representativeId of repIds) {
      items.push(
        await this.metrics.computeForRepresentative({ representativeId, periodKey: key }),
      );
    }
    return { items, periodKey: key };
  }
}
