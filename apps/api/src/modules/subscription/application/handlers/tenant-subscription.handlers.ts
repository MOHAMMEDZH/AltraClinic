import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, PLATFORM_TENANT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PlatformTenantRepository } from '../../../platform-admin/domain/repositories/platform-tenant.repository.interface';
import { PlatformTenantPlanChangedEvent } from '../../../platform-admin/domain/events/platform-tenant-plan-changed.event';
import { TenantSubscriptionService } from '../services/tenant-subscription.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { appendGrantHistory } from '../services/subscription-grant-history.util';
import { LicensingEngineService } from '../services/licensing-engine.service';
import { LicensingCommercialAuditService } from '../services/licensing-commercial-audit.service';
import { LicensingLifecycleStateService } from '../services/licensing-lifecycle-state.service';

@Injectable()
export class GetTenantLicenseHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly licensing: LicensingEngineService,
  ) {}

  async execute() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.licensing.resolveLicense(tenantId);
  }
}

@Injectable()
export class GetTenantEntitlementsHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly licensing: LicensingEngineService,
  ) {}

  async execute() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.licensing.getEntitlements(tenantId);
  }
}

@Injectable()
export class PreviewTenantPlanChangeHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly licensing: LicensingEngineService,
  ) {}

  async execute(params: { plan: string }) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.licensing.previewPlanChange(tenantId, params.plan);
  }
}

@Injectable()
export class GetTenantSubscriptionHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantSubscriptionService: TenantSubscriptionService,
  ) {}

  async execute() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.tenantSubscriptionService.getOverview(tenantId);
  }
}

@Injectable()
export class ListTenantSubscriptionPlansHandler {
  constructor(private readonly tenantSubscriptionService: TenantSubscriptionService) {}

  execute() {
    return this.tenantSubscriptionService.listPlans();
  }
}

@Injectable()
export class GetTenantSubscriptionUsageHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantSubscriptionService: TenantSubscriptionService,
  ) {}

  async execute() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.tenantSubscriptionService.getUsage(tenantId);
  }
}

@Injectable()
export class GetTenantSubscriptionPaymentsHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantSubscriptionService: TenantSubscriptionService,
  ) {}

  async execute() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.tenantSubscriptionService.getPayments(tenantId);
  }
}

@Injectable()
export class ChangeTenantSubscriptionPlanHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantSubscriptionService: TenantSubscriptionService,
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly platformTenantRepository: PlatformTenantRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingEngineService,
  ) {}

  async execute(params: { plan: string; actorId: string; actorRoles: string[]; reason?: string }) {
    if (!params.actorRoles.some((role) => ['super_admin', 'owner'].includes(role))) {
      throw new ForbiddenException('Only owners can change the tenant subscription plan');
    }

    const { tenantId } = await this.tenantContext.resolve();
    const resolved = this.tenantSubscriptionService.resolveRequestedPlan(params.plan);

    let platformTenant = await this.platformTenantRepository.findByTenantId(tenantId);
    if (!platformTenant) {
      throw new NotFoundException('Platform tenant record not found for this clinic');
    }

    const previousPlan = platformTenant.plan.value;
    const changed = platformTenant.changePlan(resolved.platformPlan);
    if (changed) {
      await this.platformTenantRepository.save(platformTenant);
      await this.eventPublisher.publish(
        new PlatformTenantPlanChangedEvent(
          tenantId,
          platformTenant.id,
          previousPlan,
          platformTenant.plan.value,
          params.actorId,
        ),
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    const features = { ...((tenant?.features ?? {}) as Record<string, unknown>) };
    features.subscriptionUiPlan = resolved.uiPlan;

    const latestSub = await this.prisma.platformSubscription.findFirst({
      where: { platformTenantId: platformTenant.id },
      orderBy: { createdAt: 'desc' },
    });
    if (latestSub) {
      const prismaPlan = resolved.backendPlan.toUpperCase() as 'LITE' | 'PRO' | 'ENTERPRISE';
      await this.prisma.platformSubscription.update({
        where: { id: latestSub.id },
        data: { plan: prismaPlan },
      });
    }

    const featuresWithHistory = appendGrantHistory(features, {
      action: 'plan_change',
      plan: resolved.uiPlan,
      previousPlan: previousPlan,
      note: params.reason ?? null,
      grantedBy: params.actorId,
      at: new Date().toISOString(),
    });
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { features: featuresWithHistory },
    });

    this.licensing.invalidateCache(tenantId);

    return {
      changed,
      plan: resolved.backendPlan,
      uiPlan: resolved.uiPlan,
      platformPlan: resolved.platformPlan,
      reason: params.reason ?? null,
    };
  }
}

