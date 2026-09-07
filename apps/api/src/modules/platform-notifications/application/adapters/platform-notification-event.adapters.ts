import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PlatformNotificationDispatchService } from '../platform-notification-dispatch.service';
import type { PlatformDispatchResult } from '../../domain/platform-notifications.types';
import { isPlatformNotificationFailureInjectionActive } from '../../platform-notifications.constants';
import { PlatformNotificationValidationError } from '../../domain/platform-notifications.errors';

/**
 * Flexible Step 27 — event adapters. Each method maps an authoritative SoR payload
 * into a dispatch request. Never mutates business Sources of Record.
 */
@Injectable()
export class PlatformNotificationEventAdapters {
  constructor(
    private readonly dispatch: PlatformNotificationDispatchService,
    private readonly prisma: PrismaService,
  ) {}

  private guard(point: string) {
    if (isPlatformNotificationFailureInjectionActive(point)) {
      throw new PlatformNotificationValidationError(
        `Injected ${point} failure`,
        'injected_failure',
      );
    }
  }

  /** N01 */
  async invitationSent(input: {
    invitationId: string;
    platformUserId: string;
    recipientEmail: string;
    recipientDisplayName: string;
    inviterDisplayName: string;
    expiresAt: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('event_adapter');
    return this.dispatch.dispatch({
      eventKey: 'platform.invitation.sent',
      sourceType: 'platform_user_invitation',
      sourceId: input.invitationId,
      recipientKind: 'platform_user',
      recipientId: input.platformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        recipientDisplayName: input.recipientDisplayName,
        inviterDisplayName: input.inviterDisplayName,
        expiresAt: input.expiresAt,
      },
    });
  }

  /** N02 */
  async mfaSecurityAlert(input: {
    alertId: string;
    platformUserId: string;
    recipientEmail: string;
    recipientDisplayName: string;
    alertSummary: string;
    occurredAt: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('event_adapter');
    return this.dispatch.dispatch({
      eventKey: 'platform.mfa.security_alert',
      sourceType: 'platform_mfa_security',
      sourceId: input.alertId,
      recipientKind: 'platform_user',
      recipientId: input.platformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        recipientDisplayName: input.recipientDisplayName,
        alertSummary: input.alertSummary,
        occurredAt: input.occurredAt,
      },
    });
  }

  /** N03 */
  async lifecycleTransition(input: {
    platformTenantId: string;
    organizationName: string;
    fromState: string;
    toState: string;
    occurredAt: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('event_adapter');
    return this.dispatch.dispatch({
      eventKey: 'platform.tenant.lifecycle_transition',
      sourceType: 'platform_tenant_lifecycle',
      sourceId: `${input.platformTenantId}:${input.toState}:${input.occurredAt}`,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        fromState: input.fromState,
        toState: input.toState,
        occurredAt: input.occurredAt,
      },
    });
  }

  /** N04 / N05 — adapter-level obsolete suppress (belt) + worker send-time revalidation (suspenders). */
  async trialExpiry(input: {
    approaching: boolean;
    trialId: string;
    organizationName: string;
    expiryDate: string;
    planVersionId: string;
    windowKey: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('trial_source');
    const eventKey = input.approaching
      ? 'platform.trial.approaching_expiry'
      : 'platform.trial.expired';
    const dedupeKey = [
      eventKey,
      'platform_sales_trial',
      input.trialId,
      input.windowKey,
      input.recipientPlatformUserId,
      'email',
    ].join('|');

    const trial = await this.prisma.platformSalesTrial.findUnique({
      where: { id: input.trialId },
      select: { status: true },
    });
    if (
      trial &&
      (trial.status === 'CONVERTED' ||
        trial.status === 'CANCELLED' ||
        (input.approaching && trial.status === 'EXPIRED'))
    ) {
      return {
        accepted: true,
        suppressed: true,
        suppressReason: `trial_obsolete_${trial.status}`,
        dedupeKey,
      };
    }

    return this.dispatch.dispatch({
      eventKey,
      sourceType: 'platform_sales_trial',
      sourceId: input.trialId,
      windowKey: input.windowKey,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        expiryDate: input.expiryDate,
        planVersionId: input.planVersionId,
      },
    });
  }

