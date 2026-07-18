import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { getPlanLimits } from '../../domain/config/plan-limits.config';
import {
  getLimitsForUiPlan,
  platformPlanToSubscriptionPlan,
  subscriptionPlanToUiPlan,
  TENANT_SUBSCRIPTION_PLANS,
  uiPlanToSubscriptionPlan,
} from '../../domain/config/plan-name.mapper';
import { LicensingEngineService } from './licensing-engine.service';
import { readGrantHistory } from './subscription-grant-history.util';

export interface TenantSubscriptionOverview {
  tenantId: string;
  platformTenantId: string | null;
  displayName: string;
  plan: string;
  uiPlan: string;
  backendPlan: string;
  status: string;
  platformStatus: string | null;
  endDate: string | null;
  pricePerMonth: number;
  currency: string;
  trialEndsAt: string | null;
  contractEndDate: string | null;
  limits: ReturnType<typeof getPlanLimits>;
  entitlements: {
    aiCreditsBonus: number;
    storageGbBonus: number;
    usersBonus: number;
  };
  grantHistory: ReturnType<typeof readGrantHistory>;
  payment: {
    method: string;
    reference: string | null;
    paidAt: string | null;
    autoRenew: boolean;
    billingCycleMonths: number;
  } | null;
}

export interface TenantSubscriptionUsage {
  users: number;
  branches: number;
  patients: number;
  appointmentsThisMonth: number;
  reportsThisMonth: number;
  apiCallsToday: number;
  storageGb: number;
  smsThisMonth: number;
  whatsappThisMonth: number;
  emailThisMonth: number;
  pushThisMonth: number;
}

export interface TenantSubscriptionPayment {
  subscriptionId: string;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  paidAt: string | null;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  billingCycleMonths: number;
}

@Injectable()
export class TenantSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LicensingEngineService))
    private readonly licensingEngine: LicensingEngineService,
  ) {}

  async getOverview(tenantId: string): Promise<TenantSubscriptionOverview> {
    return this.licensingEngine.getSubscriptionOverview(tenantId);
  }

  listPlans() {
    return TENANT_SUBSCRIPTION_PLANS.map((plan) => {
      const baseLimits = getPlanLimits(plan.backendPlan);
      return {
        ...plan,
        limits: getLimitsForUiPlan(plan.id, baseLimits),
      };
    });
  }

  async getUsage(tenantId: string): Promise<TenantSubscriptionUsage> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const usageMonth = `${startOfMonth.getUTCFullYear()}-${String(startOfMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      users,
      branches,
      patients,
      appointmentsThisMonth,
      analyticsReportsThisMonth,
      operationalReportsThisMonth,
      aiUsageToday,
      mediaAssets,
      ledgerEmail,
      ledgerSms,
      ledgerWhatsapp,
      ledgerPush,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { tenantId, deletedAt: null, roles: { some: { role: { not: 'PATIENT' } } } },
      }),
      this.prisma.branch.count({ where: { tenantId, deletedAt: null, isActive: true } }),
      this.prisma.patient.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.appointment.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      this.prisma.analyticsReportRecord.count({
        where: { tenantId, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.operationalReportRecord.count({
        where: { tenantId, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.aiUsageDaily.aggregate({
        where: { tenantId, usageDate: { gte: startOfDay } },
        _sum: { messageCount: true },
      }),
      this.prisma.mediaAsset.findMany({
        where: { tenantId, deletedAt: null, status: { not: 'DELETED' } },
        select: { sizeBytes: true, variants: true },
      }),
      this.prisma.communicationDispatchLedger.count({ where: { tenantId, channel: 'EMAIL', usageMonth } }),
      this.prisma.communicationDispatchLedger.count({ where: { tenantId, channel: 'SMS', usageMonth } }),
      this.prisma.communicationDispatchLedger.count({ where: { tenantId, channel: 'WHATSAPP', usageMonth } }),
      this.prisma.communicationDispatchLedger.count({ where: { tenantId, channel: 'PUSH', usageMonth } }),
    ]);

    let storageBytes = 0;
    for (const row of mediaAssets) {
      storageBytes += Number(row.sizeBytes);
      const variants = (row.variants as Array<{ sizeBytes?: number }>) ?? [];
      for (const variant of variants) {
        storageBytes += variant.sizeBytes ?? 0;
      }
    }

    return {
      users,
      branches,
      patients,
      appointmentsThisMonth,
      reportsThisMonth: analyticsReportsThisMonth + operationalReportsThisMonth,
      apiCallsToday: Number(aiUsageToday._sum.messageCount ?? 0),
      storageGb: Math.round((storageBytes / (1024 * 1024 * 1024)) * 100) / 100,
      smsThisMonth: ledgerSms,
      whatsappThisMonth: ledgerWhatsapp,
      emailThisMonth: ledgerEmail,
      pushThisMonth: ledgerPush,
    };
  }

  async getPayments(tenantId: string): Promise<TenantSubscriptionPayment[]> {
    const platformTenant = await this.prisma.platformTenant.findUnique({
      where: { tenantId },
      include: {
        platformSubscriptions: { orderBy: { createdAt: 'desc' }, take: 12 },
      },
    });
    if (!platformTenant) return [];

    return platformTenant.platformSubscriptions.map((sub) => ({
      subscriptionId: sub.id,
      plan: sub.plan,
      status: sub.status,
      amount: Number(sub.pricePerMonth),
      currency: sub.currency,
      method: sub.paidManuallyAt ? 'manual' : 'invoice',
      reference: sub.paymentReference,
      paidAt: sub.paidManuallyAt?.toISOString() ?? null,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate?.toISOString() ?? null,
      autoRenew: sub.autoRenew,
      billingCycleMonths: sub.billingCycleMonths,
    }));
  }

  resolveRequestedPlan(plan: string): { backendPlan: string; platformPlan: string; uiPlan: string } {
    const uiPlan = plan.trim().toLowerCase();
    const catalog = TENANT_SUBSCRIPTION_PLANS.find((entry) => entry.id === uiPlan);
    if (catalog) {
      return { backendPlan: catalog.backendPlan, platformPlan: catalog.platformPlan, uiPlan: catalog.id };
    }

    const backendPlan = uiPlanToSubscriptionPlan(plan);
    const platformPlan =
      TENANT_SUBSCRIPTION_PLANS.find((entry) => entry.backendPlan === backendPlan)?.platformPlan ??
      (backendPlan === 'lite' ? 'starter' : backendPlan === 'pro' ? 'growth' : 'enterprise');

    return {
      backendPlan,
      platformPlan,
      uiPlan: subscriptionPlanToUiPlan(backendPlan, uiPlan === 'business' ? 'business' : null),
    };
  }
}
