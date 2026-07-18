import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { UNLIMITED } from '../../domain/config/plan-limits.config';
import {
  USAGE_CRITICAL_THRESHOLD,
  USAGE_WARNING_THRESHOLD,
} from '../../domain/config/licensing.config';
import { LicensingEngineService } from './licensing-engine.service';
import {
  CommunicationChannel,
  CommunicationLimitExceededException,
  CommunicationLimitPolicy,
} from '../../domain/exceptions/communication-limit-exceeded.exception';
import { LicensingAuditService } from './licensing-audit.service';

export interface CommunicationQuotaSnapshot {
  channel: CommunicationChannel;
  current: number;
  limit: number;
  percentUsed: number;
  warning: boolean;
  critical: boolean;
  unlimited: boolean;
}

function currentUsageMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function channelLimitKey(channel: CommunicationChannel): keyof import('../../domain/config/plan-limits.config').PlanLimits {
  switch (channel) {
    case 'EMAIL':
      return 'maxEmailPerMonth';
    case 'SMS':
      return 'maxSmsPerMonth';
    case 'WHATSAPP':
      return 'maxWhatsappPerMonth';
    case 'PUSH':
      return 'maxPushPerMonth';
    default:
      return 'maxEmailPerMonth';
  }
}

/**
 * Enforces licensed communication quotas at dispatch time with idempotent ledger commits.
 */
@Injectable()
export class CommunicationDispatchService {
  private readonly logger = new Logger(CommunicationDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingEngineService,
    private readonly audit: LicensingAuditService,
  ) {}

  async getQuotaSnapshot(tenantId: string, channel: CommunicationChannel): Promise<CommunicationQuotaSnapshot> {
    const license = await this.licensing.resolveLicense(tenantId);
    const limitKey = channelLimitKey(channel);
    const limit = license.effectiveLimits[limitKey] as number;
    const current = await this.countCommittedUsage(tenantId, channel);
    const unlimited = limit === UNLIMITED;
    const percentUsed = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((current / limit) * 100));

    return {
      channel,
      current,
      limit,
      percentUsed,
      warning: !unlimited && percentUsed >= USAGE_WARNING_THRESHOLD && percentUsed < USAGE_CRITICAL_THRESHOLD,
      critical: !unlimited && percentUsed >= USAGE_CRITICAL_THRESHOLD,
      unlimited,
    };
  }

  /**
   * Returns true when notification was already committed (idempotent retry).
   */
  async isAlreadyCommitted(notificationId: string): Promise<boolean> {
    const row = await this.prisma.communicationDispatchLedger.findUnique({
      where: { notificationId },
      select: { id: true },
    });
    return row != null;
  }

  /**
   * Assert dispatch is allowed. Does not increment usage.
   */
  async assertCanDispatch(
    tenantId: string,
    channel: CommunicationChannel,
    notificationId: string,
  ): Promise<void> {
    if (channel === 'IN_APP') return;

    if (await this.isAlreadyCommitted(notificationId)) {
      return;
    }

    const license = await this.licensing.resolveLicense(tenantId);
    const policy = this.resolvePolicy(license.status, license.readOnly);
    if (policy === 'read_only' || policy === 'grace') {
      await this.audit.recordLicenseEvent({
        tenantId,
        eventType: 'communication.denied',
        decision: 'denied',
        reason: `Dispatch blocked during ${policy} for ${channel}`,
        usageLimit: channel,
        source: 'communication.dispatch',
        metadata: { channel, notificationId, policy },
      });
      throw new CommunicationLimitExceededException({
        channel,
        limit: 0,
        current: 0,
        plan: license.effectiveLimits.planName,
        policy,
        notificationId,
      });
    }

    const snapshot = await this.getQuotaSnapshot(tenantId, channel);
    if (snapshot.unlimited) return;

    if (snapshot.limit === 0) {
      await this.recordDenial(tenantId, channel, notificationId, snapshot, license.effectiveLimits.planName, 'hard');
      throw new CommunicationLimitExceededException({
        channel,
        limit: 0,
        current: snapshot.current,
        plan: license.effectiveLimits.planName,
        policy: 'hard',
        notificationId,
      });
    }

    if (snapshot.current >= snapshot.limit) {
      await this.recordDenial(tenantId, channel, notificationId, snapshot, license.effectiveLimits.planName, 'hard');
      throw new CommunicationLimitExceededException({
        channel,
        limit: snapshot.limit,
        current: snapshot.current,
        plan: license.effectiveLimits.planName,
        policy: 'hard',
        notificationId,
      });
    }

    if (snapshot.warning) {
      this.logger.warn(
        `Communication warning tenant=${tenantId} channel=${channel} usage=${snapshot.current}/${snapshot.limit}`,
      );
      await this.audit.recordLicenseEvent({
        tenantId,
        eventType: 'communication.warning',
        decision: 'warning',
        reason: `Approaching ${channel} quota (${snapshot.percentUsed}%)`,
        usageLimit: channel,
        source: 'communication.dispatch',
        metadata: { notificationId, ...snapshot },
      });
    }
  }

  /**
   * Atomically reserve usage slot after successful provider dispatch.
   */
  async commitDispatch(
    tenantId: string,
    channel: CommunicationChannel,
    notificationId: string,
  ): Promise<void> {
    if (channel === 'IN_APP') return;

    if (await this.isAlreadyCommitted(notificationId)) {
      return;
    }

    const usageMonth = currentUsageMonth();
    try {
      await this.prisma.communicationDispatchLedger.create({
        data: {
          tenantId,
          notificationId,
          channel,
          usageMonth,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Unique constraint')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Release reserved slot when provider dispatch fails after reservation.
   */
  async releaseReservation(notificationId: string): Promise<void> {
    await this.prisma.communicationDispatchLedger.deleteMany({
      where: { notificationId },
    });
  }

  private async countCommittedUsage(tenantId: string, channel: CommunicationChannel): Promise<number> {
    return this.prisma.communicationDispatchLedger.count({
      where: {
        tenantId,
        channel,
        usageMonth: currentUsageMonth(),
      },
    });
  }

  private resolvePolicy(
    status: string,
    readOnly: boolean,
  ): CommunicationLimitPolicy {
    if (readOnly || status === 'grace') return 'grace';
    if (status === 'suspended' || status === 'expired' || status === 'cancelled') return 'read_only';
    return 'hard';
  }

  private async recordDenial(
    tenantId: string,
    channel: CommunicationChannel,
    notificationId: string,
    snapshot: CommunicationQuotaSnapshot,
    plan: string,
    policy: CommunicationLimitPolicy,
  ): Promise<void> {
    await this.audit.recordLicenseEvent({
      tenantId,
      eventType: 'communication.denied',
      decision: 'denied',
      reason: `${channel} quota exceeded (${snapshot.current}/${snapshot.limit})`,
      usageLimit: channel,
      source: 'communication.dispatch',
      metadata: { notificationId, plan, policy, ...snapshot },
    });
  }
}