  /** N06 / N07 / N24 */
  async subscriptionEvent(input: {
    kind: 'approaching' | 'expired' | 'material_change';
    configId: string;
    organizationName: string;
    expiryDate?: string;
    planVersionId?: string;
    changeSummary?: string;
    occurredAt?: string;
    windowKey: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('subscription_source');
    const eventKey =
      input.kind === 'approaching'
        ? 'platform.subscription.approaching_expiry'
        : input.kind === 'expired'
          ? 'platform.subscription.expired'
          : 'platform.subscription.material_change';
    return this.dispatch.dispatch({
      eventKey,
      sourceType: 'platform_subscription_commercial_config',
      sourceId: input.configId,
      windowKey: input.windowKey,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        expiryDate: input.expiryDate ?? null,
        planVersionId: input.planVersionId ?? null,
        changeSummary: input.changeSummary ?? null,
        occurredAt: input.occurredAt ?? null,
      },
    });
  }

  /** N08 / N09 */
  async planMigration(input: {
    completed: boolean;
    migrationId: string;
    organizationName: string;
    fromPlanVersionId: string;
    toPlanVersionId: string;
    at: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('subscription_source');
    return this.dispatch.dispatch({
      eventKey: input.completed
        ? 'platform.plan_version.migration_completed'
        : 'platform.plan_version.migration_scheduled',
      sourceType: 'platform_plan_migration',
      sourceId: input.migrationId,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        fromPlanVersionId: input.fromPlanVersionId,
        toPlanVersionId: input.toPlanVersionId,
        scheduledAt: input.completed ? null : input.at,
        completedAt: input.completed ? input.at : null,
      },
    });
  }

  /** N10 / N11 */
  async addOnExpiry(input: {
    approaching: boolean;
    assignmentId: string;
    organizationName: string;
    addOnLabel: string;
    addOnVersionId: string;
    expiryDate: string;
    windowKey: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('addon_expiry_source');
    return this.dispatch.dispatch({
      eventKey: input.approaching
        ? 'platform.addon.approaching_expiry'
        : 'platform.addon.expired',
      sourceType: 'platform_subscription_addon_assignment',
      sourceId: input.assignmentId,
      windowKey: input.windowKey,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        addOnLabel: input.addOnLabel,
        addOnVersionId: input.addOnVersionId,
        expiryDate: input.expiryDate,
      },
    });
  }

  /** N12 / N13 */
  async overrideExpiry(input: {
    approaching: boolean;
    overrideId: string;
    organizationName: string;
    overrideLabel: string;
    expiryDate: string;
    windowKey: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('override_expiry_source');
    return this.dispatch.dispatch({
      eventKey: input.approaching
        ? 'platform.override.approaching_expiry'
        : 'platform.override.expired',
      sourceType: 'platform_tenant_override',
      sourceId: input.overrideId,
      windowKey: input.windowKey,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        overrideLabel: input.overrideLabel,
        overrideId: input.overrideId,
        expiryDate: input.expiryDate,
      },
    });
  }

  /** N14–N16 — effective limit only */
  async limitAlert(input: {
    level: 'warning' | 'critical' | 'hard';
    evidenceId: string;
    organizationName: string;
    limitKey: string;
    effectiveLimit: string;
    currentUsage: string;
    thresholdPercent?: string;
    limitProvenance: string;
    windowKey: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('eer_limit_source');
    this.guard('usage_source');
    if (
      input.limitProvenance === 'UNLIMITED' &&
      (input.level === 'warning' || input.level === 'critical')
    ) {
      return {
        accepted: false,
        suppressed: true,
        suppressReason: 'unlimited_no_percent_threshold',
        dedupeKey: `suppress|${input.evidenceId}|${input.level}`,
      };
    }
    if (input.limitProvenance === 'UNCONFIGURED' || input.limitProvenance === 'MISSING') {
      return {
        accepted: false,
        suppressed: true,
        suppressReason: 'limit_unavailable_not_unlimited',
        dedupeKey: `suppress|${input.evidenceId}|${input.level}`,
      };
    }
    const eventKey =
      input.level === 'warning'
        ? 'platform.limit.warning_threshold'
        : input.level === 'critical'
          ? 'platform.limit.critical_threshold'
          : 'platform.limit.hard_denied';
    return this.dispatch.dispatch({
      eventKey,
      sourceType: 'platform_usage_limit_evidence',
      sourceId: input.evidenceId,
      windowKey: input.windowKey,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        limitKey: input.limitKey,
        effectiveLimit: input.effectiveLimit,
        currentUsage: input.currentUsage,
        thresholdPercent: input.thresholdPercent ?? null,
        limitProvenance: input.limitProvenance,
      },
    });
  }