@Injectable()
export class GrantTenantEntitlementsHandler {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly platformTenantRepository: PlatformTenantRepository,
    private readonly licensing: LicensingEngineService,
  ) {}

  async execute(params: {
    platformTenantId: string;
    grantType: 'aiCredits' | 'storage' | 'users';
    amount: number;
    note?: string;
    actorId: string;
  }) {
    if (!params.platformTenantId?.trim()) {
      throw new BadRequestException('Platform tenant identifier is required');
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Grant amount must be a positive number');
    }

    const platformTenant = await this.platformTenantRepository.findById(params.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${params.platformTenantId} not found`);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: platformTenant.tenantId },
      select: { features: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${platformTenant.tenantId} not found`);
    }

    const features = { ...((tenant.features ?? {}) as Record<string, unknown>) };
    const grants = {
      ...((features.subscriptionGrants ?? {}) as Record<string, unknown>),
    };
    const bonusKey =
      params.grantType === 'aiCredits'
        ? 'aiCreditsBonus'
        : params.grantType === 'storage'
          ? 'storageGbBonus'
          : 'usersBonus';
    grants[bonusKey] = Number(grants[bonusKey] ?? 0) + params.amount;
    const nextFeatures = appendGrantHistory(features, {
      action: params.grantType,
      grantType: params.grantType,
      amount: params.amount,
      note: params.note ?? null,
      grantedBy: params.actorId,
      at: new Date().toISOString(),
    });
    (nextFeatures.subscriptionGrants as Record<string, unknown>)[bonusKey] = grants[bonusKey];

    await this.prisma.tenant.update({
      where: { id: platformTenant.tenantId },
      data: { features: nextFeatures },
    });

    this.licensing.invalidateCache(platformTenant.tenantId);

    const savedGrants = (nextFeatures.subscriptionGrants ?? {}) as Record<string, number>;

    return {
      tenantId: platformTenant.tenantId,
      platformTenantId: platformTenant.id,
      grantType: params.grantType,
      amount: params.amount,
      entitlements: {
        aiCreditsBonus: Number(savedGrants.aiCreditsBonus ?? 0),
        storageGbBonus: Number(savedGrants.storageGbBonus ?? 0),
        usersBonus: Number(savedGrants.usersBonus ?? 0),
      },
    };
  }
}

@Injectable()
export class GrantTenantTrialHandler {
  constructor(
    private readonly tenantSubscriptionService: TenantSubscriptionService,
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly platformTenantRepository: PlatformTenantRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingEngineService,
    private readonly commercialAudit: LicensingCommercialAuditService,
    private readonly lifecycleState: LicensingLifecycleStateService,
  ) {}

  async execute(params: {
    platformTenantId: string;
    plan: string;
    days: number;
    actorId: string;
  }) {
    if (!params.platformTenantId?.trim()) {
      throw new BadRequestException('Platform tenant identifier is required');
    }

    const platformTenant = await this.platformTenantRepository.findById(params.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${params.platformTenantId} not found`);
    }

    const resolved = this.tenantSubscriptionService.resolveRequestedPlan(params.plan);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + params.days);

    if (platformTenant.status.value === 'provisioning') {
      platformTenant.activate();
    }
    platformTenant.changePlan(resolved.platformPlan);
    await this.platformTenantRepository.save(platformTenant);

    await this.prisma.platformTenant.update({
      where: { id: platformTenant.id },
      data: { trialEndsAt },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: platformTenant.tenantId },
      select: { features: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${platformTenant.tenantId} not found`);
    }

    let features = { ...((tenant.features ?? {}) as Record<string, unknown>) };
    features.subscriptionUiPlan = resolved.uiPlan;
    features = appendGrantHistory(features, {
      action: 'grant_trial',
      plan: resolved.uiPlan,
      days: params.days,
      note: `${resolved.uiPlan} trial for ${params.days} days`,
      grantedBy: params.actorId,
      at: new Date().toISOString(),
    });

    await this.prisma.tenant.update({
      where: { id: platformTenant.tenantId },
      data: {
        trialEndsAt,
        trialStartedAt: new Date(),
        features,
      },
    });

    const latestSub = await this.prisma.platformSubscription.findFirst({
      where: { platformTenantId: platformTenant.id },
      orderBy: { createdAt: 'desc' },
    });
    if (latestSub) {
      const prismaPlan = resolved.backendPlan.toUpperCase() as 'LITE' | 'PRO' | 'ENTERPRISE';
      await this.prisma.platformSubscription.update({
        where: { id: latestSub.id },
        data: { plan: prismaPlan, status: 'TRIAL', endDate: trialEndsAt },
      });
    }

    await this.eventPublisher.publish(
      new PlatformTenantPlanChangedEvent(
        platformTenant.tenantId,
        platformTenant.id,
        platformTenant.plan.value,
        resolved.platformPlan,
        params.actorId,
      ),
    );

    this.licensing.invalidateCache(platformTenant.tenantId);

    await this.commercialAudit.recordTrialStart({
      tenantId: platformTenant.tenantId,
      actorId: params.actorId,
      plan: resolved.uiPlan,
      days: params.days,
      source: 'subscription.grant_trial',
    });

    await this.lifecycleState.persistKnownStatus(
      platformTenant.tenantId,
      'trial',
      resolved.uiPlan,
    );

    return {
      platformTenantId: platformTenant.id,
      tenantId: platformTenant.tenantId,
      plan: resolved.uiPlan,
      trialEndsAt: trialEndsAt.toISOString(),
      days: params.days,
    };
  }
}
