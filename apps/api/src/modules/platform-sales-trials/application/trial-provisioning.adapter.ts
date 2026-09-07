import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformSubscriptionsService } from '../../platform-subscriptions/application/platform-subscriptions.service';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import { SalesTrialError } from '../domain/sales-trial.errors';
import { isSalesTrialsFailureInjectionActive } from '../platform-sales-trials.constants';

export type TrialProvisioningOutcome = {
  platformTenantId: string;
  tenantId: string;
  commercialConfigId: string;
};

/**
 * Flexible Step 25 — Trial tenant + commercial establishment.
 *
 * Provisioning authority remains Step 17 and commercial authority remains Step 16:
 * this adapter creates the Tenant/PlatformTenant identity pair using the accepted
 * provisioning Prisma shape, then delegates the entire commercial path (create →
 * assign Plan Version → activate + immutable snapshot) to the real Step 16
 * `PlatformSubscriptionsService` with provisioning authority. There is no parallel
 * Trial entitlement engine: EER reads the Step 16 activation snapshot.
 */
@Injectable()
export class TrialProvisioningAdapter {
  private readonly logger = new Logger(TrialProvisioningAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: PlatformSubscriptionsService,
    @Optional() private readonly eer?: EffectiveEntitlementRuntimeService,
  ) {}

  /** Reuses an existing PlatformTenant when the caller supplied one, else creates the pair. */
  async resolveOrCreateTenant(input: {
    claims: JwtClaimsVO;
    trialId: string;
    organizationName: string;
    platformTenantId?: string | null;
    facilityTypeKey: string;
    specialtyKeys: string[];
    moduleKeys: string[];
  }): Promise<{ platformTenantId: string; tenantId: string }> {
    if (input.platformTenantId) {
      const existing = await this.prisma.withPlatformBypass((client) =>
        client.platformTenant.findUnique({
          where: { id: input.platformTenantId! },
          select: { id: true, tenantId: true, status: true },
        }),
      );
      if (!existing) {
        throw new SalesTrialError('tenant_not_found', 'platformTenantId not found.', 400);
      }
      if (existing.status === 'ARCHIVED' || existing.status === 'SUSPENDED') {
        throw new SalesTrialError(
          'tenant_lifecycle_ineligible',
          'Tenant lifecycle is ineligible for Trial activation.',
          409,
        );
      }
      return { platformTenantId: existing.id, tenantId: existing.tenantId };
    }

    const slug = `trial-${input.trialId.replace(/-/g, '').slice(0, 16)}`;
    return this.prisma.withPlatformBypass(async (client) => {
      const tenant = await client.tenant.create({
        data: {
          name: input.organizationName,
          slug,
          status: 'SUSPENDED',
          lifecycleStatus: 'TRIAL',
          features: {
            facilityTypeKey: input.facilityTypeKey,
            specialtyKeys: input.specialtyKeys,
            moduleFlags: Object.fromEntries(input.moduleKeys.map((k) => [k, true])),
            salesTrialId: input.trialId,
          },
        },
      });
      const platformTenant = await client.platformTenant.create({
        data: {
          id: randomUUID(),
          tenantId: tenant.id,
          displayName: input.organizationName,
          region: 'GLOBAL',
          plan: 'LITE',
          status: 'PROVISIONING',
          provisionedBy: input.claims.sub,
        },
      });
      return { platformTenantId: platformTenant.id, tenantId: tenant.id };
    });
  }

  /**
   * Establishes the Step 16 commercial configuration for a Trial and activates it so
   * the immutable snapshot exists for Step 18 EER. Idempotent per Trial id.
   */
  async establishCommercialConfig(input: {
    claims: JwtClaimsVO;
    trialId: string;
    platformTenantId: string;
    planVersionId: string;
    reason: string;
  }): Promise<string> {
    const existing = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscriptionCommercialConfig.findFirst({
        where: { platformTenantId: input.platformTenantId, isCurrent: true },
        select: { id: true, rowVersion: true, lifecycle: true, planVersionId: true },
      }),
    );

