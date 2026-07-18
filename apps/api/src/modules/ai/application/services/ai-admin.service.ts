import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { isBuiltinOnlyAiMode } from '../../domain/config/ai-builtin.config';
import {
  AI_EXTERNAL_TOKEN_COST_PER_1K_USD,
  AI_INFERENCE_AUDIT_ACTION,
} from '../../domain/config/ai-admin.config';
import { AI_SKILL_REGISTRY } from '../../domain/config/ai-skill-registry.config';
import { AiInferenceService } from './ai-inference.service';
import { AiSubscriptionService } from './ai-subscription.service';
import { AiTenantSettingsService } from './ai-tenant-settings.service';
import type { AiTenantProviderManagementDto } from './ai-tenant-settings.service';

export interface AiAdminOverviewDto {
  usage: {
    totalTokens: number;
    totalMessages: number;
    successCount: number;
    failureCount: number;
    activeUsers: number;
    daily: Array<{ date: string; tokens: number; messages: number }>;
    monthly: Array<{ month: string; tokens: number; messages: number }>;
  };
  topUsers: Array<{ userId: string; email: string; messages: number; tokens: number }>;
  providerBreakdown: Array<{ provider: string; count: number }>;
  skillBreakdown: Array<{ skillId: string; count: number }>;
  limits: Awaited<ReturnType<AiSubscriptionService['getLimits']>>;
  featureFlags: {
    builtinOnlyMode: boolean;
    externalProvidersEnabled: boolean;
    attachmentsEnabled: boolean;
    customPromptsEnabled: boolean;
    workspaces: string[] | 'all';
  };
  providers: Awaited<ReturnType<AiInferenceService['getProviderHealth']>>;
  activeProvider: string;
  costEstimate: {
    currency: 'USD';
    periodTokens: number;
    estimatedExternalCost: number;
    noteKey: string;
  };
  skills: Array<{ id: string; workspace?: string }>;
  auditLog: Array<{
    id: string;
    actorId: string;
    createdAt: string;
    provider: string;
    skillId: string | null;
    tokenCount: number;
    latencyMs: number;
    conversationId: string;
  }>;
  providerManagement: AiTenantProviderManagementDto;
}

