import { hasPermission } from '@booking/permissions';

export type NotificationPermAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'manage';

export function buildNotificationsPermCheck(roles: string[]) {
  return (action: NotificationPermAction) => hasPermission(roles, 'api.notifications', action);
}

export function canViewNotifications(perm: ReturnType<typeof buildNotificationsPermCheck>) {
  return perm('view');
}

export function canCreateNotifications(perm: ReturnType<typeof buildNotificationsPermCheck>) {
  return perm('create');
}

export function canManageNotifications(perm: ReturnType<typeof buildNotificationsPermCheck>) {
  return perm('manage');
}

export const NOTIFICATION_CHANNELS = ['in-app', 'email', 'sms', 'push', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['queued', 'sent', 'delivered', 'failed', 'read'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const INBOX_TABS = ['all', 'unread', 'starred', 'archived'] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'medium', 'high'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const AUTOMATION_EVENT_TYPES = [
  'appointment.scheduled',
  'appointment.cancelled',
  'invoice.created',
  'payment.received',
  'patient.registered',
  'staff.invited',
  'portal.invited',
  'subscription.canceled',
  'security.alert',
  'security.failed_login',
  'security.password_reset',
  'inventory.low_stock',
] as const;
export type AutomationEventType = (typeof AUTOMATION_EVENT_TYPES)[number];
