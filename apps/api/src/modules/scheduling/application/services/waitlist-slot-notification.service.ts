import { Injectable, Logger } from '@nestjs/common';
import { WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { AppointmentCancelledEvent } from '../../domain/events/appointment-cancelled.event';

const PRODUCER_MODULE_ID = 'scheduling.waitlist-slot-notification';

@Injectable()
export class WaitlistSlotNotificationService {
  private readonly logger = new Logger(WaitlistSlotNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
  ) {}

  async notifyForCancelledAppointment(event: AppointmentCancelledEvent): Promise<number> {
    const slotStart = new Date(event.start);
    const slotEnd = new Date(event.end);
    const durationMs = slotEnd.getTime() - slotStart.getTime();

    const entries = await this.prisma.appointmentWaitlist.findMany({
      where: {
        tenantId: event.tenantId,
        status: WaitlistStatus.OPEN,
        deletedAt: null,
        ...(event.branchId ? { OR: [{ branchId: event.branchId }, { branchId: null }] } : {}),
        ...(event.providerId
          ? { OR: [{ providerId: event.providerId }, { providerId: null }] }
          : {}),
      },
      take: 20,
      orderBy: { createdAt: 'asc' },
    });

    let sent = 0;
    for (const entry of entries) {
      if (entry.preferredDate) {
        const prefDay = new Date(entry.preferredDate).toISOString().slice(0, 10);
        const slotDay = slotStart.toISOString().slice(0, 10);
        if (prefDay !== slotDay) continue;
      }

      const requiredMs = entry.durationMin * 60_000;
      if (durationMs < requiredMs) continue;

      const startLabel = slotStart.toISOString().slice(0, 16).replace('T', ' ');
      await this.producer.produceInApp({
        tenantId: event.tenantId,
        branchId: event.branchId,
        recipientId: entry.patientId,
        title: 'Appointment slot available',
        body: `A slot opened on ${startLabel}. You are on the waitlist — contact reception to book.`,
        priority: 'high',
        idempotencyKey: `waitlist-slot:${event.appointmentId}:${entry.id}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
      sent++;
    }

    if (sent > 0) {
      this.logger.log(`Notified ${sent} waitlist patients for freed slot ${event.appointmentId}`);
    }
    return sent;
  }
}
