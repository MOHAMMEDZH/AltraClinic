import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { RateLimiterService } from '../../../../infrastructure/redis/services/rate-limiter.service';
import { RedisKeyBuilder } from '../../../../infrastructure/redis/redis-key.builder';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { UNLIMITED } from '../../../subscription/domain/config/plan-limits.config';
import { isBuiltinOnlyAiMode } from '../../domain/config/ai-builtin.config';
import {
  aiWorkspaceAllowed,
  resolveAiPlanLimits,
  workspaceToAiFeature,
  type AiPlanLimits,
} from '../../domain/config/ai-plan-limits.config';
import { workspaceToLicensedFeature } from '../../domain/config/ai-workspace-licensing.config';
import { AiQuotaExceededException, AiRateLimitExceededException } from '../../domain/exceptions/ai-quota-exceeded.exception';

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface AiUsageSnapshot {
  plan: string;
  messagesToday: number;
  tokensTodayTenant: number;
  limits: {
    maxMessagesPerUserPerDay: number;
    maxTokensPerTenantPerDay: number;
    maxRequestsPerMinute: number;
    attachmentsEnabled: boolean;
    externalProvidersEnabled: boolean;
    workspaces: AiPlanLimits['workspaces'];
    customPromptsEnabled: boolean;
  };
}

@Injectable()
export class AiSubscriptionService {
  private readonly logger = new Logger(AiSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionEnforcementService,
    private readonly rateLimiter: RateLimiterService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  async getLimits(tenantId: string, userId: string): Promise<AiUsageSnapshot> {
    const { limits: planLimits, planLabel } = await this.resolveAiLimits(tenantId);
    const usage = await this.loadUsage(tenantId, userId);
    return {
      plan: planLabel,
      messagesToday: usage.userMessages,
      tokensTodayTenant: usage.tenantTokens,
      limits: {
        maxMessagesPerUserPerDay: planLimits.maxMessagesPerUserPerDay,
        maxTokensPerTenantPerDay: planLimits.maxTokensPerTenantPerDay,
        maxRequestsPerMinute: planLimits.maxRequestsPerMinute,
        attachmentsEnabled: planLimits.attachmentsEnabled,
        externalProvidersEnabled: !isBuiltinOnlyAiMode() && planLimits.externalProvidersEnabled,
        workspaces: planLimits.workspaces,
        customPromptsEnabled: planLimits.customPromptsEnabled,
      },
    };
  }

  async enforceCustomPrompts(tenantId: string): Promise<void> {
    const { limits } = await this.resolveAiLimits(tenantId);
    if (!limits.customPromptsEnabled) {
      throw new AiQuotaExceededException('custom_prompts', false, limits.planName);
    }
  }

  async enforceWorkspaceAccess(tenantId: string, workspaceId?: string | null): Promise<void> {
    const licensedFeature = workspaceToLicensedFeature(workspaceId);
    if (licensedFeature) {
      await this.subscription.enforceLicensedFeature(tenantId, licensedFeature);
    }
    const { limits } = await this.resolveAiLimits(tenantId);
    if (!aiWorkspaceAllowed(limits, workspaceId)) {
      throw new AiQuotaExceededException('workspace', false, limits.planName, {
        workspaceId: workspaceId ?? 'chat',
        workspaceFeature: workspaceToAiFeature(workspaceId),
      });
    }
  }

  async enforceInference(
    tenantId: string,
    userId: string,
    options?: { attachments?: unknown[]; workspaceId?: string | null },
  ): Promise<{ externalProvidersEnabled: boolean }> {
    await this.subscription.enforceLicensedFeature(tenantId, 'aiChat');
    const { limits } = await this.resolveAiLimits(tenantId);
    await this.enforceWorkspaceAccess(tenantId, options?.workspaceId);

    if (options?.attachments?.length && !limits.attachmentsEnabled) {
      throw new AiQuotaExceededException('attachments', false, limits.planName);
    }

    await this.enforceRateLimit(tenantId, userId, limits);
    await this.enforceDailyQuotas(tenantId, userId, limits);

    return { externalProvidersEnabled: !isBuiltinOnlyAiMode() && limits.externalProvidersEnabled };
  }

  async enforceModelRegistry(tenantId: string): Promise<void> {
    await this.subscription.enforceFeature(tenantId, 'aiModels');
  }

  private async resolveAiLimits(tenantId: string): Promise<{ limits: AiPlanLimits; planLabel: string }> {
    const license = await this.subscription.resolveLicense(tenantId);
    const limits = resolveAiPlanLimits(license.uiPlan, license.effectiveLimits.planName);
    const planLabel = license.uiPlan === 'business' ? 'business' : limits.planName;
    return { limits, planLabel };
  }

  private async loadUsage(tenantId: string, userId: string) {
    const usageDate = startOfUtcDay();
    const [userRow, tenantAgg] = await Promise.all([
      this.prisma.aiUsageDaily.findUnique({
        where: { tenantId_userId_usageDate: { tenantId, userId, usageDate } },
        select: { messageCount: true },
      }),
      this.prisma.aiUsageDaily.aggregate({
        where: { tenantId, usageDate },
        _sum: { tokenCount: true },
      }),
    ]);

    return {
      userMessages: userRow?.messageCount ?? 0,
      tenantTokens: tenantAgg._sum.tokenCount ?? 0,
    };
  }

  private async enforceDailyQuotas(tenantId: string, userId: string, limits: AiPlanLimits) {
    const usage = await this.loadUsage(tenantId, userId);

    if (
      limits.maxMessagesPerUserPerDay !== UNLIMITED &&
      usage.userMessages >= limits.maxMessagesPerUserPerDay
    ) {
      throw new AiQuotaExceededException(
        'messages_per_day',
        limits.maxMessagesPerUserPerDay,
        limits.planName,
        { used: usage.userMessages },
      );
    }

    if (
      limits.maxTokensPerTenantPerDay !== UNLIMITED &&
      usage.tenantTokens >= limits.maxTokensPerTenantPerDay
    ) {
      throw new AiQuotaExceededException(
        'tokens_per_day',
        limits.maxTokensPerTenantPerDay,
        limits.planName,
        { used: usage.tenantTokens },
      );
    }
  }

  private async enforceRateLimit(tenantId: string, userId: string, limits: AiPlanLimits) {
    if (limits.maxRequestsPerMinute === UNLIMITED) return;

    const windowKey = RedisKeyBuilder.currentMinuteWindow();
    const key = this.keys.aiInferenceRateLimit(tenantId, userId, windowKey);
    const result = await this.rateLimiter.checkFixedWindow(key, limits.maxRequestsPerMinute, 60);

    if (!result.allowed) {
      this.logger.warn(`AI rate limit hit tenant=${tenantId} user=${userId}`);
      throw new AiRateLimitExceededException(60, limits.planName);
    }
  }
}
