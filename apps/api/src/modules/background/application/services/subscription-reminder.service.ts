import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { JobDeduplicationService } from './job-deduplication.service';
import {
  SUBSCRIPTION_REMINDER_DAYS,
  SUBSCRIPTION_REMINDER_TYPES,
  SubscriptionReminderType,
} from '../../config/subscription-reminder.config';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';
import { matchesReminderDay } from '../../domain/date.utils';

export interface SubscriptionReminderScanResult {
  remindersSent: number;
  duplicatesSkipped: number;
}

interface ReminderTarget {
  tenantId: string;
  branchId: string | null;
  entityId: string;
  reminderType: SubscriptionReminderType;
  endDate: Date;
  label: string;
}

const PRODUCER_MODULE_ID = 'background.subscription-reminders';

@Injectable()
export class SubscriptionReminderService {
  private readonly logger = new Logger(SubscriptionReminderService.name);
  private readonly adminRoles = ['OWNER', 'GENERAL_MANAGER'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
    private readonly dedup: JobDeduplicationService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanAndSendReminders(now = new Date()): Promise<SubscriptionReminderScanResult> {
    const result: SubscriptionReminderScanResult = { remindersSent: 0, duplicatesSkipped: 0 };
    const targets = await this.collectTargets(now);

    for (const target of targets) {
      for (const days of SUBSCRIPTION_REMINDER_DAYS) {
        if (!matchesReminderDay(target.endDate, days, now)) continue;

        const bucket = `${days}d`;
        const isDup = await this.dedup.isDuplicate(
          `subscription-reminder:${target.reminderType}`,
          target.entityId,
          bucket,
        );
        if (isDup) {
          result.duplicatesSkipped++;
          continue;
        }

        const recipients = await this.resolveRecipients(target.tenantId);
        if (recipients.length === 0) {
          this.logger.warn(`No admin recipients for tenant ${target.tenantId} — skipping reminder`);
          continue;
        }

        const allowed = await this.licensing.allowWorkerExecution({
          tenantId: target.tenantId,
          workerName: 'subscription-reminder',
          moduleId: 'notifications',
          allowReadOnly: true,
          source: 'worker.subscription-reminders',
        });
        if (!allowed) continue;

        for (const recipientId of recipients) {
          await this.sendReminder(target, days, recipientId, bucket);
          result.remindersSent++;
        }
      }
    }

    return result;
  }

  private async collectTargets(now: Date): Promise<ReminderTarget[]> {
    const targets: ReminderTarget[] = [];

    const platformSubs = await this.prisma.platformSubscription.findMany({
      where: { status: 'ACTIVE', endDate: { not: null } },
      include: { platformTenant: true },
    });

    for (const sub of platformSubs) {
      if (!sub.endDate) continue;
      targets.push({
        tenantId: sub.platformTenant.tenantId,
        branchId: null,
        entityId: sub.id,
        reminderType: SUBSCRIPTION_REMINDER_TYPES.PLATFORM_SUBSCRIPTION,
        endDate: sub.endDate,
        label: `Platform subscription (${sub.plan})`,
      });
    }

    const platformTenants = await this.prisma.platformTenant.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ contractEndDate: { not: null } }, { trialEndsAt: { not: null } }],
      },
    });

    for (const pt of platformTenants) {
      if (pt.contractEndDate) {
        targets.push({
          tenantId: pt.tenantId,
          branchId: null,
          entityId: pt.id,
          reminderType: SUBSCRIPTION_REMINDER_TYPES.PLATFORM_CONTRACT,
          endDate: pt.contractEndDate,
          label: 'Platform contract',
        });
      }
      if (pt.trialEndsAt) {
        targets.push({
          tenantId: pt.tenantId,
          branchId: null,
          entityId: `${pt.id}:trial`,
          reminderType: SUBSCRIPTION_REMINDER_TYPES.PLATFORM_TRIAL,
          endDate: pt.trialEndsAt,
          label: 'Platform trial',
        });
      }
    }

    const clinicSubs = await this.prisma.clinicSubscription.findMany({
      where: { status: 'ACTIVE', endDate: { not: null } },
    });

    for (const sub of clinicSubs) {
      if (!sub.endDate) continue;
      targets.push({
        tenantId: sub.tenantId,
        branchId: sub.branchId,
        entityId: sub.id,
        reminderType: SUBSCRIPTION_REMINDER_TYPES.CLINIC_SUBSCRIPTION,
        endDate: sub.endDate,
        label: `Patient package (${sub.plan})`,
      });
    }

    void now;
    return targets;
  }

  private async resolveRecipients(tenantId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        roles: { some: { role: { in: [...this.adminRoles] } } },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async sendReminder(
    target: ReminderTarget,
    daysRemaining: number,
    recipientId: string,
    bucket: string,
  ): Promise<void> {
    const endStr = target.endDate.toISOString().slice(0, 10);
    const priority = daysRemaining <= 3 ? 'critical' : daysRemaining <= 7 ? 'high' : 'medium';

    await this.producer.produceInApp({
      tenantId: target.tenantId,
      branchId: target.branchId,
      recipientId,
      title: `Subscription expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      body: `${target.label} expires on ${endStr}. Please renew to avoid service interruption.`,
      priority,
      idempotencyKey: `subscription-reminder:${target.reminderType}:${target.entityId}:${bucket}:${recipientId}`,
      producerModuleId: PRODUCER_MODULE_ID,
      metadata: { system: true },
    });
  }
}
