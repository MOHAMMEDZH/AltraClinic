import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';
import {
  APPOINTMENT_REMINDER_ELIGIBLE_STATUSES,
  APPOINTMENT_REMINDER_WINDOWS,
  AppointmentReminderType,
} from '../../config/appointment-reminder.config';

export interface AppointmentReminderScanResult {
  remindersSent: number;
  duplicatesSkipped: number;
}

const PRODUCER_MODULE_ID = 'background.appointment-reminders';

@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanAndSendReminders(now = new Date()): Promise<AppointmentReminderScanResult> {
    const result: AppointmentReminderScanResult = { remindersSent: 0, duplicatesSkipped: 0 };

    for (const window of APPOINTMENT_REMINDER_WINDOWS) {
      const rangeStart = new Date(now.getTime() + window.minMs);
      const rangeEnd = new Date(now.getTime() + window.maxMs);

      const appointments = await this.prisma.appointment.findMany({
        where: {
          deletedAt: null,
          status: { in: [...APPOINTMENT_REMINDER_ELIGIBLE_STATUSES] },
          scheduledStart: { gte: rangeStart, lte: rangeEnd },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      });

      for (const appt of appointments) {
        const allowed = await this.licensing.allowWorkerExecution({
          tenantId: appt.tenantId,
          workerName: 'appointment-reminders',
          moduleId: 'scheduling',
          source: 'worker.appointment_reminders',
        });
        if (!allowed) continue;

        const existing = await this.prisma.appointmentReminderLog.findUnique({
          where: {
            appointmentId_reminderType: {
              appointmentId: appt.id,
              reminderType: window.type,
            },
          },
        });
        if (existing) {
          result.duplicatesSkipped++;
          continue;
        }

        const portalAccount = await this.prisma.portalAccount.findFirst({
          where: { tenantId: appt.tenantId, patientId: appt.patientId, status: 'ACTIVE' },
          select: { userId: true },
        });
        const recipientId = portalAccount?.userId;
        if (!recipientId) {
          this.logger.debug(`Skipping reminder for appointment ${appt.id} — patient has no linked user`);
          continue;
        }

        await this.sendReminder(appt, window.type, recipientId);
        await this.prisma.appointmentReminderLog.create({
          data: {
            tenantId: appt.tenantId,
            appointmentId: appt.id,
            reminderType: window.type,
          },
        });
        result.remindersSent++;
      }
    }

    if (result.remindersSent > 0) {
      this.logger.log(`Queued ${result.remindersSent} appointment reminder(s)`);
    }

    return result;
  }

  private async sendReminder(
    appt: {
      id: string;
      tenantId: string;
      branchId: string | null;
      scheduledStart: Date;
      patient: { firstName: string; lastName: string };
    },
    reminderType: AppointmentReminderType,
    recipientId: string,
  ): Promise<void> {
    const when = appt.scheduledStart.toISOString().slice(0, 16).replace('T', ' ');
    const patientName = `${appt.patient.firstName} ${appt.patient.lastName}`.trim();
    const lead = reminderType === '24h' ? '24 hours' : '1 hour';
    const priority = reminderType === '1h' ? 'high' : 'medium';

    await this.producer.produceInApp({
      tenantId: appt.tenantId,
      branchId: appt.branchId,
      recipientId,
      title: `Appointment in ${lead}`,
      body: `Reminder: ${patientName} has an appointment on ${when}.`,
      priority,
      idempotencyKey: `appointment-reminder:${appt.id}:${reminderType}`,
      producerModuleId: PRODUCER_MODULE_ID,
    });
  }
}