  /** N17 */
  async compatibilityIssue(input: {
    resultId: string;
    organizationName: string;
    issueSummary: string;
    ruleReference: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('compatibility_source');
    return this.dispatch.dispatch({
      eventKey: 'platform.compatibility.issue',
      sourceType: 'catalog_compatibility_result',
      sourceId: input.resultId,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        issueSummary: input.issueSummary,
        ruleReference: input.ruleReference,
      },
    });
  }

  /** N18 / N19 */
  async provisioning(input: {
    recovered: boolean;
    operationId: string;
    organizationName: string;
    operationReference: string;
    failureClass?: string;
    at: string;
    recipientPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('provisioning_source');
    return this.dispatch.dispatch({
      eventKey: input.recovered
        ? 'platform.provisioning.recovered'
        : 'platform.provisioning.failure',
      sourceType: 'tenant_provisioning_operation',
      sourceId: input.operationId,
      recipientKind: 'platform_user',
      recipientId: input.recipientPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        organizationName: input.organizationName,
        operationReference: input.operationReference,
        failureClass: input.failureClass ?? null,
        occurredAt: input.recovered ? null : input.at,
        recoveredAt: input.recovered ? input.at : null,
      },
    });
  }

  /** N20 */
  async leadNextActionReminder(input: {
    leadId: string;
    leadReference: string;
    organizationName: string;
    nextActionDate: string;
    nextActionType: string;
    windowKey: string;
    ownerPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('lead_reminder_source');
    return this.dispatch.dispatch({
      eventKey: 'platform.sales.lead_next_action_reminder',
      sourceType: 'platform_sales_lead',
      sourceId: input.leadId,
      windowKey: input.windowKey,
      recipientKind: 'platform_user',
      recipientId: input.ownerPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        leadReference: input.leadReference,
        organizationName: input.organizationName,
        nextActionDate: input.nextActionDate,
        nextActionType: input.nextActionType,
      },
    });
  }

  /** N21 */
  async demoReminder(input: {
    leadId: string;
    leadReference: string;
    organizationName: string;
    demoScheduledAt: string;
    windowKey: string;
    ownerPlatformUserId: string;
    recipientEmail: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('lead_reminder_source');
    return this.dispatch.dispatch({
      eventKey: 'platform.sales.demo_reminder',
      sourceType: 'platform_sales_lead_demo',
      sourceId: input.leadId,
      windowKey: input.windowKey,
      recipientKind: 'platform_user',
      recipientId: input.ownerPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        leadReference: input.leadReference,
        organizationName: input.organizationName,
        demoScheduledAt: input.demoScheduledAt,
      },
    });
  }

  /** N22 / N23 */
  async managerAlert(input: {
    ops: boolean;
    alertId: string;
    managerPlatformUserId: string;
    recipientEmail: string;
    managerDisplayName: string;
    staleCount?: number;
    periodLabel?: string;
    alertSummary?: string;
    operationReference?: string;
  }): Promise<PlatformDispatchResult> {
    this.guard('manager_recipient');
    return this.dispatch.dispatch({
      eventKey: input.ops
        ? 'platform.sales.manager_ops_alert'
        : 'platform.sales.manager_stale_alert',
      sourceType: input.ops ? 'platform_ops_alert' : 'platform_sales_stale',
      sourceId: input.alertId,
      recipientKind: 'platform_user',
      recipientId: input.managerPlatformUserId,
      recipientEmail: input.recipientEmail,
      variables: {
        managerDisplayName: input.managerDisplayName,
        staleCount: input.staleCount ?? null,
        periodLabel: input.periodLabel ?? null,
        alertSummary: input.alertSummary ?? null,
        operationReference: input.operationReference ?? null,
      },
    });
  }
}
