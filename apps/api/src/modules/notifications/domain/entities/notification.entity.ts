import { randomUUID } from 'crypto';
import { NotificationChannel } from '../value-objects/notification-channel.vo';
import { NotificationStatus } from '../value-objects/notification-status.vo';

export interface NotificationProps {
  tenantId: string;
  branchId: string | null;
  recipientId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export class Notification {
  public readonly notificationId: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly recipientId: string;
  public readonly channel: NotificationChannel;
  public readonly title: string;
  public readonly body: string;
  public readonly priority: 'low' | 'medium' | 'high' | 'critical';
  public status: NotificationStatus;
  public readonly createdAt: Date;
  public sentAt: Date | null;
  public deliveredAt: Date | null;
  public readAt: Date | null;
  public updatedAt: Date;

  private constructor(props: NotificationProps) {
    this.notificationId = randomUUID();
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.recipientId = props.recipientId;
    this.channel = props.channel;
    this.title = props.title;
    this.body = props.body;
    this.priority = props.priority;
    this.status = NotificationStatus.queued();
    this.createdAt = new Date();
    this.sentAt = null;
    this.deliveredAt = null;
    this.readAt = null;
    this.updatedAt = new Date();
  }

  public static create(props: NotificationProps): Notification {
    if (!props.tenantId?.trim()) {
      throw new Error('tenantId is required');
    }
    if (!props.recipientId?.trim()) {
      throw new Error('recipientId is required');
    }
    if (!props.title?.trim()) {
      throw new Error('title is required');
    }
    if (!props.body?.trim()) {
      throw new Error('body is required');
    }

    return new Notification(props);
  }

  public markAsRead(): void {
    if (this.status.status === 'read') {
      return;
    }
    this.status = NotificationStatus.read(this.status);
    this.readAt = new Date();
    this.updatedAt = new Date();
  }

  public markAsSent(): void {
    if (this.status.status === 'sent' || this.status.status === 'delivered') {
      return;
    }
    this.status = NotificationStatus.sent();
    this.sentAt = new Date();
    this.updatedAt = new Date();
  }

  public markAsDelivered(): void {
    if (this.status.status === 'delivered') {
      return;
    }
    this.status = NotificationStatus.delivered();
    this.deliveredAt = new Date();
    this.updatedAt = new Date();
  }

  public toJSON() {
    return {
      notificationId: this.notificationId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      recipientId: this.recipientId,
      channel: this.channel.toJSON(),
      title: this.title,
      body: this.body,
      priority: this.priority,
      status: this.status.toJSON(),
      createdAt: this.createdAt.toISOString(),
      sentAt: this.sentAt?.toISOString() ?? null,
      deliveredAt: this.deliveredAt?.toISOString() ?? null,
      readAt: this.readAt?.toISOString() ?? null,
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
