import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { isBuiltinOnlyAiMode } from '../../domain/config/ai-builtin.config';
import {
  AI_TENANT_PROVIDER_DEFAULTS,
  normalizeTenantProviderSettings,
  parseTenantSettingsJson,
  toTenantSettingsJson,
  type AiTenantExternalProvider,
  type AiTenantProviderSettings,
} from '../../domain/config/ai-tenant-provider.config';
import type { AiProviderHealth } from '../services/ai-inference.types';
import type { AiSubscriptionService } from './ai-subscription.service';

export interface AiTenantProviderManagementDto {
  settings: AiTenantProviderSettings;
  effectiveActiveProvider: string;
  canManage: boolean;
  lockedReasonKey?: string;
  providers: AiProviderHealth[];
}

type LimitsSnapshot = Awaited<ReturnType<AiSubscriptionService['getLimits']>>;

@Injectable()
export class AiTenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProviderSettings(tenantId: string): Promise<AiTenantProviderSettings> {
    try {
      const row = await this.prisma.aiTenantSettings.findUnique({ where: { tenantId } });
      return row ? parseTenantSettingsJson(row.settingsJson) : { ...AI_TENANT_PROVIDER_DEFAULTS };
    } catch {
      return { ...AI_TENANT_PROVIDER_DEFAULTS };
    }
  }

  async getProviderManagement(
    tenantId: string,
    providers: AiProviderHealth[],
    limits: LimitsSnapshot,
  ): Promise<AiTenantProviderManagementDto> {
    const settings = await this.getProviderSettings(tenantId);
    const gate = this.managementGate(limits);
    return {
      settings,
      effectiveActiveProvider: this.resolveActiveProvider(settings, providers, limits),
      canManage: gate.canManage,
      lockedReasonKey: gate.lockedReasonKey,
      providers,
    };
  }

  async updateProviderSettings(
    tenantId: string,
    limits: LimitsSnapshot,
    patch: Partial<AiTenantProviderSettings>,
  ): Promise<AiTenantProviderSettings> {
    const gate = this.managementGate(limits);
    if (!gate.canManage) {
      throw new BadRequestException(gate.lockedReasonKey ?? 'ai.admin.providersLockedPlan');
    }

    const current = await this.getProviderSettings(tenantId);
    const next = normalizeTenantProviderSettings({
      ...current,
      ...patch,
    });

    if (!next.geminiEnabled && !next.openaiEnabled && next.preferredExternalProvider !== 'auto') {
      throw new BadRequestException('Enable at least one external provider or use auto routing.');
    }

    if (next.preferredExternalProvider === 'gemini' && !next.geminiEnabled) {
      throw new BadRequestException('Gemini must be enabled when set as preferred provider.');
    }
    if (next.preferredExternalProvider === 'openai' && !next.openaiEnabled) {
      throw new BadRequestException('OpenAI must be enabled when set as preferred provider.');
    }

    await this.prisma.aiTenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settingsJson: toTenantSettingsJson(next) as unknown as Prisma.InputJsonValue,
      },
      update: {
        settingsJson: toTenantSettingsJson(next) as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
  }

  managementGate(limits: LimitsSnapshot): { canManage: boolean; lockedReasonKey?: string } {
    if (isBuiltinOnlyAiMode()) {
      return { canManage: false, lockedReasonKey: 'ai.admin.providersLockedBuiltin' };
    }
    if (!limits.limits.externalProvidersEnabled) {
      return { canManage: false, lockedReasonKey: 'ai.admin.providersLockedPlan' };
    }
    return { canManage: true };
  }

  resolveActiveProvider(
    settings: AiTenantProviderSettings,
    providers: AiProviderHealth[],
    limits: LimitsSnapshot,
  ): string {
    const skill = providers.find((p) => p.provider === 'skill' && p.status === 'healthy');
    if (isBuiltinOnlyAiMode() || !limits.limits.externalProvidersEnabled) {
      return skill?.provider ?? 'skill';
    }

    const externalOrder = this.externalProviderOrder(settings, providers);
    const preferred = externalOrder.find((id) => {
      const row = providers.find((p) => p.provider === id);
      return row?.configured && row.status === 'healthy';
    });
    if (preferred) return preferred;

    return skill?.provider ?? providers.find((p) => p.configured && p.status === 'healthy')?.provider ?? 'template';
  }

  externalProviderOrder(
    settings: AiTenantProviderSettings,
    providers: AiProviderHealth[],
  ): AiTenantExternalProvider[] {
    const geminiOk = settings.geminiEnabled && providers.some((p) => p.provider === 'gemini' && p.configured);
    const openaiOk = settings.openaiEnabled && providers.some((p) => p.provider === 'openai' && p.configured);

    if (settings.preferredExternalProvider === 'gemini') {
      return geminiOk ? ['gemini'] : openaiOk ? ['openai'] : [];
    }
    if (settings.preferredExternalProvider === 'openai') {
      return openaiOk ? ['openai'] : geminiOk ? ['gemini'] : [];
    }

    const order: AiTenantExternalProvider[] = [];
    if (geminiOk) order.push('gemini');
    if (openaiOk) order.push('openai');
    return order;
  }
}
