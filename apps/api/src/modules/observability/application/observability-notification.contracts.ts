/**
 * Phase 45a — Notification intent kind registry only.
 * Does NOT produce or send notifications.
 */
import { OBSERVABILITY_NOTIFICATION_INTENTS } from '../observability.constants';

export type ObservabilityNotificationIntentKind =
  (typeof OBSERVABILITY_NOTIFICATION_INTENTS)[number];

export class ObservabilityNotificationContracts {
  readonly intentKinds: readonly ObservabilityNotificationIntentKind[] =
    OBSERVABILITY_NOTIFICATION_INTENTS;

  listIntentKinds(): readonly ObservabilityNotificationIntentKind[] {
    return this.intentKinds;
  }
}
