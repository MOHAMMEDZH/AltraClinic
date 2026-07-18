import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { NotificationChannelId, NotificationPriority } from '../../../notifications/delivery/delivery.types';
import type { QueueBoardItem } from '../../domain/queue.types';

type NotifyChannel = 'SMS' | 'IN_APP' | 'PUSH';

const CHANNEL_MAP: Record<NotifyChannel, NotificationChannelId> = {
  SMS: 'sms',
  IN_APP: 'in-app',
  PUSH: 'push',
};

const PRIORITY_MAP: Record<'LOW' | 'MEDIUM' | 'HIGH', NotificationPriority> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

const PRODUCER_MODULE_ID = 'queue.notifications';

@Injectable()
export class QueueNotificationService {
  private readonly logger = new Logger(QueueNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
  ) {}

  async notifyCalled(item: QueueBoardItem): Promise<void> {
    const position = item.position ?? '—';
    const room = item.resourceName ? ` Please go to ${item.resourceName}.` : '';
    await this.enqueueForPatient(item, {
      title: 'You are being called',
      body: `${item.patientName}, please proceed to the consultation area.${room} Queue position: ${position}.`,
      channels: ['SMS', 'IN_APP', 'PUSH'],
      priority: 'HIGH',
    });
  }

  async notifyPositionUpdate(item: QueueBoardItem, position: number): Promise<void> {
    if (position > 3) return;
    await this.enqueueForPatient(item, {
      title: 'Queue update',
      body: `${item.patientName}, you are now #${position} in the queue. Estimated wait ~${item.estimatedWaitMinutes ?? 10} min.`,
      channels: position === 1 ? ['SMS', 'IN_APP', 'PUSH'] : ['IN_APP', 'PUSH'],
      priority: position === 1 ? 'HIGH' : 'MEDIUM',
    });
  }

  async notifyCheckIn(item: QueueBoardItem): Promise<void> {
    if (item.position == null) return;
    await this.notifyPositionUpdate(item, item.position);
  }

  private async enqueueForPatient(
    item: QueueBoardItem,
    message: { title: string; body: string; channels: NotifyChannel[]; priority: 'LOW' | 'MEDIUM' | 'HIGH' },
  ): Promise<void> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: item.patientId, tenantId: item.tenantId, deletedAt: null },
      select: { id: true, phone: true },
    });
    if (!patient) return;

    const channels = message.channels
      .filter((channel) => channel !== 'SMS' || !!patient.phone?.trim())
      .map((channel) => CHANNEL_MAP[channel]);
    if (channels.length === 0) return;

    try {
      await this.producer.produceChannels({
        tenantId: item.tenantId,
        branchId: item.branchId,
        recipientId: patient.id,
        title: message.title,
        body: message.body,
        priority: PRIORITY_MAP[message.priority],
        channels,
        idempotencyKey: `queue-notification:${item.queueTicketId}:${randomUUID()}`,
        producerModuleId: PRODUCER_MODULE_ID,
        metadata: patient.phone?.trim() ? { recipientPhone: patient.phone.trim() } : undefined,
      });
    } catch (error) {
      this.logger.warn(
        `Queue notification failed for patient ${patient.id}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
