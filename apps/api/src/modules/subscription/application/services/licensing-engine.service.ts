import { ForbiddenException, Injectable, Logger, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { getPlanLimits, PlanLimits, UNLIMITED } from '../../domain/config/plan-limits.config';
import {
  comparePlanTiers,
  DEFAULT_GRACE_PERIOD_DAYS,
  FeatureAccessState,
  featureStateForPlan,
  isFeatureAllowed,
  LICENSED_FEATURES,
  LICENSED_MODULES,
  LicensedFeatureId,
  LicensedModuleId,
  lostFeaturesOnDowngrade,
  lostModulesOnDowngrade,
  ModuleAccessMode,
  moduleAccessForPlan,
  USAGE_CRITICAL_THRESHOLD,
  USAGE_WARNING_THRESHOLD,
} from '../../domain/config/licensing.config';
import {
  getLimitsForUiPlan,
  platformPlanToSubscriptionPlan,
  subscriptionPlanToUiPlan,
  UiSubscriptionPlan,
} from '../../domain/config/plan-name.mapper';
import { PlanLimitExceededException, FeatureName, LimitedResource } from '../../domain/exceptions/plan-limit-exceeded.exception';
import { isPlatformAuditSentinelTenantId } from '../../../platform-tenants/platform-tenants.tokens';
import {
  PlanChangePreview,
  TenantEntitlementsPayload,
  TenantLicense,
  TenantLicenseGrants,
  UsageLimitSnapshot,
} from '../../domain/types/tenant-license.types';
import { readGrantHistory } from './subscription-grant-history.util';
import { TenantSubscriptionService } from './tenant-subscription.service';
import type { TenantSubscriptionOverview } from './tenant-subscription.service';
import { LicensingAuditService } from './licensing-audit.service';
import { LicensingLifecycleStateService } from './licensing-lifecycle-state.service';
import { EffectiveEntitlementRuntimeService } from '../../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import { isEffectiveEntitlementRuntimeEnabled } from '../../../effective-entitlement-runtime/effective-entitlement-runtime.module';
import { UsageEnforcementService } from '../../../usage-metering/application/usage-enforcement.service';
import { isUsageMeteringEnforcementEnabled } from '../../../usage-metering/usage-metering.constants';
import { RESOURCE_TO_METER } from '../../../usage-metering/catalog/static-usage-meter.catalog';
import {
  isSnapshotDenyCode,
  planCanonicalToBackendPlan,
  planCanonicalToUiPlan,
  projectFeaturesFromBundle,
  projectModulesFromBundle,
  projectPlanLimitsFromBundle,
} from '../../../effective-entitlement-runtime/application/license-projection';

interface ResolvedTenantContext {
  tenantId: string;
  tenantName: string;
  features: Record<string, unknown>;
  trialEndsAt: Date | null;
  platformTenant: {
    id: string;
    displayName: string;
    plan: string;
    status: string;
    trialEndsAt: Date | null;
    contractEndDate: Date | null;
    contractStartDate: Date | null;
    suspendedAt: Date | null;
  } | null;
  activeSubscription: {
    id: string;
    plan: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    autoRenew: boolean;
    billingCycleMonths: number;
    pricePerMonth: number;
    currency: string;
    paymentReference: string | null;
    paidManuallyAt: Date | null;
  } | null;
}

/**
 * Central licensing engine — single source of truth for tenant entitlements.
 *
 * SubscriptionEnforcementService delegates here. Dynamic Module Management (Phase 3)
 * should consume resolveLicense() / getEntitlements() without adding scattered checks.
 */
@Injectable()
export class LicensingEngineService {
  private readonly logger = new Logger(LicensingEngineService.name);
  private readonly licenseCache = new Map<string, { expiresAt: number; license: TenantLicense }>();
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TenantSubscriptionService))
    private readonly tenantSubscriptionService: TenantSubscriptionService,
    private readonly audit: LicensingAuditService,
    private readonly lifecycleState: LicensingLifecycleStateService,
    @Optional()
    private readonly effectiveEntitlements?: EffectiveEntitlementRuntimeService,
    @Optional()
    private readonly usageEnforcement?: UsageEnforcementService,
  ) {}

  /** Invalidate cached license after plan/grant changes. */
  invalidateCache(tenantId: string): void {
    this.licenseCache.delete(tenantId);
    this.effectiveEntitlements?.invalidateTenant(tenantId);
  }

  async resolveLicense(tenantId: string): Promise<TenantLicense> {
    // Governed production invariant: Platform audit sentinel is not a licensable tenant.
    // Fail closed before cache lookup / tenant lookup / license computation.
    // Authoritative id: PLATFORM_AUDIT_SENTINEL_TENANT_ID (platform-tenants.tokens).
    if (isPlatformAuditSentinelTenantId(tenantId)) {
      this.logger.warn('platform_audit_sentinel_license_rejected');
      throw new NotFoundException('Tenant not found');
    }

    const cached = this.licenseCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.license;
    }

    const ctx = await this.loadTenantContext(tenantId);
    let license = this.buildLicense(ctx);

    // Step 17 coexistence: SNAPSHOT replaces legacy entitlements; LEGACY leaves buildLicense untouched.
    // Never merge SNAPSHOT and LEGACY sources into one decision set.
    if (
      isEffectiveEntitlementRuntimeEnabled() &&
      this.effectiveEntitlements &&
      ctx.platformTenant
    ) {
      try {
        const bundle = await this.effectiveEntitlements.resolveEffectiveEntitlements(tenantId);
        if (bundle.source === 'SNAPSHOT') {
          license = this.applySnapshotBundle(license, bundle);
        }
      } catch (err) {
        this.logger.warn('effective_entitlement_runtime_resolve_failed');
        // Unexpected resolver failure with Step 17 enabled: fail closed (deny writes / modules).
        license = {
          ...license,
          status: 'suspended',
          readOnly: true,
          modules: Object.fromEntries(
            Object.keys(license.modules).map((k) => [k, 'disabled']),
          ) as TenantLicense['modules'],
          features: Object.fromEntries(
            Object.keys(license.features).map((k) => [k, 'disabled']),
          ) as TenantLicense['features'],
        };
        void err;
      }
    }

    await this.lifecycleState.syncFromResolvedLicense(tenantId, license);
    this.licenseCache.set(tenantId, {
      license,
      expiresAt: Date.now() + LicensingEngineService.CACHE_TTL_MS,
    });
    return license;
  }

  private applySnapshotBundle(
    base: TenantLicense,
    bundle: import('../../../effective-entitlement-runtime/domain/effective-entitlement.types').EffectiveEntitlementBundle,
  ): TenantLicense {
    if (isSnapshotDenyCode(bundle.code)) {
      const status: TenantLicense['status'] =
        bundle.code === 'runtime_cancelled' || bundle.code === 'runtime_terminal'
          ? 'cancelled'
          : bundle.code === 'runtime_expired'
            ? 'expired'
            : 'suspended';
      return {
        ...base,
        status,
        readOnly: true,
        modules: Object.fromEntries(
          Object.keys(base.modules).map((k) => [k, 'disabled' as const]),
        ) as TenantLicense['modules'],
        features: Object.fromEntries(
          Object.keys(base.features).map((k) => [k, 'disabled' as const]),
        ) as TenantLicense['features'],
      };
    }

    const backendPlan = planCanonicalToBackendPlan(bundle.planCanonicalKey);
    const uiPlan = planCanonicalToUiPlan(bundle.planCanonicalKey);
    const modules = projectModulesFromBundle(bundle);
    const features = projectFeaturesFromBundle(bundle);
    const effectiveLimits = projectPlanLimitsFromBundle(
      bundle,
      backendPlan,
      base.effectiveLimits.features,
    );
    // Feature flags from Catalog FEATURE grants only (no legacy matrix mix).
    const backendFeatures = { ...base.backendFeatures };
    for (const row of Object.keys(backendFeatures) as Array<keyof typeof backendFeatures>) {
      backendFeatures[row] = false;
    }
    if (features.workflow === 'enabled') backendFeatures.customWorkflows = true;
    if (features.analytics === 'enabled') backendFeatures.advancedAnalytics = true;
    if (features.auditLogs === 'enabled') backendFeatures.auditExport = true;
    if (features.multiProviderAi === 'enabled') backendFeatures.aiModels = true;

    return {
      ...base,
      uiPlan,
      backendPlan,
      platformPlan: bundle.planCanonicalKey ?? base.platformPlan,
      status: 'active',
      readOnly: false,
      modules,
      features,
      limits: effectiveLimits,
      effectiveLimits: { ...effectiveLimits, features: backendFeatures },
      backendFeatures,
      licenseId: bundle.snapshotId ?? base.licenseId,
      version: base.version + 1,
    };
  }

  async getEntitlements(tenantId: string): Promise<TenantEntitlementsPayload> {
    const [license, usage] = await Promise.all([
      this.resolveLicense(tenantId),
      this.tenantSubscriptionService.getUsage(tenantId),
    ]);

    const usageLimits = this.buildUsageSnapshots(license.effectiveLimits, usage);
    const readOnly = license.readOnly;

    return {
      license,
      usage: usage as unknown as Record<string, number>,
      usageLimits,
      canWrite:
        !readOnly &&
        license.status !== 'suspended' &&
        license.status !== 'expired' &&
        license.status !== 'cancelled',
      canMutate: license.status === 'active' || license.status === 'trial',
    };
  }

  /** Subscription overview — single source of truth for plan/limits UI. */
  async getSubscriptionOverview(tenantId: string): Promise<TenantSubscriptionOverview> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const [license, ctx] = await Promise.all([
      this.resolveLicense(tenantId),
      this.loadTenantContext(tenantId),
    ]);
    const sub = ctx.activeSubscription;

    return {
      tenantId: license.tenantId,
      platformTenantId: license.platformTenantId,
      displayName: license.displayName,
      plan: license.backendPlan,
      uiPlan: license.uiPlan,
      backendPlan: license.backendPlan,
      status: license.subscriptionStatus,
      platformStatus: license.platformStatus,
      endDate: license.endDate,
      pricePerMonth: sub?.pricePerMonth ?? 0,
      currency: sub?.currency ?? 'USD',
      trialEndsAt: license.trialEndsAt,
      contractEndDate: license.contractEndDate,
      limits: license.effectiveLimits,
      entitlements: license.grants,
      grantHistory: license.grantHistory,
      payment: sub
        ? {
            method: sub.paidManuallyAt ? 'manual' : 'invoice',
            reference: sub.paymentReference,
            paidAt: sub.paidManuallyAt?.toISOString() ?? null,
            autoRenew: sub.autoRenew,
            billingCycleMonths: sub.billingCycleMonths,
          }
        : null,
    };
  }

  async getActivePlanLimits(tenantId: string): Promise<PlanLimits> {
    const license = await this.resolveLicense(tenantId);
    return license.effectiveLimits;
  }

  async enforceLicenseWritable(tenantId: string): Promise<void> {
    const license = await this.resolveLicense(tenantId);
    if (license.readOnly) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'License Read Only',
        message: 'Your license is in read-only mode. Upgrade or renew to make changes.',
        licenseStatus: license.status,
        upgradeRequired: true,
      });
    }
    if (license.status === 'suspended' || license.status === 'expired' || license.status === 'cancelled') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'License Inactive',
        message: `Tenant license is ${license.status}. Contact support to reactivate.`,
        licenseStatus: license.status,
        upgradeRequired: true,
      });
    }
  }

  async enforceModuleAccess(tenantId: string, moduleId: LicensedModuleId): Promise<void> {
    await this.enforceLicenseWritable(tenantId);
    const license = await this.resolveLicense(tenantId);
    const access = license.modules[moduleId] ?? 'disabled';
    if (access === 'disabled' || access === 'hidden') {
      throw new PlanLimitExceededException(moduleId, false, license.effectiveLimits.planName);
    }
    if (access === 'read_only') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Module Read Only',
        message: `Module "${moduleId}" is read-only on your current plan.`,
        module: moduleId,
        currentPlan: license.uiPlan,
        upgradeRequired: true,
      });
    }
  }

  async enforceFeature(tenantId: string, feature: FeatureName): Promise<void> {
    await this.enforceLicenseWritable(tenantId);
    const license = await this.resolveLicense(tenantId);
    if (!license.backendFeatures[feature]) {
      throw new PlanLimitExceededException(feature, false, license.effectiveLimits.planName);
    }
  }

  async enforceLicensedFeature(tenantId: string, featureId: LicensedFeatureId): Promise<void> {
    await this.enforceLicenseWritable(tenantId);
    const license = await this.resolveLicense(tenantId);
    const state = license.features[featureId];
    if (!state || !isFeatureAllowed(state)) {
      throw new PlanLimitExceededException(featureId, false, license.effectiveLimits.planName);
    }
  }

  async enforceResourceLimit(tenantId: string, resource: LimitedResource): Promise<void> {
    await this.enforceLicenseWritable(tenantId);

    // U01: when enabled and meter maps to resource, enforce via UsageEnforcementService
    // while preserving Step 17 limit projection (getLimit inside enforcement). Flag off = legacy.
    if (
      isUsageMeteringEnforcementEnabled() &&
      this.usageEnforcement &&
      RESOURCE_TO_METER[resource]
    ) {
      await this.usageEnforcement.assertResourceAllowed(tenantId, resource, '1');
      return;
    }

    const limits = await this.getActivePlanLimits(tenantId);
    const usage = await this.tenantSubscriptionService.getUsage(tenantId);

    if (resource === 'doctors') {
      if (limits.maxDoctors === UNLIMITED) return;
      await this.assertCount(tenantId, await this.countDoctors(tenantId), limits.maxDoctors, 'doctors', limits.planName);
      return;
    }

    const map: Partial<Record<LimitedResource, [number, number]>> = {
      users: [usage.users, limits.maxUsers],
      branches: [usage.branches, limits.maxBranches],
      patients: [usage.patients, limits.maxPatients],
      appointments_per_month: [usage.appointmentsThisMonth, limits.maxAppointmentsPerMonth],
      reports_per_month: [usage.reportsThisMonth, limits.maxReportsPerMonth],
      api_requests_per_day: [usage.apiCallsToday, limits.maxApiRequestsPerDay],
    };

    const pair = map[resource];
    if (pair) {
      await this.assertCount(tenantId, pair[0], pair[1], resource, limits.planName);
    }
  }

  async enforceUserLimit(tenantId: string): Promise<void> {
    await this.enforceResourceLimit(tenantId, 'users');
  }

  async enforceDoctorLimit(tenantId: string): Promise<void> {
    await this.enforceResourceLimit(tenantId, 'doctors');
  }

  async enforcePatientLimit(tenantId: string): Promise<void> {
    await this.enforceResourceLimit(tenantId, 'patients');
  }

  async enforceAppointmentLimit(tenantId: string): Promise<void> {
    await this.enforceResourceLimit(tenantId, 'appointments_per_month');
  }

  async enforceBranchLimit(tenantId: string): Promise<void> {
    await this.enforceResourceLimit(tenantId, 'branches');
  }

  async enforceReportLimit(tenantId: string): Promise<void> {
    await this.enforceResourceLimit(tenantId, 'reports_per_month');
  }

  async enforceStorageLimit(tenantId: string, additionalBytes: number): Promise<void> {
    await this.enforceLicenseWritable(tenantId);
    const limits = await this.getActivePlanLimits(tenantId);
    if (limits.maxStorageGb === UNLIMITED) return;

    const usage = await this.tenantSubscriptionService.getUsage(tenantId);
    const maxBytes = limits.maxStorageGb * 1024 * 1024 * 1024;
    const currentBytes = usage.storageGb * 1024 * 1024 * 1024;

    if (currentBytes + additionalBytes > maxBytes) {
      await this.audit.recordLicenseEvent({
        tenantId,
        eventType: 'usage.exceeded',
        usageLimit: 'storage_gb',
        decision: 'denied',
        reason: `storage_gb limit exceeded (${usage.storageGb}GB / ${limits.maxStorageGb}GB)`,
        source: 'licensing.engine',
        metadata: { currentGb: usage.storageGb, maxGb: limits.maxStorageGb, additionalBytes },
      });
      throw new PlanLimitExceededException('storage_gb', limits.maxStorageGb, limits.planName);
    }
  }

  async previewPlanChange(tenantId: string, targetPlanRaw: string): Promise<PlanChangePreview> {
    const license = await this.resolveLicense(tenantId);
    const resolved = this.tenantSubscriptionService.resolveRequestedPlan(targetPlanRaw);
    const targetPlan = resolved.uiPlan as UiSubscriptionPlan;
    const direction = comparePlanTiers(license.uiPlan, targetPlan);

    const currentLimits = license.effectiveLimits;
    const targetBase = getPlanLimits(resolved.backendPlan);
    const targetLimits = getLimitsForUiPlan(targetPlan, targetBase);
    const targetEffective = this.applyGrantBonuses(targetLimits, license.grants);

    const limitChanges: PlanChangePreview['limitChanges'] = [];
    for (const key of [
      'maxUsers',
      'maxBranches',
      'maxPatients',
      'maxStorageGb',
      'maxReportsPerMonth',
      'maxAppointmentsPerMonth',
    ] as const) {
      const from = currentLimits[key];
      const to = targetEffective[key];
      if (from !== to) {
        limitChanges.push({ resource: key, from, to });
      }
    }

    const warnings: string[] = [];
    if (direction === 'downgrade') {
      const usage = await this.tenantSubscriptionService.getUsage(tenantId);
      if (targetEffective.maxUsers !== UNLIMITED && usage.users > targetEffective.maxUsers) {
        warnings.push(`Current staff count (${usage.users}) exceeds target plan limit (${targetEffective.maxUsers}).`);
      }
      if (targetEffective.maxBranches !== UNLIMITED && usage.branches > targetEffective.maxBranches) {
        warnings.push(`Active branches (${usage.branches}) exceed target plan limit (${targetEffective.maxBranches}).`);
      }
    }

    return {
      currentPlan: license.uiPlan,
      targetPlan,
      direction,
      effectiveDate: new Date().toISOString(),
      immediate: direction === 'upgrade',
      lostFeatures: lostFeaturesOnDowngrade(license.uiPlan, targetPlan).map((f) => f.id),
      lostModules: lostModulesOnDowngrade(license.uiPlan, targetPlan).map((m) => m.id),
      limitChanges,
      warnings,
    };
  }

  canUseFeature(license: TenantLicense, featureId: LicensedFeatureId): boolean {
    return isFeatureAllowed(license.features[featureId] ?? 'disabled');
  }

  applyGrantBonuses(limits: PlanLimits, grants: TenantLicenseGrants): PlanLimits {
    return {
      ...limits,
      maxUsers: limits.maxUsers === UNLIMITED ? UNLIMITED : limits.maxUsers + grants.usersBonus,
      maxStorageGb:
        limits.maxStorageGb === UNLIMITED ? UNLIMITED : limits.maxStorageGb + grants.storageGbBonus,
    };
  }

  private async loadTenantContext(tenantId: string): Promise<ResolvedTenantContext> {
    const [tenant, platformTenant] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, features: true, trialEndsAt: true },
      }),
      this.prisma.platformTenant.findUnique({
        where: { tenantId },
        include: {
          platformSubscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
    ]);

    if (!tenant) {
      this.logger.warn(`Tenant ${tenantId} not found; defaulting license to lite/starter`);
    }

    const activeSub = platformTenant?.platformSubscriptions[0] ?? null;

    return {
      tenantId,
      tenantName: tenant?.name ?? 'Unknown',
      features: (tenant?.features ?? {}) as Record<string, unknown>,
      trialEndsAt: tenant?.trialEndsAt ?? null,
      platformTenant: platformTenant
        ? {
            id: platformTenant.id,
            displayName: platformTenant.displayName,
            plan: platformTenant.plan,
            status: platformTenant.status,
            trialEndsAt: platformTenant.trialEndsAt,
            contractEndDate: platformTenant.contractEndDate,
            contractStartDate: platformTenant.contractStartDate,
            suspendedAt: platformTenant.suspendedAt,
          }
        : null,
      activeSubscription: activeSub
        ? {
            id: activeSub.id,
            plan: activeSub.plan,
            status: activeSub.status,
            startDate: activeSub.startDate,
            endDate: activeSub.endDate,
            autoRenew: activeSub.autoRenew,
            billingCycleMonths: activeSub.billingCycleMonths,
            pricePerMonth: Number(activeSub.pricePerMonth ?? 0),
            currency: activeSub.currency ?? 'USD',
            paymentReference: activeSub.paymentReference,
            paidManuallyAt: activeSub.paidManuallyAt,
          }
        : null,
    };
  }

  private buildLicense(ctx: ResolvedTenantContext): TenantLicense {
    const uiTier =
      typeof ctx.features.subscriptionUiPlan === 'string'
        ? (ctx.features.subscriptionUiPlan as UiSubscriptionPlan)
        : null;

    const backendPlan = ctx.platformTenant
      ? platformPlanToSubscriptionPlan(ctx.activeSubscription?.plan ?? ctx.platformTenant.plan)
      : 'lite';

    const uiPlan = subscriptionPlanToUiPlan(backendPlan, uiTier);
    const baseLimits = getPlanLimits(backendPlan);
    const limits = getLimitsForUiPlan(uiPlan, baseLimits);
    const grants = this.readGrants(ctx.features);
    const effectiveLimits = this.applyGrantBonuses(limits, grants);

    const status = this.resolveLicenseStatus(ctx);
    const readOnly = status === 'grace' || status === 'suspended';

    const features = {} as Record<LicensedFeatureId, FeatureAccessState>;
    for (const row of LICENSED_FEATURES) {
      features[row.id] = featureStateForPlan(row.id, uiPlan);
    }

    const modules = {} as Record<LicensedModuleId, ModuleAccessMode>;
    for (const mod of LICENSED_MODULES) {
      modules[mod.id] = moduleAccessForPlan(mod.id, uiPlan);
    }

    const billingCycleMonths = ctx.activeSubscription?.billingCycleMonths ?? 1;
    const billingCycle =
      billingCycleMonths >= 12 ? 'yearly' : billingCycleMonths >= 3 ? 'quarterly' : 'monthly';

    const trialEndsAt =
      ctx.platformTenant?.trialEndsAt?.toISOString() ??
      ctx.trialEndsAt?.toISOString() ??
      null;

    const endDate =
      ctx.activeSubscription?.endDate?.toISOString() ??
      ctx.platformTenant?.contractEndDate?.toISOString() ??
      trialEndsAt;

    const gracePeriodEndsAt =
      status === 'grace' && endDate
        ? new Date(new Date(endDate).getTime() + DEFAULT_GRACE_PERIOD_DAYS * 86_400_000).toISOString()
        : null;

    return {
      licenseId: ctx.activeSubscription?.id ?? ctx.platformTenant?.id ?? ctx.tenantId,
      tenantId: ctx.tenantId,
      platformTenantId: ctx.platformTenant?.id ?? null,
      displayName: ctx.platformTenant?.displayName ?? ctx.tenantName,
      uiPlan,
      backendPlan,
      platformPlan: ctx.platformTenant?.plan?.toLowerCase() ?? 'starter',
      status,
      subscriptionStatus: ctx.activeSubscription?.status ?? 'TRIAL',
      platformStatus: ctx.platformTenant?.status ?? null,
      billingCycle,
      startDate: ctx.activeSubscription?.startDate?.toISOString() ?? null,
      endDate,
      renewalDate: ctx.activeSubscription?.autoRenew ? endDate : null,
      trialEndsAt,
      contractEndDate: ctx.platformTenant?.contractEndDate?.toISOString() ?? null,
      gracePeriodEndsAt,
      autoRenew: ctx.activeSubscription?.autoRenew ?? false,
      readOnly,
      limits,
      effectiveLimits,
      grants,
      features,
      modules,
      backendFeatures: effectiveLimits.features,
      grantHistory: readGrantHistory(ctx.features),
      version: 1,
    };
  }

  private resolveLicenseStatus(ctx: ResolvedTenantContext): TenantLicense['status'] {
    const platformStatus = ctx.platformTenant?.status?.toUpperCase();
    if (platformStatus === 'SUSPENDED' || platformStatus === 'ARCHIVED') return 'suspended';
    if (platformStatus === 'PROVISIONING') return 'provisioning';

    const subStatus = ctx.activeSubscription?.status?.toUpperCase();
    if (subStatus === 'CANCELLED') return 'cancelled';
    if (subStatus === 'SUSPENDED') return 'suspended';
    if (subStatus === 'EXPIRED') return 'expired';
    if (subStatus === 'TRIAL') return 'trial';

    const now = Date.now();
    const trialEnd = ctx.platformTenant?.trialEndsAt ?? ctx.trialEndsAt;
    if (trialEnd && trialEnd.getTime() > now) return 'trial';

    const contractEnd = ctx.platformTenant?.contractEndDate ?? ctx.activeSubscription?.endDate;
    if (contractEnd) {
      const endMs = contractEnd.getTime();
      if (endMs < now) {
        const graceEnd = endMs + DEFAULT_GRACE_PERIOD_DAYS * 86_400_000;
        if (now <= graceEnd) return 'grace';
        return 'expired';
      }
    }

    return 'active';
  }

  private readGrants(features: Record<string, unknown>): TenantLicenseGrants {
    const grants = (features.subscriptionGrants ?? {}) as Record<string, unknown>;
    return {
      aiCreditsBonus: Number(grants.aiCreditsBonus ?? 0),
      storageGbBonus: Number(grants.storageGbBonus ?? 0),
      usersBonus: Number(grants.usersBonus ?? 0),
    };
  }

  private buildUsageSnapshots(
    limits: PlanLimits,
    usage: Awaited<ReturnType<TenantSubscriptionService['getUsage']>>,
  ): UsageLimitSnapshot[] {
    const rows: Array<{ resource: string; current: number; maximum: number }> = [
      { resource: 'users', current: usage.users, maximum: limits.maxUsers },
      { resource: 'branches', current: usage.branches, maximum: limits.maxBranches },
      { resource: 'patients', current: usage.patients, maximum: limits.maxPatients },
      { resource: 'appointments', current: usage.appointmentsThisMonth, maximum: limits.maxAppointmentsPerMonth },
      { resource: 'reports', current: usage.reportsThisMonth, maximum: limits.maxReportsPerMonth },
      { resource: 'storageGb', current: usage.storageGb, maximum: limits.maxStorageGb },
      { resource: 'apiCalls', current: usage.apiCallsToday, maximum: limits.maxApiRequestsPerDay },
      { resource: 'email', current: usage.emailThisMonth, maximum: limits.maxEmailPerMonth },
      { resource: 'sms', current: usage.smsThisMonth, maximum: limits.maxSmsPerMonth },
      { resource: 'whatsapp', current: usage.whatsappThisMonth, maximum: limits.maxWhatsappPerMonth },
      { resource: 'push', current: usage.pushThisMonth, maximum: limits.maxPushPerMonth },
    ];

    return rows.map(({ resource, current, maximum }) => {
      const remaining = maximum === UNLIMITED ? UNLIMITED : Math.max(0, maximum - current);
      const percentUsed =
        maximum === UNLIMITED || maximum <= 0 ? 0 : Math.min(100, Math.round((current / maximum) * 100));
      return {
        resource,
        current,
        maximum,
        remaining,
        percentUsed,
        warning: percentUsed >= USAGE_WARNING_THRESHOLD && percentUsed < USAGE_CRITICAL_THRESHOLD,
        critical: percentUsed >= USAGE_CRITICAL_THRESHOLD,
      };
    });
  }

  private async assertCount(
    tenantId: string,
    current: number,
    max: number,
    resource: LimitedResource,
    plan: PlanLimits['planName'],
  ): Promise<void> {
    if (max === UNLIMITED) return;
    if (current >= max) {
      await this.audit.recordLicenseEvent({
        tenantId,
        eventType: 'usage.exceeded',
        usageLimit: resource,
        decision: 'denied',
        reason: `${resource} limit exceeded (${current}/${max})`,
        source: 'licensing.engine',
        metadata: { current, max, plan },
      });
      throw new PlanLimitExceededException(resource, max, plan);
    }
  }

  private async countDoctors(tenantId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        tenantId,
        deletedAt: null,
        roles: { some: { role: { in: ['DOCTOR', 'DENTIST', 'SPECIALIST'] } } },
      },
    });
  }
}