@Injectable()
export class AiAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: AiSubscriptionService,
    private readonly inference: AiInferenceService,
    private readonly tenantSettings: AiTenantSettingsService,
  ) {}

  async getOverview(tenantId: string, userId: string): Promise<AiAdminOverviewDto> {
    const sinceDaily = new Date();
    sinceDaily.setUTCDate(sinceDaily.getUTCDate() - 13);
    sinceDaily.setUTCHours(0, 0, 0, 0);

    const sinceMonthly = new Date(Date.UTC(sinceDaily.getUTCFullYear(), sinceDaily.getUTCMonth() - 11, 1));

    const [aggregate, dailyRows, monthlyRows, activeUsers, limits, providers, auditRows, topUserRows] =
      await Promise.all([
        this.prisma.aiUsageDaily.aggregate({
          where: { tenantId },
          _sum: { tokenCount: true, messageCount: true, successCount: true, failureCount: true },
        }),
        this.prisma.aiUsageDaily.findMany({
          where: { tenantId, usageDate: { gte: sinceDaily } },
          orderBy: { usageDate: 'asc' },
        }),
        this.prisma.aiUsageDaily.findMany({
          where: { tenantId, usageDate: { gte: sinceMonthly } },
          orderBy: { usageDate: 'asc' },
        }),
        this.prisma.aiUsageDaily.groupBy({
          by: ['userId'],
          where: { tenantId, usageDate: { gte: sinceDaily } },
        }),
        this.subscription.getLimits(tenantId, userId),
        this.inference.getProviderHealth(),
        this.prisma.auditEntry.findMany({
          where: { tenantId, action: AI_INFERENCE_AUDIT_ACTION },
          orderBy: { createdAt: 'desc' },
          take: 25,
        }),
        this.prisma.aiUsageDaily.groupBy({
          by: ['userId'],
          where: { tenantId, usageDate: { gte: sinceDaily } },
          _sum: { messageCount: true, tokenCount: true },
          orderBy: { _sum: { messageCount: 'desc' } },
          take: 10,
        }),
      ]);

    const daily = this.buildDailySeries(sinceDaily, dailyRows);
    const monthly = this.buildMonthlySeries(sinceMonthly, monthlyRows);

    const userIds = topUserRows.map((r) => r.userId);
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const providerBreakdown = new Map<string, number>();
    const skillBreakdown = new Map<string, number>();
    const auditLog = auditRows.map((row) => {
      const details = (row.details as Record<string, string>) ?? {};
      const provider = details.provider ?? 'unknown';
      const skillId = details.skillId?.trim() ? details.skillId : null;
      providerBreakdown.set(provider, (providerBreakdown.get(provider) ?? 0) + 1);
      if (skillId) skillBreakdown.set(skillId, (skillBreakdown.get(skillId) ?? 0) + 1);
      return {
        id: row.id,
        actorId: row.actorId,
        createdAt: row.createdAt.toISOString(),
        provider,
        skillId,
        tokenCount: Number(details.tokenCount ?? 0),
        latencyMs: Number(details.latencyMs ?? 0),
        conversationId: row.resourceId,
      };
    });

    const totalTokens = aggregate._sum.tokenCount ?? 0;
    const builtinOnly = isBuiltinOnlyAiMode();
    const externalEnabled = !builtinOnly && limits.limits.externalProvidersEnabled;
    const providerManagement = await this.tenantSettings.getProviderManagement(tenantId, providers, limits);

    return {
      usage: {
        totalTokens,
        totalMessages: aggregate._sum.messageCount ?? 0,
        successCount: aggregate._sum.successCount ?? 0,
        failureCount: aggregate._sum.failureCount ?? 0,
        activeUsers: activeUsers.length,
        daily,
        monthly,
      },
      topUsers: topUserRows.map((row) => ({
        userId: row.userId,
        email: emailById.get(row.userId) ?? row.userId.slice(0, 8),
        messages: row._sum.messageCount ?? 0,
        tokens: row._sum.tokenCount ?? 0,
      })),
      providerBreakdown: [...providerBreakdown.entries()].map(([provider, count]) => ({ provider, count })),
      skillBreakdown: [...skillBreakdown.entries()].map(([skillId, count]) => ({ skillId, count })),
      limits,
      featureFlags: {
        builtinOnlyMode: builtinOnly,
        externalProvidersEnabled: externalEnabled,
        attachmentsEnabled: limits.limits.attachmentsEnabled,
        customPromptsEnabled: limits.limits.customPromptsEnabled,
        workspaces: limits.limits.workspaces,
      },
      providers,
      activeProvider: providerManagement.effectiveActiveProvider,
      costEstimate: {
        currency: 'USD',
        periodTokens: totalTokens,
        estimatedExternalCost: externalEnabled
          ? (totalTokens / 1000) * AI_EXTERNAL_TOKEN_COST_PER_1K_USD
          : 0,
        noteKey: builtinOnly
          ? 'ai.admin.cost.builtinOnly'
          : externalEnabled
            ? 'ai.admin.cost.externalEnabled'
            : 'ai.admin.cost.planLite',
      },
      skills: AI_SKILL_REGISTRY.map((s) => ({ id: s.id, workspace: s.workspace })),
      auditLog,
      providerManagement,
    };
  }

  private buildDailySeries(
    since: Date,
    rows: Array<{ usageDate: Date; tokenCount: number; messageCount: number }>,
  ) {
    const map = new Map<string, { tokens: number; messages: number }>();
    for (const row of rows) {
      const key = row.usageDate.toISOString().slice(0, 10);
      const prev = map.get(key) ?? { tokens: 0, messages: 0 };
      map.set(key, { tokens: prev.tokens + row.tokenCount, messages: prev.messages + row.messageCount });
    }
    const daily: Array<{ date: string; tokens: number; messages: number }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      daily.push({ date: key, ...(map.get(key) ?? { tokens: 0, messages: 0 }) });
    }
    return daily;
  }

  private buildMonthlySeries(
    since: Date,
    rows: Array<{ usageDate: Date; tokenCount: number; messageCount: number }>,
  ) {
    const map = new Map<string, { tokens: number; messages: number }>();
    for (const row of rows) {
      const key = row.usageDate.toISOString().slice(0, 7);
      const prev = map.get(key) ?? { tokens: 0, messages: 0 };
      map.set(key, { tokens: prev.tokens + row.tokenCount, messages: prev.messages + row.messageCount });
    }
    const monthly: Array<{ month: string; tokens: number; messages: number }> = [];
    const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1));
    const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 7);
      monthly.push({ month: key, ...(map.get(key) ?? { tokens: 0, messages: 0 }) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return monthly;
  }
}
