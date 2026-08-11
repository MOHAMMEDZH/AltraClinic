import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { utcMonthPeriod } from '../domain/period.util';
import {
  SalesProductivityNotFoundError,
  SalesProductivityValidationError,
} from '../domain/sales-productivity.errors';
import type {
  AddOnAttribution,
  CancellationAttribution,
  Completeness,
  CompletenessBundle,
  MetricKey,
  MetricValue,
  PlanVersionAttribution,
  ProductivityMetricsBundle,
} from '../domain/sales-productivity.types';
import { isSalesProductivityFailureInjectionActive } from '../platform-sales-productivity.constants';

function metric(
  id: MetricValue['id'],
  key: MetricKey,
  value: number | null,
  completeness: Completeness,
  extras?: Partial<MetricValue>,
): MetricValue {
  const rankingEligible =
    extras?.rankingEligible ??
    (completeness === 'COMPLETE' && value !== null && key !== 'plan_version_mix');
  return {
    id,
    key,
    value,
    completeness,
    rankingEligible,
    ...extras,
  };
}

function worstCompleteness(values: Completeness[]): Completeness {
  const rank: Record<Completeness, number> = {
    COMPLETE: 0,
    NOT_APPLICABLE: 1,
    PARTIAL: 2,
    UNAVAILABLE: 3,
  };
  let worst: Completeness = 'COMPLETE';
  for (const v of values) {
    if (rank[v] > rank[worst]) worst = v;
  }
  return worst;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function asAttributionId(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const s = snapshot as Record<string, unknown>;
  const salesAttributionId =
    typeof s.salesAttributionId === 'string' ? s.salesAttributionId : null;
  const ownerRepresentativeId =
    typeof s.ownerRepresentativeId === 'string' ? s.ownerRepresentativeId : null;
  return salesAttributionId ?? ownerRepresentativeId;
}

/**
 * Flexible Step 26 — compute M01–M20 for one representative + UTC month period.
 * Rates stay null when denominators are 0 (never coerced to 0%).
 */
@Injectable()
export class ProductivityMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeForRepresentative(input: {
    representativeId: string;
    periodKey: string;
    sourceCutoffAt?: Date;
  }): Promise<ProductivityMetricsBundle> {
    const period = utcMonthPeriod(input.periodKey);
    const sourceCutoffAt = input.sourceCutoffAt ?? new Date();

    return this.prisma.withPlatformBypass(async (client) => {
      const rep = await client.platformSalesRepresentative.findUnique({
        where: { id: input.representativeId },
        select: {
          id: true,
          status: true,
          targetAmount: true,
          targetCurrency: true,
          targetPeriod: true,
        },
      });
      if (!rep) throw new SalesProductivityNotFoundError('Representative not found.');

      const start = period.periodStart;
      const end = period.periodEnd;
      // Late-arriving rows: include when event timestamp is in bound and observed by cutoff.
      const eventUpper = sourceCutoffAt < end ? sourceCutoffAt : end;

      const leadsCreated = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          createdAt: { gte: start, lt: eventUpper },
        },
      });
      const leadsCreatedNullOwnerGap = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: null,
          createdAt: { gte: start, lt: eventUpper },
        },
      });

      const notesCount = await client.platformSalesLeadNote.count({
        where: {
          createdAt: { gte: start, lt: eventUpper },
          lead: { ownerRepresentativeId: rep.id },
        },
      });
      const demoUpdates = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          demoStatus: { in: ['SCHEDULED', 'COMPLETED', 'CANCELLED'] },
          updatedAt: { gte: start, lt: eventUpper },
        },
      });
      const nextActionUpdates = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          nextActionType: { not: null },
          updatedAt: { gte: start, lt: eventUpper },
        },
      });
      const activities = notesCount + demoUpdates + nextActionUpdates;

      const demosScheduled = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          demoStatus: { in: ['SCHEDULED', 'COMPLETED', 'CANCELLED'] },
          demoScheduledAt: { gte: start, lt: eventUpper },
        },
      });
      const demosScheduledMissingTz = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          demoStatus: { in: ['SCHEDULED', 'COMPLETED', 'CANCELLED'] },
          demoScheduledAt: { gte: start, lt: eventUpper },
          OR: [{ demoTimezone: null }, { demoTimezone: '' }],
        },
      });

      const demosCompleted = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          demoStatus: 'COMPLETED',
          updatedAt: { gte: start, lt: eventUpper },
        },
      });

      const trialsCreated = await client.platformSalesTrial.count({
        where: {
          ownerRepresentativeId: rep.id,
          createdAt: { gte: start, lt: eventUpper },
        },
      });

      const wonHistory = await client.platformSalesLeadStageHistory.count({
        where: {
          toStage: 'WON',
          createdAt: { gte: start, lt: eventUpper },
          lead: { ownerRepresentativeId: rep.id },
        },
      });
      const lostHistory = await client.platformSalesLeadStageHistory.count({
        where: {
          toStage: 'LOST',
          createdAt: { gte: start, lt: eventUpper },
          lead: { ownerRepresentativeId: rep.id },
        },
      });
      const historyMissingWonFallback = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          stage: 'WON',
          updatedAt: { gte: start, lt: eventUpper },
          stageHistory: { none: { toStage: 'WON' } },
        },
      });
      const historyMissingLostFallback = await client.platformSalesLead.count({
        where: {
          ownerRepresentativeId: rep.id,
          stage: 'LOST',
          updatedAt: { gte: start, lt: eventUpper },
          stageHistory: { none: { toStage: 'LOST' } },
        },
      });
      const won = wonHistory + historyMissingWonFallback;
      const lost = lostHistory + historyMissingLostFallback;
      const wonCompleteness: Completeness =
        historyMissingWonFallback > 0 || historyMissingLostFallback > 0
          ? 'PARTIAL'
          : 'COMPLETE';

      const conversions = await client.platformSalesTrialConversion.findMany({
        where: { convertedAt: { gte: start, lt: eventUpper } },
        select: {
          id: true,
          targetPaidPlanVersionId: true,
          convertedAt: true,
          dispositionsJson: true,
          trial: {
            select: {
              id: true,
              platformTenantId: true,
              originatingLeadId: true,
              ownerRepresentativeId: true,
              attributionSnapshotJson: true,
              createdAt: true,
            },
          },
        },
      });

      const attributedConversions = conversions.filter((c) => {
        const attr = asAttributionId(c.trial.attributionSnapshotJson) ?? c.trial.ownerRepresentativeId;
        return attr === rep.id;
      });
      const paidConversions = attributedConversions.length;
      const paidMissingAttr = attributedConversions.filter((c) => {
        const snap = c.trial.attributionSnapshotJson;
        return !asAttributionId(snap);
      }).length;

      const planMixMap = new Map<string, number>();
      for (const c of attributedConversions) {
        planMixMap.set(
          c.targetPaidPlanVersionId,
          (planMixMap.get(c.targetPaidPlanVersionId) ?? 0) + 1,
        );
      }
      const planVersionAttribution: PlanVersionAttribution[] = [...planMixMap.entries()].map(
        ([planVersionId, count]) => ({ planVersionId, count }),
      );

      const convertDays: number[] = [];
      for (const c of attributedConversions) {
        if (!c.trial.originatingLeadId) continue;
        const lead = await client.platformSalesLead.findUnique({
          where: { id: c.trial.originatingLeadId },
          select: { createdAt: true },
        });
        if (!lead) continue;
        const days =
          (c.convertedAt.getTime() - lead.createdAt.getTime()) / (24 * 60 * 60 * 1000);
        if (days >= 0) convertDays.push(days);
      }
      const timeToConvert = median(convertDays);
      const timeToConvertCompleteness: Completeness =
        convertDays.length === 0
          ? 'NOT_APPLICABLE'
          : convertDays.length < 3
            ? 'PARTIAL'
            : 'COMPLETE';

      const ownerships = await client.platformSalesCustomerOwnership.findMany({
        where: { representativeId: rep.id },
        select: { platformTenantId: true },
      });
      const ownedTenantIds = ownerships.map((o) => o.platformTenantId);
      let activeCustomers = 0;
      if (ownedTenantIds.length > 0) {
        activeCustomers = await client.platformSubscriptionCommercialConfig.count({
          where: {
            platformTenantId: { in: ownedTenantIds },
            isCurrent: true,
            lifecycle: 'ACTIVE_COMMERCIAL',
            OR: [{ activatedAt: null }, { activatedAt: { lte: sourceCutoffAt } }],
          },
        });
      }

      const cancelledConfigs =
        ownedTenantIds.length === 0
          ? []
          : await client.platformSubscriptionCommercialConfig.findMany({
              where: {
                platformTenantId: { in: ownedTenantIds },
                lifecycle: 'CANCELLED',
                OR: [
                  { cancelledAt: { gte: start, lt: eventUpper } },
                  {
                    cancelledAt: null,
                    cancellationEffectiveAt: { gte: start, lt: eventUpper },
                  },
                ],
              },
              select: {
                id: true,
                platformTenantId: true,
                cancelledAt: true,
                cancellationEffectiveAt: true,
              },
            });
      const cancellations = cancelledConfigs.length;
      const cancellationAttribution: CancellationAttribution = {
        count: cancellations,
        basis: 'current_ownership_partial',
        completeness: cancellations > 0 ? 'PARTIAL' : 'COMPLETE',
      };

      // Add-on sales: assignments created in period on paid ACTIVE/CANCELLED commercial configs
      // for owned tenants + conversion dispositions that migrate/retain once.
      const addOnAttribution: AddOnAttribution[] = [];
      const addOnMap = new Map<string, AddOnAttribution>();
      if (ownedTenantIds.length > 0) {
        const assignments = await client.platformSubscriptionAddOnAssignment.findMany({
          where: {
            createdAt: { gte: start, lt: eventUpper },
            config: {
              platformTenantId: { in: ownedTenantIds },
              lifecycle: { in: ['ACTIVE_COMMERCIAL', 'CANCELLED'] },
            },
          },
          select: { addOnVersionId: true },
        });
        for (const a of assignments) {
          const prev = addOnMap.get(a.addOnVersionId);
          if (prev) prev.count += 1;
          else {
            addOnMap.set(a.addOnVersionId, {
              addOnVersionId: a.addOnVersionId,
              count: 1,
              basis: 'assignment_created',
            });
          }
        }
      }
      for (const c of attributedConversions) {
        const dispositions = Array.isArray(c.dispositionsJson)
          ? (c.dispositionsJson as Array<Record<string, unknown>>)
          : [];
        for (const d of dispositions) {
          const disposition = String(d.disposition ?? '');
          if (
            disposition !== 'MIGRATE_TO_PAID_EQUIVALENT' &&
            disposition !== 'RETAIN_NOT_TRIAL_ONLY'
          ) {
            continue;
          }
          const key =
            typeof d.paidEquivalentKey === 'string'
              ? d.paidEquivalentKey
              : typeof d.grantKey === 'string'
                ? d.grantKey
                : null;
          if (!key) continue;
          const basis =
            disposition === 'MIGRATE_TO_PAID_EQUIVALENT'
              ? ('conversion_disposition_migrate' as const)
              : ('conversion_disposition_retain' as const);
          const prev = addOnMap.get(key);
          if (prev) prev.count += 1;
          else addOnMap.set(key, { addOnVersionId: key, count: 1, basis });
        }
      }
      addOnAttribution.push(...addOnMap.values());
      const addonSales = addOnAttribution.reduce((sum, a) => sum + a.count, 0);

      const convertedCustomers = new Set(
        attributedConversions
          .map((c) => c.trial.platformTenantId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ).size;

      // M16 target progress — monthly quota vs won count when unitless; money targets N/A.
      let targetProgress: number | null = null;
      let targetCompleteness: Completeness = 'NOT_APPLICABLE';
      let targetExplanation: string | null = 'missing_target';
      if (rep.targetPeriod === 'MONTH' && rep.targetAmount != null) {
        const targetNum = Number(rep.targetAmount);
        if (rep.targetCurrency) {
          targetCompleteness = 'NOT_APPLICABLE';
          targetExplanation = 'target_unit_unconfigured_for_money';
          targetProgress = null;
        } else if (targetNum > 0) {
          targetProgress = won / targetNum;
          targetCompleteness = 'COMPLETE';
          targetExplanation = 'won_count_vs_unitless_quota';
        } else {
          targetCompleteness = 'UNAVAILABLE';
          targetExplanation = 'invalid_target_amount';
        }
      }

      const leadToWonRate =
        leadsCreated === 0 ? null : won / leadsCreated;
      const trialToPaidRate =
        trialsCreated === 0 ? null : paidConversions / trialsCreated;

      const m01 = metric('M01', 'leads_created', leadsCreated, 'COMPLETE', {
        explanation:
          leadsCreatedNullOwnerGap > 0
            ? `period_has_${leadsCreatedNullOwnerGap}_leads_with_null_owner_not_attributed`
            : null,
      });
      const m02 = metric('M02', 'activities', activities, 'COMPLETE');
      const m03 = metric(
        'M03',
        'demos_scheduled',
        demosScheduled,
        demosScheduledMissingTz > 0 ? 'PARTIAL' : 'COMPLETE',
        {
          explanation:
            demosScheduledMissingTz > 0
              ? 'timezone_missing_counted_in_utc'
              : null,
        },
      );
      const m04 = metric('M04', 'demos_completed', demosCompleted, 'COMPLETE');
      const m05 = metric('M05', 'trials_created', trialsCreated, 'COMPLETE');
      const m06 = metric('M06', 'won', won, wonCompleteness);
      const m07 = metric(
        'M07',
        'lost',
        lost,
        historyMissingLostFallback > 0 ? 'PARTIAL' : 'COMPLETE',
      );
      const m08 = metric(
        'M08',
        'paid_conversions',
        paidConversions,
        paidMissingAttr > 0 ? 'PARTIAL' : 'COMPLETE',
      );
      const m09 = metric(
        'M09',
        'lead_to_won_rate',
        leadToWonRate,
        leadsCreated === 0 ? 'NOT_APPLICABLE' : 'COMPLETE',
        {
          numerator: won,
          denominator: leadsCreated,
          rankingEligible: leadsCreated > 0 && leadToWonRate !== null,
        },
      );
      const m10 = metric(
        'M10',
        'trial_to_paid_rate',
        trialToPaidRate,
        trialsCreated === 0 ? 'NOT_APPLICABLE' : 'COMPLETE',
        {
          numerator: paidConversions,
          denominator: trialsCreated,
          rankingEligible: trialsCreated > 0 && trialToPaidRate !== null,
        },
      );
      const m11 = metric(
        'M11',
        'time_to_convert_days',
        timeToConvert,
        timeToConvertCompleteness,
        {
          rankingEligible: timeToConvertCompleteness === 'COMPLETE',
        },
      );
      const m12 = metric('M12', 'active_customers', activeCustomers, 'COMPLETE');
      const m13 = metric(
        'M13',
        'cancellations',
        cancellations,
        cancellationAttribution.completeness,
      );
      const m14 = metric(
        'M14',
        'plan_version_mix',
        planVersionAttribution.reduce((s, p) => s + p.count, 0),
        planVersionAttribution.length > 0 ? 'COMPLETE' : 'COMPLETE',
        { rankingEligible: false },
      );
      const m15 = metric('M15', 'addon_sales', addonSales, 'PARTIAL');
      const m16 = metric('M16', 'target_progress', targetProgress, targetCompleteness, {
        numerator: won,
        denominator: rep.targetAmount != null ? Number(rep.targetAmount) : null,
        explanation: targetExplanation,
        rankingEligible: targetCompleteness === 'COMPLETE' && targetProgress !== null,
      });
      const m17 = metric('M17', 'converted_customers', convertedCustomers, 'COMPLETE');
      const m18 = metric(
        'M18',
        'cancellation_attribution',
        cancellationAttribution.count,
        cancellationAttribution.completeness,
        { explanation: cancellationAttribution.basis },
      );

      const metrics: MetricValue[] = [
        m01,
        m02,
        m03,
        m04,
        m05,
        m06,
        m07,
        m08,
        m09,
        m10,
        m11,
        m12,
        m13,
        m14,
        m15,
        m16,
        m17,
        m18,
      ];

      const metricCompleteness = metrics.map((m) => m.completeness);
      const periodSource: Completeness = 'COMPLETE';
      const reporting = worstCompleteness([...metricCompleteness, periodSource]);
      const m19 = metric('M19', 'period_source_completeness', null, periodSource, {
        rankingEligible: false,
      });
      const m20 = metric('M20', 'reporting_completeness', null, reporting, {
        rankingEligible: false,
      });
      metrics.push(m19, m20);

      const metricsByKey = Object.fromEntries(metrics.map((m) => [m.key, m])) as Record<
        MetricKey,
        MetricValue
      >;
      const completeness: CompletenessBundle = {
        metrics: Object.fromEntries(metrics.map((m) => [m.key, m.completeness])) as Record<
          MetricKey,
          Completeness
        >,
        period_source_completeness: periodSource,
        reporting_completeness: reporting,
      };

      if (isSalesProductivityFailureInjectionActive('after_metrics_compute')) {
        throw new SalesProductivityValidationError(
          'Injected after metrics compute',
          'injected_failure',
        );
      }

      return {
        representativeId: rep.id,
        periodKey: period.periodKey,
        periodTimezone: period.periodTimezone,
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd.toISOString(),
        sourceCutoffAt: sourceCutoffAt.toISOString(),
        metrics,
        metricsByKey,
        planVersionAttribution,
        addOnAttribution,
        cancellationAttribution,
        completeness,
      };
    });
  }
}

/** Serialize metrics array into a stable JSON object keyed by metric key. */
export function metricsToJson(
  bundle: ProductivityMetricsBundle,
): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  for (const m of bundle.metrics) {
    out[m.key] = {
      id: m.id,
      value: m.value,
      completeness: m.completeness,
      numerator: m.numerator ?? null,
      denominator: m.denominator ?? null,
      explanation: m.explanation ?? null,
      rankingEligible: m.rankingEligible,
    };
  }
  return out as Prisma.InputJsonValue;
}
