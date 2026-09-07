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

function unavailableMetric(
  id: MetricValue['id'],
  key: MetricKey,
  explanation: string,
): MetricValue {
  return metric(id, key, null, 'UNAVAILABLE', {
    explanation,
    rankingEligible: false,
    numerator: null,
    denominator: null,
  });
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
 * Contained Model B source-failure selectors degrade to UNAVAILABLE (never fabricated zeros).
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
      const targetSourceFailed = isSalesProductivityFailureInjectionActive(
        'before_target_source_query',
      );
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
      const eventUpper = sourceCutoffAt < end ? sourceCutoffAt : end;

      const leadFailed = isSalesProductivityFailureInjectionActive('before_lead_source_query');
      const trialFailed = isSalesProductivityFailureInjectionActive('before_trial_source_query');
      const subscriptionFailed = isSalesProductivityFailureInjectionActive(
        'before_subscription_source_query',
      );
      const planVersionFailed = isSalesProductivityFailureInjectionActive(
        'before_plan_version_source_query',
      );
      const addonFailed = isSalesProductivityFailureInjectionActive('before_addon_source_query');
      const attributionFailed = isSalesProductivityFailureInjectionActive(
        'before_attribution_source_query',
      );
      const completenessFailed = isSalesProductivityFailureInjectionActive(
        'before_completeness_eval',
      );

      let leadsCreated: number | null = 0;
      let leadsCreatedNullOwnerGap = 0;
      let activities: number | null = 0;
      let demosScheduled: number | null = 0;
      let demosScheduledMissingTz = 0;
      let demosCompleted: number | null = 0;
      let won: number | null = 0;
      let lost: number | null = 0;
      let wonCompleteness: Completeness = 'COMPLETE';
      let lostCompleteness: Completeness = 'COMPLETE';
      let leadCompleteness: Completeness = 'COMPLETE';

      if (leadFailed) {
        leadsCreated = null;
        activities = null;
        demosScheduled = null;
        demosCompleted = null;
        won = null;
        lost = null;
        leadCompleteness = 'UNAVAILABLE';
        wonCompleteness = 'UNAVAILABLE';
        lostCompleteness = 'UNAVAILABLE';
      } else {
        leadsCreated = await client.platformSalesLead.count({
          where: {
            ownerRepresentativeId: rep.id,
            createdAt: { gte: start, lt: eventUpper },
          },
        });
        leadsCreatedNullOwnerGap = await client.platformSalesLead.count({
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
        activities = notesCount + demoUpdates + nextActionUpdates;

        demosScheduled = await client.platformSalesLead.count({
          where: {
            ownerRepresentativeId: rep.id,
            demoStatus: { in: ['SCHEDULED', 'COMPLETED', 'CANCELLED'] },
            demoScheduledAt: { gte: start, lt: eventUpper },
          },
        });
        demosScheduledMissingTz = await client.platformSalesLead.count({
          where: {
            ownerRepresentativeId: rep.id,
            demoStatus: { in: ['SCHEDULED', 'COMPLETED', 'CANCELLED'] },
            demoScheduledAt: { gte: start, lt: eventUpper },
            OR: [{ demoTimezone: null }, { demoTimezone: '' }],
          },
        });

        demosCompleted = await client.platformSalesLead.count({
          where: {
            ownerRepresentativeId: rep.id,
            demoStatus: 'COMPLETED',
            updatedAt: { gte: start, lt: eventUpper },
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
        won = wonHistory + historyMissingWonFallback;
        lost = lostHistory + historyMissingLostFallback;
        wonCompleteness =
          historyMissingWonFallback > 0 || historyMissingLostFallback > 0
            ? 'PARTIAL'
            : 'COMPLETE';
        lostCompleteness = historyMissingLostFallback > 0 ? 'PARTIAL' : 'COMPLETE';
      }

      let trialsCreated: number | null = 0;
      let trialCompleteness: Completeness = 'COMPLETE';
      if (trialFailed) {
        trialsCreated = null;
        trialCompleteness = 'UNAVAILABLE';
      } else {
        trialsCreated = await client.platformSalesTrial.count({
          where: {
            ownerRepresentativeId: rep.id,
            createdAt: { gte: start, lt: eventUpper },
          },
        });
      }

      type ConversionRow = {
        id: string;
        targetPaidPlanVersionId: string;
        convertedAt: Date;
        dispositionsJson: Prisma.JsonValue;
        trial: {
          id: string;
          platformTenantId: string | null;
          originatingLeadId: string | null;
          ownerRepresentativeId: string | null;
          attributionSnapshotJson: Prisma.JsonValue;
          createdAt: Date;
        };
      };

      let attributedConversions: ConversionRow[] = [];
      let paidConversions: number | null = 0;
      let paidMissingAttr = 0;
      let conversionCompleteness: Completeness = 'COMPLETE';
      let attributionCompleteness: Completeness = 'COMPLETE';

      if (attributionFailed) {
        // Fail closed: do NOT fall back to current owner/manager for historical credit.
        attributedConversions = [];
        paidConversions = null;
        conversionCompleteness = 'UNAVAILABLE';
        attributionCompleteness = 'UNAVAILABLE';
      } else if (trialFailed) {
        paidConversions = null;
        conversionCompleteness = 'UNAVAILABLE';
      } else {
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

        attributedConversions = conversions.filter((c) => {
          const attr =
            asAttributionId(c.trial.attributionSnapshotJson) ?? c.trial.ownerRepresentativeId;
          return attr === rep.id;
        });
        paidConversions = attributedConversions.length;
        paidMissingAttr = attributedConversions.filter((c) => {
          const snap = c.trial.attributionSnapshotJson;
          return !asAttributionId(snap);
        }).length;
        conversionCompleteness = paidMissingAttr > 0 ? 'PARTIAL' : 'COMPLETE';
      }

      let planVersionAttribution: PlanVersionAttribution[] = [];
      let planMixCompleteness: Completeness = 'COMPLETE';
      if (planVersionFailed || attributionFailed || trialFailed) {
        planVersionAttribution = [];
        planMixCompleteness = 'UNAVAILABLE';
      } else {
        const planMixMap = new Map<string, number>();
        for (const c of attributedConversions) {
          // Immutable Plan Version id only — never Plan display name / latest substitution.
          planMixMap.set(
            c.targetPaidPlanVersionId,
            (planMixMap.get(c.targetPaidPlanVersionId) ?? 0) + 1,
          );
        }
        planVersionAttribution = [...planMixMap.entries()].map(([planVersionId, count]) => ({
          planVersionId,
          count,
        }));
      }

      let timeToConvert: number | null = null;
      let timeToConvertCompleteness: Completeness = 'NOT_APPLICABLE';
      if (leadFailed || trialFailed || attributionFailed) {
        timeToConvert = null;
        timeToConvertCompleteness = 'UNAVAILABLE';
      } else {
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
        timeToConvert = median(convertDays);
        timeToConvertCompleteness =
          convertDays.length === 0
            ? 'NOT_APPLICABLE'
            : convertDays.length < 3
              ? 'PARTIAL'
              : 'COMPLETE';
      }

      let activeCustomers: number | null = 0;
      let cancellations: number | null = 0;
      let cancellationAttribution: CancellationAttribution = {
        count: 0,
        basis: 'current_ownership_partial',
        completeness: 'COMPLETE',
      };
      let subscriptionCompleteness: Completeness = 'COMPLETE';

      if (subscriptionFailed) {
        activeCustomers = null;
        cancellations = null;
        cancellationAttribution = {
          count: 0,
          basis: 'current_ownership_partial',
          completeness: 'UNAVAILABLE',
        };
        subscriptionCompleteness = 'UNAVAILABLE';
      } else {
        const ownerships = await client.platformSalesCustomerOwnership.findMany({
          where: { representativeId: rep.id },
          select: { platformTenantId: true },
        });
        const ownedTenantIds = ownerships.map((o) => o.platformTenantId);
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
        cancellations = cancelledConfigs.length;
        cancellationAttribution = {
          count: cancellations,
          basis: 'current_ownership_partial',
          completeness: cancellations > 0 ? 'PARTIAL' : 'COMPLETE',
        };
      }

      let addOnAttribution: AddOnAttribution[] = [];
      let addonSales: number | null = 0;
      let addonCompleteness: Completeness = 'PARTIAL';
      if (addonFailed || attributionFailed || subscriptionFailed) {
        addOnAttribution = [];
        addonSales = null;
        addonCompleteness = 'UNAVAILABLE';
      } else {
        const addOnMap = new Map<string, AddOnAttribution>();
        const ownershipsForAddon = await client.platformSalesCustomerOwnership.findMany({
          where: { representativeId: rep.id },
          select: { platformTenantId: true },
        });
        const ownedTenantIds = ownershipsForAddon.map((o) => o.platformTenantId);
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
        addonSales = addOnAttribution.reduce((sum, a) => sum + a.count, 0);
      }

      let convertedCustomers: number | null = 0;
      if (trialFailed || attributionFailed) {
        convertedCustomers = null;
      } else {
        convertedCustomers = new Set(
          attributedConversions
            .map((c) => c.trial.platformTenantId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ).size;
      }

      let targetProgress: number | null = null;
      let targetCompleteness: Completeness = 'NOT_APPLICABLE';
      let targetExplanation: string | null = 'missing_target';
      if (targetSourceFailed) {
        targetProgress = null;
        targetCompleteness = 'UNAVAILABLE';
        targetExplanation = 'target_source_unavailable';
      } else if (leadFailed && rep.targetPeriod === 'MONTH' && rep.targetAmount != null) {
        // Won numerator unavailable → progress unavailable (never treat as zero progress).
        targetProgress = null;
        targetCompleteness = 'UNAVAILABLE';
        targetExplanation = 'won_numerator_unavailable';
      } else if (rep.targetPeriod === 'MONTH' && rep.targetAmount != null) {
        const targetNum = Number(rep.targetAmount);
        if (rep.targetCurrency) {
          targetCompleteness = 'NOT_APPLICABLE';
          targetExplanation = 'target_unit_unconfigured_for_money';
          targetProgress = null;
        } else if (targetNum > 0 && won != null) {
          targetProgress = won / targetNum;
          targetCompleteness = 'COMPLETE';
          targetExplanation = 'won_count_vs_unitless_quota';
        } else if (targetNum <= 0) {
          targetCompleteness = 'UNAVAILABLE';
          targetExplanation = 'invalid_target_amount';
        }
      }

      const leadToWonRate =
        leadsCreated == null || won == null
          ? null
          : leadsCreated === 0
            ? null
            : won / leadsCreated;
      const trialToPaidRate =
        trialsCreated == null || paidConversions == null
          ? null
          : trialsCreated === 0
            ? null
            : paidConversions / trialsCreated;

      const m01 = leadFailed
        ? unavailableMetric('M01', 'leads_created', 'lead_source_unavailable')
        : metric('M01', 'leads_created', leadsCreated, 'COMPLETE', {
            explanation:
              leadsCreatedNullOwnerGap > 0
                ? `period_has_${leadsCreatedNullOwnerGap}_leads_with_null_owner_not_attributed`
                : null,
          });
      const m02 = leadFailed
        ? unavailableMetric('M02', 'activities', 'lead_source_unavailable')
        : metric('M02', 'activities', activities, 'COMPLETE');
      const m03 = leadFailed
        ? unavailableMetric('M03', 'demos_scheduled', 'lead_source_unavailable')
        : metric(
            'M03',
            'demos_scheduled',
            demosScheduled,
            demosScheduledMissingTz > 0 ? 'PARTIAL' : 'COMPLETE',
            {
              explanation:
                demosScheduledMissingTz > 0 ? 'timezone_missing_counted_in_utc' : null,
            },
          );
      const m04 = leadFailed
        ? unavailableMetric('M04', 'demos_completed', 'lead_source_unavailable')
        : metric('M04', 'demos_completed', demosCompleted, 'COMPLETE');
      const m05 = trialFailed
        ? unavailableMetric('M05', 'trials_created', 'trial_source_unavailable')
        : metric('M05', 'trials_created', trialsCreated, trialCompleteness);
      const m06 = leadFailed
        ? unavailableMetric('M06', 'won', 'lead_source_unavailable')
        : metric('M06', 'won', won, wonCompleteness);
      const m07 = leadFailed
        ? unavailableMetric('M07', 'lost', 'lead_source_unavailable')
        : metric('M07', 'lost', lost, lostCompleteness);
      const m08 =
        trialFailed || attributionFailed
          ? unavailableMetric(
              'M08',
              'paid_conversions',
              attributionFailed ? 'attribution_source_unavailable' : 'trial_source_unavailable',
            )
          : metric('M08', 'paid_conversions', paidConversions, conversionCompleteness);
      const m09 =
        leadFailed || leadsCreated == null || won == null
          ? unavailableMetric('M09', 'lead_to_won_rate', 'lead_source_unavailable')
          : metric(
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
      const m10 =
        trialFailed || attributionFailed || trialsCreated == null || paidConversions == null
          ? unavailableMetric(
              'M10',
              'trial_to_paid_rate',
              attributionFailed ? 'attribution_source_unavailable' : 'trial_source_unavailable',
            )
          : metric(
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
      const m11 =
        leadFailed || trialFailed || attributionFailed
          ? unavailableMetric('M11', 'time_to_convert_days', 'source_unavailable')
          : metric('M11', 'time_to_convert_days', timeToConvert, timeToConvertCompleteness, {
              rankingEligible: timeToConvertCompleteness === 'COMPLETE',
            });
      const m12 = subscriptionFailed
        ? unavailableMetric('M12', 'active_customers', 'subscription_source_unavailable')
        : metric('M12', 'active_customers', activeCustomers, subscriptionCompleteness);
      const m13 = subscriptionFailed
        ? unavailableMetric('M13', 'cancellations', 'subscription_source_unavailable')
        : metric('M13', 'cancellations', cancellations, cancellationAttribution.completeness);
      const m14 =
        planVersionFailed || attributionFailed || trialFailed
          ? unavailableMetric(
              'M14',
              'plan_version_mix',
              planVersionFailed
                ? 'plan_version_source_unavailable'
                : 'attribution_or_trial_source_unavailable',
            )
          : metric(
              'M14',
              'plan_version_mix',
              planVersionAttribution.reduce((s, p) => s + p.count, 0),
              planMixCompleteness,
              { rankingEligible: false },
            );
      const m15 =
        addonFailed || attributionFailed || subscriptionFailed
          ? unavailableMetric('M15', 'addon_sales', 'addon_source_unavailable')
          : metric('M15', 'addon_sales', addonSales, addonCompleteness);
      const m16 = metric('M16', 'target_progress', targetProgress, targetCompleteness, {
        numerator: won,
        denominator:
          !targetSourceFailed && rep.targetAmount != null ? Number(rep.targetAmount) : null,
        explanation: targetExplanation,
        rankingEligible: targetCompleteness === 'COMPLETE' && targetProgress !== null,
      });
      const m17 =
        trialFailed || attributionFailed
          ? unavailableMetric('M17', 'converted_customers', 'attribution_or_trial_unavailable')
          : metric('M17', 'converted_customers', convertedCustomers, 'COMPLETE');
      const m18 = subscriptionFailed
        ? unavailableMetric('M18', 'cancellation_attribution', 'subscription_source_unavailable')
        : metric(
            'M18',
            'cancellation_attribution',
            cancellationAttribution.count,
            cancellationAttribution.completeness,
            { explanation: cancellationAttribution.basis },
          );

      let metrics: MetricValue[] = [
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

      const anySourceFailed =
        leadFailed ||
        trialFailed ||
        subscriptionFailed ||
        planVersionFailed ||
        addonFailed ||
        targetSourceFailed ||
        attributionFailed ||
        completenessFailed;

      let periodSource: Completeness = anySourceFailed ? 'UNAVAILABLE' : 'COMPLETE';
      let reporting = worstCompleteness([
        ...metrics.map((m) => m.completeness),
        periodSource,
      ]);

      if (completenessFailed) {
        // Fail closed: never default to COMPLETE; strip ranking eligibility.
        periodSource = 'UNAVAILABLE';
        reporting = 'UNAVAILABLE';
        metrics = metrics.map((m) => ({
          ...m,
          completeness: m.completeness === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'UNAVAILABLE',
          value: m.completeness === 'NOT_APPLICABLE' ? m.value : null,
          rankingEligible: false,
          explanation: m.explanation ?? 'completeness_evaluator_unavailable',
        }));
      }

      const m19 = metric('M19', 'period_source_completeness', null, periodSource, {
        rankingEligible: false,
        explanation: anySourceFailed || completenessFailed ? 'source_or_completeness_unavailable' : null,
      });
      const m20 = metric('M20', 'reporting_completeness', null, reporting, {
        rankingEligible: false,
        explanation: reporting === 'UNAVAILABLE' ? 'reporting_unavailable' : null,
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
        notes: anySourceFailed || completenessFailed
          ? [
              leadFailed ? 'lead_source_unavailable' : null,
              trialFailed ? 'trial_source_unavailable' : null,
              subscriptionFailed ? 'subscription_source_unavailable' : null,
              planVersionFailed ? 'plan_version_source_unavailable' : null,
              addonFailed ? 'addon_source_unavailable' : null,
              targetSourceFailed ? 'target_source_unavailable' : null,
              attributionFailed ? 'attribution_source_unavailable' : null,
              completenessFailed ? 'completeness_evaluator_unavailable' : null,
            ].filter((n): n is string => Boolean(n))
          : undefined,
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
