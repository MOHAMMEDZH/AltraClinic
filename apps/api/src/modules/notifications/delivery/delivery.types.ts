/**
 * Phase 41d — Notification Delivery Engine core types.
 *
 * The config platform (Phase 41a-c: EffectiveNotificationView, DynamicNotificationProvider,
 * STATIC_NOTIFICATION_CATALOG) is FROZEN and remains the sole authority for catalog metadata
 * (default channels, consent policy ids, categories, etc). These types describe the runtime
 * delivery pipeline that *consumes* that metadata — they never redefine or override it.
 */

/** Channels the delivery engine knows how to route to. Distinct from the legacy Prisma
 * `NotificationChannel` enum (EMAIL/SMS/PUSH/IN_APP/WHATSAPP) which lacks WEBHOOK. */
export type NotificationChannelId = 'in-app' | 'email' | 'sms' | 'whatsapp' | 'push' | 'webhook';

export const ALL_NOTIFICATION_CHANNEL_IDS: readonly NotificationChannelId[] = [
  'in-app',
  'email',
  'sms',
  'whatsapp',
  'push',
  'webhook',
];

export type NotificationLocale = 'en' | 'ar';

export type FailureClass = 'retryable' | 'permanent' | 'fallback' | 'dead_letter';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

/** Input to create a delivery intent. One intent may fan out to many channels/jobs. */
export interface IntentInput {
  tenantId: string;
  branchId?: string | null;
  recipientId: string;
  recipientType?: 'user' | 'patient' | 'platform_user';
  notificationTypeId?: string | null;
  category?: string | null;
  /** Transactional notifications bypass promotional consent gates (never marketing). */
  transactional?: boolean;
  priority?: NotificationPriority;
  requestedChannels: NotificationChannelId[];
  title: string;
  body: string;
  /** Optional localized alternates. `body`/`title` above are treated as the `en` source. */
  titleAr?: string | null;
  bodyAr?: string | null;
  templateVars?: Record<string, string | number | boolean | null | undefined>;
  locale?: NotificationLocale;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  scheduledAt?: Date | null;
  /** Phase 41e — optional cross-cutting trace/attribution fields. Producers should also mirror
   * these into `metadata` for persistence today (NotificationIntentService does not yet map
   * these onto dedicated columns); kept as typed top-level fields so callers get compile-time
   * safety and a future intent-schema migration can promote them without an API change. */
  correlationId?: string;
  causationId?: string;
  journeyInstanceId?: string;
  workflowInstanceId?: string;
  producerModuleId?: string;
}

export interface ConsentDecision {
  allowed: boolean;
  policyId: string;
  reason: string;
  evaluatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PreferenceSnapshot {
  found: boolean;
  channelSettings: Record<string, boolean>;
  categorySettings: Record<string, boolean>;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
  language: string | null;
  promotionalOptIn: boolean;
  optedOut: boolean;
}

export interface PreferenceDecision {
  allowedChannels: NotificationChannelId[];
  blockedChannels: { channel: NotificationChannelId; reason: string }[];
  reason: string;
  snapshot: PreferenceSnapshot;
}

export interface QuietHoursDecision {
  inQuietHours: boolean;
  deferUntil: Date | null;
  timezoneUsed: string | null;
  bypassed: boolean;
  reason: string;
}

export interface ChannelPlan {
  channel: NotificationChannelId;
  providerKey: string;
  order: number;
  isFallback: boolean;
}

export interface ProviderSendResult {
  success: boolean;
  providerKey: string;
  channel: NotificationChannelId;
  externalId?: string | null;
  raw?: unknown;
  error?: string;
  failureClass?: FailureClass;
}

export interface RetrySchedule {
  attempt: number;
  delayMs: number;
  nextAttemptAt: Date;
}

/** Dedicated BullMQ queue/job names for the Phase 41d delivery pipeline. Kept local to the
 * delivery module (rather than added to `background/config/queue-names.ts`) so this module
 * stays fully self-contained and never forms a circular Nest module dependency with
 * BackgroundModule (which already imports NotificationModule). */
export const DELIVERY_QUEUE_NAME = 'notification-delivery';
export const DELIVERY_JOB_NAME = 'process-delivery-job';
