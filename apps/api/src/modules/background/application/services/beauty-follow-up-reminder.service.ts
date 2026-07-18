import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';

const PRODUCER_MODULE_ID = 'background.beauty-follow-up';

@Injectable()
export class BeautyFollowUpReminderService {
  private readonly logger = new Logger(BeautyFollowUpReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanAndNotify(now = new Date()): Promise<{ remindersSent: number }> {
    let remindersSent = 0;
    const records = await this.prisma.beautyRecord.findMany({
      select: {
        tenantId: true,
        patientId: true,
        bodyMapState: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    for (const row of records) {
      const allowed = await this.licensing.allowWorkerExecution({
        tenantId: row.tenantId,
        workerName: 'beauty-follow-up',
        moduleId: 'beauty',
        source: 'worker.beauty_follow_up',
      });
      if (!allowed) continue;

      const sessions = (row.bodyMapState as { sessions?: { id: string; status: string; followUpAt?: string; type?: string }[] })?.sessions ?? [];
      for (const session of sessions) {
        if (session.status !== 'follow_up_due' || !session.followUpAt) continue;
        if (new Date(session.followUpAt).getTime() > now.getTime()) continue;

        const existing = await this.prisma.notification.findFirst({
          where: {
            tenantId: row.tenantId,
            title: { contains: session.id },
          },
        });
        if (existing) continue;

        const portalAccount = await this.prisma.portalAccount.findFirst({
          where: { tenantId: row.tenantId, patientId: row.patientId, status: 'ACTIVE' },
          select: { userId: true },
        });
        if (!portalAccount?.userId) continue;

        const patientName = `${row.patient.firstName} ${row.patient.lastName}`.trim();
        await this.producer.produceInApp({
          tenantId: row.tenantId,
          branchId: null,
          recipientId: portalAccount.userId,
          title: `Beauty follow-up due [${session.id}]`,
          body: `${patientName}: ${session.type ?? 'treatment'} follow-up is due.`,
          priority: 'medium',
          idempotencyKey: `beauty-follow-up:${session.id}:${portalAccount.userId}`,
          producerModuleId: PRODUCER_MODULE_ID,
        });
        remindersSent++;
      }
    }

    if (remindersSent > 0) {
      this.logger.log(`Queued ${remindersSent} beauty follow-up reminder(s)`);
    }
    return { remindersSent };
  }
}