    let configId: string;
    let rowVersion: number;
    let lifecycle: string;
    let assignedPlanVersionId: string | null;

    if (existing) {
      configId = existing.id;
      rowVersion = existing.rowVersion;
      lifecycle = existing.lifecycle;
      assignedPlanVersionId = existing.planVersionId;
    } else {
      const created = await this.subscriptions.create(
        input.claims,
        { platformTenantId: input.platformTenantId, reasonCode: 'SALES_TRIAL' },
        `trial-create-${input.trialId}`,
        { provisioningAuthority: true },
      );
      configId = created.id;
      rowVersion = created.rowVersion;
      lifecycle = created.lifecycle;
      assignedPlanVersionId = created.planVersionId;
    }

    if (isSalesTrialsFailureInjectionActive('after_commercial_configuration')) {
      throw new SalesTrialError('injected_failure', 'Injected after commercial configuration', 500);
    }

    if (lifecycle === 'DRAFT' && assignedPlanVersionId !== input.planVersionId) {
      const assigned = await this.subscriptions.assignPlanVersion(
        input.claims,
        configId,
        { expectedRowVersion: rowVersion, planVersionId: input.planVersionId },
        `trial-plan-${input.trialId}`,
        { provisioningAuthority: true },
      );
      rowVersion = assigned.rowVersion;
      lifecycle = assigned.lifecycle;
    }

    if (lifecycle !== 'ACTIVE_COMMERCIAL') {
      const activated = await this.subscriptions.activate(
        input.claims,
        configId,
        { expectedRowVersion: rowVersion, reason: input.reason },
        `trial-activate-${input.trialId}`,
        { provisioningAuthority: true },
      );
      lifecycle = activated.lifecycle;
    }

