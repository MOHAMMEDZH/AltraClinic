import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalNotificationChannel,
  type NotificationChannelId,
  type NotificationImplementationStatus,
} from './notification-types';
import type { LicensedModuleId } from '../types';

type ChannelInput = {
  channelId: NotificationChannelId;
  runtimeImplemented: boolean;
  implementationStatus: NotificationImplementationStatus;
  supportsRichContent: boolean;
  requiresRecipientAddress: boolean;
  fallbackChannelId?: NotificationChannelId;
  sortOrder: number;
};

const OWNER_MODULE_ID: LicensedModuleId = 'notifications';

function defineChannel(input: ChannelInput): CanonicalNotificationChannel {
  return {
    channelId: input.channelId,
    localId: `channel-${input.channelId}`,
    notificationKind: 'channel',
    ownerModuleId: OWNER_MODULE_ID,
    moduleId: OWNER_MODULE_ID,
    providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY,
    labelKey: `notification.channel.${input.channelId}`,
    descriptionKey: `notification.channel.${input.channelId}.description`,
    sortOrder: input.sortOrder,
    runtimeImplemented: input.runtimeImplemented,
    implementationStatus: input.implementationStatus,
    supportsRichContent: input.supportsRichContent,
    requiresRecipientAddress: input.requiresRecipientAddress,
    fallbackChannelId: input.fallbackChannelId,
    permissionResource: 'api.notifications',
    permissionAction: 'view',
    schemaVersion: '1',
    contributionSchemaVersion: NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
    deepLinkTemplate: `/settings/notifications/channels?channel=${input.channelId}`,
  };
}

/**
 * Canonical notification channels — Phase 41a foundation (8 channels, counted in ENTRY_COUNT).
 * Zero runtime behavior: registry metadata only, honestly reflecting current runtime status.
 */
export const CANONICAL_NOTIFICATION_CHANNELS: readonly CanonicalNotificationChannel[] = [
  defineChannel({
    channelId: 'in-app',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    supportsRichContent: true,
    requiresRecipientAddress: false,
    fallbackChannelId: undefined,
    sortOrder: 10,
  }),
  defineChannel({
    channelId: 'email',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    supportsRichContent: true,
    requiresRecipientAddress: true,
    fallbackChannelId: 'in-app',
    sortOrder: 20,
  }),
  defineChannel({
    channelId: 'sms',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    supportsRichContent: false,
    requiresRecipientAddress: true,
    fallbackChannelId: 'in-app',
    sortOrder: 30,
  }),
  defineChannel({
    channelId: 'whatsapp',
    runtimeImplemented: false,
    implementationStatus: 'stub',
    supportsRichContent: true,
    requiresRecipientAddress: true,
    fallbackChannelId: 'sms',
    sortOrder: 40,
  }),
  defineChannel({
    channelId: 'push',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    supportsRichContent: false,
    requiresRecipientAddress: true,
    fallbackChannelId: 'in-app',
    sortOrder: 50,
  }),
  defineChannel({
    channelId: 'webhook',
    runtimeImplemented: false,
    implementationStatus: 'not-implemented',
    supportsRichContent: true,
    requiresRecipientAddress: true,
    fallbackChannelId: undefined,
    sortOrder: 60,
  }),
  defineChannel({
    channelId: 'voice-call',
    runtimeImplemented: false,
    implementationStatus: 'not-implemented',
    supportsRichContent: false,
    requiresRecipientAddress: true,
    fallbackChannelId: 'sms',
    sortOrder: 70,
  }),
  defineChannel({
    channelId: 'print-letter',
    runtimeImplemented: false,
    implementationStatus: 'not-implemented',
    supportsRichContent: true,
    requiresRecipientAddress: true,
    fallbackChannelId: undefined,
    sortOrder: 80,
  }),
] as const;

export const CANONICAL_NOTIFICATION_CHANNEL_COUNT = CANONICAL_NOTIFICATION_CHANNELS.length;
export const CANONICAL_NOTIFICATION_CHANNEL_IDS = CANONICAL_NOTIFICATION_CHANNELS.map((c) => c.channelId);
