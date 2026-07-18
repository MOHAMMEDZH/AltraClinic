import { Injectable } from '@nestjs/common';
import { NotificationChannel as PrismaChannel, NotificationStatus as PrismaStatus, NotificationPriority } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Notification } from '../domain/entities/notification.entity';
import {
  NotificationFilters,
  NotificationRepository,
} from '../domain/repositories/notification.repository.interface';
import { NotificationChannel } from '../domain/value-objects/notification-channel.vo';
import { NotificationStatus } from '../domain/value-objects/notification-status.vo';

// Schema NotificationChannel enum: EMAIL | SMS | PUSH | IN_APP | WHATSAPP
type DomainChannelType = 'in-app' | 'email' | 'sms' | 'push' | 'whatsapp';
type DomainPriority = 'low' | 'medium' | 'high' | 'critical';

const CHANNEL_TO_PRISMA: Record<DomainChannelType, PrismaChannel> = {
  'in-app': 'IN_APP',
  email: 'EMAIL',
  sms: 'SMS',
  push: 'PUSH',
  whatsapp: 'WHATSAPP',
};

const CHANNEL_TO_DOMAIN: Record<PrismaChannel, DomainChannelType> = {
  IN_APP: 'in-app',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  WHATSAPP: 'whatsapp',
};

const STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  queued: 'QUEUED',
  sent: 'SENT',
  delivered: 'DELIVERED',
  failed: 'FAILED',
  read: 'READ',
};

const STATUS_TO_DOMAIN: Record<PrismaStatus, string> = {
  DRAFT: 'draft',
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
};

const PRIORITY_TO_PRISMA: Record<DomainPriority, NotificationPriority> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

const PRIORITY_TO_DOMAIN: Record<NotificationPriority, DomainPriority> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(notification: Notification): Promise<void> {
    const channelKey = notification.channel.channel as DomainChannelType;
    await this.prisma.notification.upsert({
      where: { id: notification.notificationId },
      create: {
        id: notification.notificationId,
        tenantId: notification.tenantId,
        branchId: notification.branchId,
        recipientId: notification.recipientId,
        channel: CHANNEL_TO_PRISMA[channelKey] ?? 'IN_APP',
        title: notification.title,
        body: notification.body,
        priority: PRIORITY_TO_PRISMA[notification.priority],
        status: STATUS_TO_PRISMA[notification.status.status] as PrismaStatus,
        sentAt: notification.sentAt,
        deliveredAt: notification.deliveredAt,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      },
      update: {
        status: STATUS_TO_PRISMA[notification.status.status] as PrismaStatus,
        sentAt: notification.sentAt,
        deliveredAt: notification.deliveredAt,
        readAt: notification.readAt,
        updatedAt: notification.updatedAt,
      },
    });
  }

  async findById(notificationId: string, tenantId: string): Promise<Notification | null> {
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filters: NotificationFilters): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId: filters.tenantId,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.recipientId ? { recipientId: filters.recipientId } : {}),
        ...(filters.status ? { status: STATUS_TO_PRISMA[filters.status] as PrismaStatus } : {}),
        ...(filters.channel
          ? { channel: CHANNEL_TO_PRISMA[filters.channel as DomainChannelType] ?? 'IN_APP' }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    recipientId: string;
    channel: PrismaChannel;
    title: string;
    body: string;
    priority: NotificationPriority;
    status: PrismaStatus;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Notification {
    const channel = NotificationChannel.create(CHANNEL_TO_DOMAIN[row.channel] ?? 'in-app');
    const domainStatusStr = STATUS_TO_DOMAIN[row.status];
    const status = NotificationStatus.from(domainStatusStr, null, 0);

    return Object.assign(Object.create(Notification.prototype), {
      notificationId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      recipientId: row.recipientId,
      channel,
      title: row.title,
      body: row.body,
      priority: PRIORITY_TO_DOMAIN[row.priority],
      status,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      updatedAt: row.updatedAt,
    }) as Notification;
  }
}
