import { Injectable } from '@nestjs/common';
import { comparePlanTiers } from '../../domain/config/licensing.config';
import { subscriptionPlanToUiPlan, UiSubscriptionPlan } from '../../domain/config/plan-name.mapper';
import { LicensingAuditService } from './licensing-audit.service';

export interface PlanChangeAuditParams {
  tenantId: string;
  actorId?: string;
  previousPlan: string;
  newPlan: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  source: string;
  correlationId?: string;
  requestId?: string;
}

@Injectable()
export class LicensingCommercialAuditService {
  constructor(private readonly audit: LicensingAuditService) {}

  async recordPlanChange(params: PlanChangeAuditParams): Promise<void> {
    const fromUi = this.toUiPlan(params.previousPlan);
    const toUi = this.toUiPlan(params.newPlan);
    const direction = comparePlanTiers(fromUi, toUi);
    const eventType =
      direction === 'upgrade'
        ? 'plan.upgrade'
        : direction === 'downgrade'
          ? 'plan.downgrade'
          : 'plan.activated';

    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType,
      previousPlan: params.previousPlan,
      newPlan: params.newPlan,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      decision: 'allowed',
      reason: params.reason ?? `Plan changed (${params.previousPlan} → ${params.newPlan})`,
      source: params.source,
      correlationId: params.correlationId,
      requestId: params.requestId,
    });
  }

  async recordTrialStart(params: {
    tenantId: string;
    actorId?: string;
    plan: string;
    days: number;
    source: string;
    correlationId?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType: 'trial.started',
      newPlan: params.plan,
      newStatus: 'trial',
      decision: 'allowed',
      reason: `Trial started for ${params.days} day(s) on plan ${params.plan}`,
      source: params.source,
      correlationId: params.correlationId,
      metadata: { days: params.days },
    });
  }

  async recordSuspension(params: {
    tenantId: string;
    actorId?: string;
    previousStatus?: string;
    reason: string;
    source: string;
    correlationId?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType: 'suspension',
      previousStatus: params.previousStatus ?? 'active',
      newStatus: 'suspended',
      decision: 'allowed',
      reason: params.reason,
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordReactivation(params: {
    tenantId: string;
    actorId?: string;
    previousStatus?: string;
    source: string;
    correlationId?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType: 'reactivation',
      previousStatus: params.previousStatus ?? 'suspended',
      newStatus: 'active',
      decision: 'allowed',
      reason: 'Tenant subscription reactivated',
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordCancellation(params: {
    tenantId: string;
    actorId?: string;
    previousStatus?: string;
    reason?: string;
    source: string;
    correlationId?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType: 'cancellation',
      previousStatus: params.previousStatus ?? 'active',
      newStatus: 'cancelled',
      decision: 'allowed',
      reason: params.reason ?? 'Subscription cancelled',
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordPlanRenewal(params: {
    tenantId: string;
    actorId?: string;
    plan: string;
    source: string;
    correlationId?: string;
    reason?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType: 'plan.renewal',
      previousPlan: params.plan,
      newPlan: params.plan,
      decision: 'allowed',
      reason: params.reason ?? `Subscription renewed on plan ${params.plan}`,
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordTrialEnd(params: {
    tenantId: string;
    previousPlan?: string;
    source: string;
    correlationId?: string;
    reason?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      eventType: 'trial.ended',
      previousPlan: params.previousPlan,
      previousStatus: 'trial',
      newStatus: 'active',
      decision: 'allowed',
      reason: params.reason ?? 'Trial period ended',
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordGraceStart(params: {
    tenantId: string;
    source: string;
    correlationId?: string;
    reason?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      eventType: 'grace.started',
      previousStatus: 'active',
      newStatus: 'grace',
      decision: 'warning',
      reason: params.reason ?? 'Subscription entered grace period',
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordGraceEnd(params: {
    tenantId: string;
    source: string;
    correlationId?: string;
    reason?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      eventType: 'grace.ended',
      previousStatus: 'grace',
      newStatus: 'expired',
      decision: 'denied',
      reason: params.reason ?? 'Grace period ended; subscription expired',
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordFeatureEnable(params: {
    tenantId: string;
    actorId?: string;
    featureId: string;
    plan: string;
    source: string;
    correlationId?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType: 'feature.enabled',
      featureId: params.featureId,
      newPlan: params.plan,
      decision: 'allowed',
      reason: `Feature "${params.featureId}" enabled`,
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  async recordFeatureDisable(params: {
    tenantId: string;
    actorId?: string;
    featureId: string;
    plan: string;
    source: string;
    correlationId?: string;
  }): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventType: 'feature.disabled',
      featureId: params.featureId,
      previousPlan: params.plan,
      decision: 'allowed',
      reason: `Feature "${params.featureId}" disabled`,
      source: params.source,
      correlationId: params.correlationId,
    });
  }

  /** Records lifecycle status transitions detected by the licensing engine. */
  async recordLicenseStatusTransition(params: {
    tenantId: string;
    previousStatus: string;
    newStatus: string;
    source: string;
    uiPlan?: string;
  }): Promise<void> {
    const { previousStatus, newStatus } = params;
    if (previousStatus === newStatus) return;

    if (newStatus === 'trial' && previousStatus !== 'trial') {
      return;
    }
    if (previousStatus === 'trial' && newStatus !== 'trial') {
      await this.recordTrialEnd({
        tenantId: params.tenantId,
        previousPlan: params.uiPlan,
        source: params.source,
        reason: `Trial ended (now ${newStatus})`,
      });
    }
    if (newStatus === 'grace' && previousStatus !== 'grace') {
      await this.recordGraceStart({ tenantId: params.tenantId, source: params.source });
    }
    if (previousStatus === 'grace' && newStatus === 'expired') {
      await this.recordGraceEnd({ tenantId: params.tenantId, source: params.source });
    }
  }

  private toUiPlan(plan: string): UiSubscriptionPlan {
    const normalized = plan.trim().toLowerCase();
    if (normalized === 'starter' || normalized === 'professional' || normalized === 'business' || normalized === 'enterprise') {
      return normalized;
    }
    return subscriptionPlanToUiPlan(normalized as 'lite' | 'pro' | 'enterprise');
  }
}
