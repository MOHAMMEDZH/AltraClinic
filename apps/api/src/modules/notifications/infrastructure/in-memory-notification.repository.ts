import { Injectable } from '@nestjs/common';
import { Notification } from '../domain/entities/notification.entity';
import { NotificationRepository, NotificationFilters } from '../domain/repositories/notification.repository.interface';

@Injectable()
export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly store = new Map<string, Map<string, Notification>>();

  private bucket(tenantId: string): Map<string, Notification> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(notification: Notification): Promise<void> {
    const bucket = this.bucket(notification.tenantId);
    bucket.set(notification.notificationId, notification);
  }

  async findById(notificationId: string, tenantId: string): Promise<Notification | null> {
    return this.bucket(tenantId).get(notificationId) ?? null;
  }

  async list(filters: NotificationFilters): Promise<Notification[]> {
    let notifications = Array.from(this.bucket(filters.tenantId).values());
    if (filters.branchId) {
      notifications = notifications.filter((notification) => notification.branchId === filters.branchId);
    }
    if (filters.recipientId) {
      notifications = notifications.filter((notification) => notification.recipientId === filters.recipientId);
    }
    if (filters.status) {
      notifications = notifications.filter((notification) => notification.status.status === filters.status);
    }
    if (filters.channel) {
      notifications = notifications.filter((notification) => notification.channel.channel === filters.channel);
    }
    return notifications;
  }
}
