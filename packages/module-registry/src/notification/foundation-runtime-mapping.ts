/**
 * Phase 41a foundation — documentation-only mapping from existing apps/api notification
 * runtime evidence to canonical notification vocabulary ids. This file contains no runtime
 * code and is imported by nothing; it exists purely as a traceable record of *why* specific
 * `runtimeImplemented`/`implementationStatus`/`publicationStatus` values were chosen, so a
 * later phase (41b+) can verify or update the mapping without re-deriving it from scratch.
 *
 * Evidence sources (apps/api/src/modules/notifications, .../background, prisma/seed-notification-center.mjs):
 *  - NotificationChannel value object validates: in-app, email, sms, push, whatsapp.
 *  - DomainEventNotificationListener creates in-app notifications unconditionally for a
 *    handful of domain events (appointment scheduled, invoice created, encounter created,
 *    patient registered, subscription canceled) — a real but narrow in-app-only path.
 *  - NotificationAutomationListener + NotificationAutomationExecutorService resolve
 *    tenant-configurable automation rules by eventType, rendering a NotificationTemplate.
 *  - seed-notification-center.mjs seeds automation rules + EN templates for exactly:
 *    appointment.scheduled ("Appointment reminder (24h)", SMS), appointment.cancelled
 *    ("Appointment cancelled", SMS), payment.received ("Payment received", EMAIL),
 *    security.alert ("Security alert", IN_APP), staff.invited, patient.registered.
 *  - AppointmentReminderService is a dedicated scheduled worker that scans upcoming
 *    appointments and dispatches reminder notifications — the strongest single-type signal.
 */
export const NOTIFICATION_FOUNDATION_RUNTIME_MAPPING = [
  {
    canonicalTypeId: 'appointment-reminder',
    evidence: 'AppointmentReminderService (background worker) + seeded "appointment.scheduled" automation rule (SMS)',
    runtimeImplemented: true,
    implementationStatus: 'partial',
  },
  {
    canonicalTypeId: 'appointment-cancelled',
    evidence: 'Seeded "appointment.cancelled" automation rule + EN template (SMS)',
    runtimeImplemented: true,
    implementationStatus: 'partial',
  },
  {
    canonicalTypeId: 'payment-received',
    evidence: 'InvoicePaymentRecordedEvent → "payment.received" automation rule + EN template (EMAIL)',
    runtimeImplemented: true,
    implementationStatus: 'partial',
  },
  {
    canonicalTypeId: 'login-alert',
    evidence: 'SuspiciousLoginEvent → "security.alert" automation rule + EN template (IN_APP)',
    runtimeImplemented: true,
    implementationStatus: 'partial',
  },
] as const;

export const NOTIFICATION_FOUNDATION_CHANNEL_RUNTIME_MAPPING = [
  { canonicalChannelId: 'in-app', evidence: 'Notification entity + repository + handlers (create/list/mark-read)' },
  { canonicalChannelId: 'email', evidence: 'NotificationChannel vo accepts "email"; no external SMTP send evidenced' },
  { canonicalChannelId: 'sms', evidence: 'NotificationChannel vo accepts "sms"; seeded SMS templates exist' },
  { canonicalChannelId: 'whatsapp', evidence: 'NotificationChannel vo accepts "whatsapp"; no wired templates/rules' },
  { canonicalChannelId: 'push', evidence: 'NotificationChannel vo accepts "push"; no wired templates/rules' },
  { canonicalChannelId: 'webhook', evidence: 'Not present in NotificationChannel value object at all' },
  { canonicalChannelId: 'voice-call', evidence: 'Not present in NotificationChannel value object at all' },
  { canonicalChannelId: 'print-letter', evidence: 'Not present in NotificationChannel value object at all' },
] as const;
