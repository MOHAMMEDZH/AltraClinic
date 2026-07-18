import { Notification } from '../entities/notification.entity';

export interface NotificationFilters {
  tenantId: string;
  branchId?: string | null;
  recipientId?: string | null;
  status?: string | null;
  channel?: string | null;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(notificationId: string, tenantId: string): Promise<Notification | null>;
  list(filters: NotificationFilters): Promise<Notification[]>;
}
