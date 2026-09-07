import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { csvSafeCell } from '../../platform-audit-center/application/audit-center-redaction';
import {
  SALES_COMMISSION_AUDIT_ACTIONS,
  SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
  SALES_PRODUCTIVITY_PERMISSIONS,
  isSalesProductivityFailureInjectionActive,
} from '../platform-sales-productivity.constants';
import { utcMonthPeriod } from '../domain/period.util';
import {
  SalesProductivityError,
  SalesProductivityForbiddenError,
  SalesProductivityValidationError,
} from '../domain/sales-productivity.errors';
import { CommissionAuditLog } from './commission-audit.log';
import { ProductivityMetricsService } from './productivity-metrics.service';
import {
  assertRepresentativeInScope,
  resolveProductivityVisibility,
  scopedRepresentativeIds,
} from './productivity-visibility';

/**
 * Flexible Step 26 — CSV export for productivity metrics (same scope as view).
 * Formula-injection mitigated via csvSafeCell; Unicode preserved.
 */
@Injectable()
export class ProductivityExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: ProductivityMetricsService,
    private readonly audit: CommissionAuditLog,
  ) {}

  async exportCsv(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: { periodKey: string; representativeId?: string },
  ): Promise<{ filename: string; body: string }> {
    if (user.principalType !== 'platform' || user.sessionClass !== 'platform') {
      throw new SalesProductivityForbiddenError('Clinic principals are denied.');
    }
    if (
      !perms.has(SALES_PRODUCTIVITY_PERMISSIONS.reportExport) &&
      !perms.has(SALES_PRODUCTIVITY_PERMISSIONS.reportView)
    ) {
      throw new SalesProductivityForbiddenError(
        `Missing ${SALES_PRODUCTIVITY_PERMISSIONS.reportExport}`,
      );
    }

    let period;
    try {
      period = utcMonthPeriod(input.periodKey);
    } catch {
      throw new SalesProductivityValidationError('periodKey is required (YYYY-MM).');
    }

    const { repIds, scopeKind } = await this.prisma.withPlatformBypass(async (client) => {
      const scope = await resolveProductivityVisibility(client, user.sub, perms, 'report');
      if (input.representativeId) {
        assertRepresentativeInScope(scope, input.representativeId);
        return { repIds: [input.representativeId], scopeKind: scope.kind };
      }
      const scoped = scopedRepresentativeIds(scope);
      if (scoped === null) {
        const all = await client.platformSalesRepresentative.findMany({
          where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 500,
        });
        return { repIds: all.map((r) => r.id), scopeKind: scope.kind };
      }
      return { repIds: scoped, scopeKind: scope.kind };
    });

    const header = [
      'representativeId',
      'periodKey',
      'periodTimezone',
      'metricId',
      'metricKey',
      'value',
      'completeness',
      'numerator',
      'denominator',
      'explanation',
      'rankingEligible',
      'reportingCompleteness',
    ];
    const lines = [header.map(csvSafeCell).join(',')];

    for (const representativeId of repIds) {
      const bundle = await this.metrics.computeForRepresentative({
        representativeId,
        periodKey: period.periodKey,
      });
      for (const m of bundle.metrics) {
        lines.push(
          [
            representativeId,
            bundle.periodKey,
            bundle.periodTimezone,
            m.id,
            m.key,
            m.value ?? '',
            m.completeness,
            m.numerator ?? '',
            m.denominator ?? '',
            m.explanation ?? '',
            m.rankingEligible ? 'true' : 'false',
            bundle.completeness.reporting_completeness,
          ]
            .map(csvSafeCell)
            .join(','),
        );
      }
    }

    // F20 — fail before any response body is returned (no partial/corrupt CSV artifact).
    if (isSalesProductivityFailureInjectionActive('during_export_serialize')) {
      throw new SalesProductivityError(
        'injected_failure',
        'Injected export serialization failure',
        500,
      );
    }

    await this.audit.record({
      action: SALES_COMMISSION_AUDIT_ACTIONS.EXPORTED,
      resourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
      resourceId: '00000000-0000-0000-0000-000000000000',
      actorId: user.sub,
      actorRoles: ['platform'],
      result: 'success',
      descriptionEn: 'Sales productivity CSV exported',
      descriptionAr: 'تم تصدير إنتاجية المبيعات',
      details: {
        periodKey: period.periodKey,
        representativeCount: repIds.length,
        scopeKind,
      },
    });

    return {
      filename: `sales-productivity-${period.periodKey}.csv`,
      body: lines.join('\n') + '\n',
    };
  }
}
