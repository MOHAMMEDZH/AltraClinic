import { Injectable, Logger } from '@nestjs/common';
import { parseExpression } from 'cron-parser';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { JobDeduplicationService } from '../../../background/application/services/job-deduplication.service';
import { NotificationAutomationExecutorService } from '../../../notifications/application/services/notification-automation.executor';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';

export interface NotificationAutomationScheduleScanResult {
  rulesEvaluated: number;
  rulesTriggered: number;
  notificationsSent: number;
  duplicatesSkipped: number;
}

@Injectable()
export class NotificationAutomationSchedulerService {
  private readonly logger = new Logger(NotificationAutomationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: NotificationAutomationExecutorService,
    private readonly dedup: JobDeduplicationService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanDueScheduledRules(now = new Date()): Promise<NotificationAutomationScheduleScanResult> {
    const result: NotificationAutomationScheduleScanResult = {
      rulesEvaluated: 0,
      rulesTriggered: 0,
      notificationsSent: 0,
      duplicatesSkipped: 0,
    };

    const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
    const rules = await this.prisma.notificationAutomationRule.findMany({
      where: { isActive: true, schedule: { not: null } },
      include: { template: true },
    });

    for (const rule of rules) {
      result.rulesEvaluated++;
      const schedule = rule.schedule?.trim();
      if (!schedule || !this.isCronDueInWindow(schedule, windowStart, now)) continue;

      const bucket = `${now.toISOString().slice(0, 13)}`;
      const isDup = await this.dedup.isDuplicate('notification-automation-schedule', rule.id, bucket);
      if (isDup) {
        result.duplicatesSkipped++;
        continue;
      }

      try {
        const allowed = await this.licensing.allowWorkerExecution({
          tenantId: rule.tenantId,
          workerName: 'notification-automation',
          moduleId: 'notifications',
          featureId: 'integrations',
          source: 'worker.notification_automation',
        });
        if (!allowed) continue;

        const sent = await this.executor.executeRule(rule, {
          tenantId: rule.tenantId,
          branchId: null,
        });
        result.rulesTriggered++;
        result.notificationsSent += sent;
      } catch (err) {
        this.logger.warn(`Failed scheduled automation rule ${rule.id}: ${String(err)}`);
      }
    }

    return result;
  }

  private isCronDueInWindow(schedule: string, windowStart: Date, windowEnd: Date): boolean {
    try {
      const interval = parseExpression(schedule, { currentDate: windowEnd, utc: true });
      const prev = interval.prev().toDate();
      return prev >= windowStart && prev <= windowEnd;
    } catch {
      return false;
    }
  }
}
