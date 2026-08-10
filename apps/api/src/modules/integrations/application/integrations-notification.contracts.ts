/**
 * Phase 44a — Notification intent kind registry only.
 * Does NOT produce or send notifications.
 */
import { INTEGRATIONS_NOTIFICATION_INTENTS } from '../integrations.constants';

export type IntegrationsNotificationIntentKind =
  (typeof INTEGRATIONS_NOTIFICATION_INTENTS)[number];

export class IntegrationsNotificationContracts {
  readonly intentKinds: readonly IntegrationsNotificationIntentKind[] =
    INTEGRATIONS_NOTIFICATION_INTENTS;

  listIntentKinds(): readonly IntegrationsNotificationIntentKind[] {
    return this.intentKinds;
  }
}