    if (isSalesTrialsFailureInjectionActive('after_commercial_activation')) {
      throw new SalesTrialError('injected_failure', 'Injected after commercial activation', 500);
    }
    return configId;
  }

  /** Trial activation opens the PlatformTenant lifecycle and records the Trial window. */
  async activateTenantForTrial(input: {
    platformTenantId: string;
    tenantId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformTenant.update({
        where: { id: input.platformTenantId },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          trialEndsAt: input.expiresAt,
          rowVersion: { increment: 1 },
        },
      });
      await client.tenant.update({
        where: { id: input.tenantId },
        data: { status: 'ACTIVE', lifecycleStatus: 'TRIAL', trialEndsAt: input.expiresAt },
      });
    });
    this.invalidateEer(input.tenantId);
  }

  /**
   * Step 19 deny handoff for expiry: PlatformTenant → SUSPENDED so Step 18 EER denies
   * on every resolve (warmed cache keys cannot preserve allow).
   */
  async suspendTenantForExpiry(input: {
    platformTenantId: string;
    reason: string;
  }): Promise<{ tenantId: string | null; suspended: boolean }> {
    const pt = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({
        where: { id: input.platformTenantId },
        select: { id: true, tenantId: true, status: true },
      }),
    );
    if (!pt) return { tenantId: null, suspended: false };
    if (pt.status === 'ARCHIVED') return { tenantId: pt.tenantId, suspended: false };
    if (pt.status === 'SUSPENDED') {
      this.invalidateEer(pt.tenantId);
      return { tenantId: pt.tenantId, suspended: true };
    }
    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformTenant.update({
        where: { id: pt.id },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspensionReason: input.reason.slice(0, 500),
          rowVersion: { increment: 1 },
        },
      });
      await client.tenant.update({
        where: { id: pt.tenantId },
        data: { status: 'SUSPENDED', lifecycleStatus: 'SUSPENDED' },
      });
    });
    this.invalidateEer(pt.tenantId);
    return { tenantId: pt.tenantId, suspended: true };
  }

  /** Conversion handoff: paid ACTIVE lifecycle with the Trial window cleared. */
  async activateTenantForPaid(input: { platformTenantId: string }): Promise<string | null> {
    const pt = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({
        where: { id: input.platformTenantId },
        select: { id: true, tenantId: true },
      }),
    );
    if (!pt) return null;
    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformTenant.update({
        where: { id: pt.id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          suspendedAt: null,
          suspensionReason: null,
          trialEndsAt: null,
          rowVersion: { increment: 1 },
        },
      });
      await client.tenant.update({
        where: { id: pt.tenantId },
        data: { status: 'ACTIVE', lifecycleStatus: 'ACTIVE', trialEndsAt: null },
      });
    });
    this.invalidateEer(pt.tenantId);
    return pt.tenantId;
  }

  /**
   * Supersede the current Trial commercial config and activate a paid successor
   * carrying the target published paid Plan Version.
   */
  async migrateCommercialToPaid(input: {
    claims: JwtClaimsVO;
    trialId: string;
    platformTenantId: string;
    targetPlanVersionId: string;
    reason: string;
  }): Promise<string> {
    const current = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscriptionCommercialConfig.findFirst({
        where: { platformTenantId: input.platformTenantId, isCurrent: true },
        select: { id: true, rowVersion: true, lifecycle: true, planVersionId: true },
      }),
    );
    if (!current) {
      throw new SalesTrialError(
        'commercial_config_missing',
        'Trial commercial configuration is missing; conversion cannot update the paid path.',
        409,
      );
    }

    // Already migrated (replay): the current config already carries the paid version.
    if (current.lifecycle === 'ACTIVE_COMMERCIAL' && current.planVersionId === input.targetPlanVersionId) {
      return current.id;
    }

    let successorId: string;
    let successorRowVersion: number;
    let successorLifecycle: string;
    let successorPlanVersionId: string | null;

    if (current.lifecycle === 'DRAFT') {
      successorId = current.id;
      successorRowVersion = current.rowVersion;
      successorLifecycle = current.lifecycle;
      successorPlanVersionId = current.planVersionId;
    } else {
      const successor = await this.subscriptions.supersede(
        input.claims,
        current.id,
        { expectedRowVersion: current.rowVersion, reason: input.reason },
        `trial-convert-supersede-${input.trialId}`,
        { provisioningAuthority: true },
      );
      successorId = successor.id;
      successorRowVersion = successor.rowVersion;
      successorLifecycle = successor.lifecycle;
      successorPlanVersionId = successor.planVersionId;
    }

    if (successorPlanVersionId !== input.targetPlanVersionId) {
      const assigned = await this.subscriptions.assignPlanVersion(
        input.claims,
        successorId,
        {
          expectedRowVersion: successorRowVersion,
          planVersionId: input.targetPlanVersionId,
        },
        `trial-convert-plan-${input.trialId}`,
        { provisioningAuthority: true },
      );
      successorRowVersion = assigned.rowVersion;
      successorLifecycle = assigned.lifecycle;
    }

    if (isSalesTrialsFailureInjectionActive('conversion_commercial_update')) {
      throw new SalesTrialError('injected_failure', 'Injected conversion commercial update', 500);
    }

    if (successorLifecycle !== 'ACTIVE_COMMERCIAL') {
      await this.subscriptions.activate(
        input.claims,
        successorId,
        { expectedRowVersion: successorRowVersion, reason: input.reason },
        `trial-convert-activate-${input.trialId}`,
        { provisioningAuthority: true },
      );
    }
    return successorId;
  }

  invalidateEer(tenantId: string | null | undefined): void {
    if (!tenantId || !this.eer) return;
    // Model B: exact selector + NODE_ENV===test only. Throws (does not swallow) so
    // callers cannot treat a failed refresh as authoritative success.
    if (isSalesTrialsFailureInjectionActive('eer_invalidation')) {
      throw new SalesTrialError(
        'injected_failure',
        'Injected EER invalidation failure',
        500,
      );
    }
    try {
      this.eer.invalidateTenant(tenantId);
    } catch (err) {
      this.logger.warn(`EER invalidation skipped: ${(err as Error)?.message}`);
    }
  }
}
