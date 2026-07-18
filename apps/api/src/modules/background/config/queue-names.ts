export const BACKGROUND_QUEUES = {
  OUTBOX: 'outbox',
  NOTIFICATIONS: 'notifications',
  SUBSCRIPTION_REMINDERS: 'subscription-reminders',
  INVENTORY_ALERTS: 'inventory-alerts',
  ANALYTICS: 'analytics',
  APPOINTMENT_NO_SHOW: 'appointment-no-show',
  APPOINTMENT_REMINDERS: 'appointment-reminders',
  BILLING_OVERDUE: 'billing-overdue',
  SCHEDULED_REPORTS: 'scheduled-reports',
  NOTIFICATION_AUTOMATION: 'notification-automation',
  WORKFLOW_ESCALATION: 'workflow-escalation',
} as const;

export type BackgroundQueueName = (typeof BACKGROUND_QUEUES)[keyof typeof BACKGROUND_QUEUES];

export const BACKGROUND_JOBS = {
  OUTBOX_PROCESS: 'process-pending',
  NOTIFICATIONS_PROCESS: 'process-queued',
  SUBSCRIPTION_SCAN: 'scan-reminders',
  INVENTORY_SCAN: 'scan-alerts',
  ANALYTICS_ROLLUP: 'aggregate-daily',
  NO_SHOW_SCAN: 'scan-no-shows',
  APPOINTMENT_REMINDER_SCAN: 'scan-appointment-reminders',
  BILLING_OVERDUE_SCAN: 'scan-overdue-invoices',
  SCHEDULED_REPORTS_SCAN: 'scan-scheduled-reports',
  NOTIFICATION_AUTOMATION_SCAN: 'scan-automation-schedules',
  WORKFLOW_ESCALATION_SCAN: 'scan-workflow-escalations',
} as const;
