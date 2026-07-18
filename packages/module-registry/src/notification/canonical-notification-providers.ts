import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalNotificationProvider,
  type NotificationChannelId,
  type NotificationImplementationStatus,
} from './notification-types';
import type { LicensedModuleId } from '../types';

type ProviderInput = {
  providerId: string;
  channelId: NotificationChannelId;
  runtimeImplemented: boolean;
  implementationStatus: NotificationImplementationStatus;
  sortOrder: number;
};

const OWNER_MODULE_ID: LicensedModuleId = 'notifications';

function defineProvider(input: ProviderInput): CanonicalNotificationProvider {
  return {
    providerId: input.providerId,
    localId: `provider-${input.providerId}`,
    notificationKind: 'provider',
    ownerModuleId: OWNER_MODULE_ID,
    moduleId: OWNER_MODULE_ID,
    providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY,
    channelId: input.channelId,
    vendor: 'platform',
    requiresCredentials: false,
    runtimeImplemented: input.runtimeImplemented,
    implementationStatus: input.implementationStatus,
    labelKey: `notification.provider.${input.providerId}`,
    descriptionKey: `notification.provider.${input.providerId}.description`,
    sortOrder: input.sortOrder,
    permissionResource: 'api.notifications',
    permissionAction: 'view',
    schemaVersion: '1',
    contributionSchemaVersion: NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
    deepLinkTemplate: `/settings/notifications/channels?provider=${input.providerId}`,
  };
}

/**
 * Canonical notification providers — Phase 41a foundation (6 providers, counted in ENTRY_COUNT).
 * All are first-party platform providers — no external vendor names, no credentials stored here.
 * runtimeImplemented mirrors the matching CanonicalNotificationChannel honesty (Phase 41a).
 */
export const CANONICAL_NOTIFICATION_PROVIDERS: readonly CanonicalNotificationProvider[] = [
  defineProvider({
    providerId: 'in-app.platform',
    channelId: 'in-app',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 10,
  }),
  defineProvider({
    providerId: 'email.platform',
    channelId: 'email',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 20,
  }),
  defineProvider({
    providerId: 'sms.platform',
    channelId: 'sms',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 30,
  }),
  defineProvider({
    providerId: 'whatsapp.platform',
    channelId: 'whatsapp',
    runtimeImplemented: false,
    implementationStatus: 'stub',
    sortOrder: 40,
  }),
  defineProvider({
    providerId: 'push.platform',
    channelId: 'push',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 50,
  }),
  defineProvider({
    providerId: 'webhook.platform',
    channelId: 'webhook',
    runtimeImplemented: false,
    implementationStatus: 'not-implemented',
    sortOrder: 60,
  }),
] as const;

export const CANONICAL_NOTIFICATION_PROVIDER_COUNT = CANONICAL_NOTIFICATION_PROVIDERS.length;
export const CANONICAL_NOTIFICATION_PROVIDER_IDS = CANONICAL_NOTIFICATION_PROVIDERS.map((p) => p.providerId);
