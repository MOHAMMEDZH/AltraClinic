import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  evaluateCompatibilitySelection,
  type CatalogLifecycle,
  type EvalCatalogItem,
  type EvalRule,
} from '../../platform-healthcare-catalog/domain/compatibility.evaluator';
import { isSalesLeadsFailureInjectionActive } from '../platform-sales-leads.constants';
import { SalesLeadValidationError } from '../domain/sales-lead.errors';
import type { PlanFitAdvisoryDto, SalesLeadDto } from '../domain/sales-lead.types';

type Tx = Prisma.TransactionClient;

/**
 * Flexible Step 24 — advisory Plan-fit only.
 * MUST NOT mutate Plans, Plan Versions, Subscriptions, Entitlements, Limits,
 * Add-ons, Overrides, Tenants, Provisioning, or Trials.
 */
@Injectable()
export class LeadPlanFitService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(lead: SalesLeadDto): Promise<PlanFitAdvisoryDto> {
    if (isSalesLeadsFailureInjectionActive('plan_fit_evaluation')) {
      throw new SalesLeadValidationError('Injected plan-fit evaluation failure');
    }
    return this.prisma.withPlatformBypass(async (client) => this.evaluateWithClient(client, lead));
  }

  async evaluateWithClient(client: Tx, lead: SalesLeadDto): Promise<PlanFitAdvisoryDto> {
    const [items, rules, publishedVersions] = await Promise.all([
      client.healthcareCatalogItem.findMany({
        select: { canonicalKey: true, kind: true, lifecycle: true },
      }),
      client.healthcareCatalogCompatibilityRule.findMany({
        include: { subject: true, target: true },
      }),
      client.platformPlanVersion.findMany({
        where: { lifecycle: 'PUBLISHED' },
        select: {
          id: true,
          versionNumber: true,
          plan: { select: { canonicalKey: true } },
        },
        take: 25,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const catalog: EvalCatalogItem[] = items.map((i) => ({
      canonicalKey: i.canonicalKey,
      kind: i.kind,
      lifecycle: i.lifecycle as CatalogLifecycle,
    }));
    const evalRules: EvalRule[] = rules.map((r) => ({
      id: r.id,
      ruleType: r.ruleType as EvalRule['ruleType'],
      subjectKey: r.subject.canonicalKey,
      targetKey: r.target.canonicalKey,
      anyOfGroupKey: r.anyOfGroupKey,
      lifecycle: r.lifecycle as CatalogLifecycle,
    }));

    const result = evaluateCompatibilitySelection(
      {
        facilityTypeKey: lead.facilityTypeKey ?? undefined,
        specialtyKeys: lead.specialtyKeys,
        moduleKeys: lead.desiredModuleKeys,
      },
      catalog,
      evalRules,
    );

    return {
      leadId: lead.id,
      valid: result.valid,
      violations: result.violations.map((v) => ({
        reasonCode: v.reasonCode,
        message: v.message,
        subjectKey: v.subjectKey,
        targetKey: v.targetKey,
      })),
      warnings: result.warnings.map((v) => ({
        reasonCode: v.reasonCode,
        message: v.message,
        subjectKey: v.subjectKey,
        targetKey: v.targetKey,
      })),
      applicableRuleIds: result.applicableRuleIds,
      candidatePublishedPlanVersions: publishedVersions.map((v) => ({
        id: v.id,
        planKey: v.plan.canonicalKey,
        version: v.versionNumber,
      })),
      disclaimer: {
        advisoryOnly: true,
        notEntitlementDecision: true,
        notProvisioningDecision: true,
        notRuntimeLicenseDecision: true,
        doesNotMutateCommercialSoR: true,
      },
    };
  }
}
