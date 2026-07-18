import type {
  CanonicalNotificationConsentPolicy,
  CanonicalNotificationRedactionPolicy,
} from '@booking/module-registry/notification';
import type {
  NotificationCapabilityFlags,
  NotificationCatalogSource,
  NotificationChannelSnapshot,
  NotificationProviderSnapshot,
  NotificationSurfaceSnapshot,
  NotificationTypeSnapshot,
} from './notification-types';

const RUNTIME_USABLE_CHANNEL_IDS = ['in-app', 'email', 'sms', 'whatsapp', 'push', 'webhook'] as const;

function isChannelUsable(
  channelId: string,
  channels: NotificationChannelSnapshot[],
  providers: NotificationProviderSnapshot[],
): boolean {
  const channel = channels.find((c) => c.channelId === channelId);
  if (!channel || !channel.runtimeImplemented) return false;
  const provider = providers.find((p) => p.channelId === channelId);
  if (!provider || !provider.runtimeImplemented) return false;
  return true;
}

/**
 * Derives NotificationCapabilityFlags from an already-resolved (fail-closed) snapshot only.
 * `canUse*` flags mean the channel + provider pairing is accessible AND registered as
 * runtime-implemented in the canonical vocabulary — they are configuration-accessibility
 * flags only and never assert that delivery actually succeeds (Phase 41b is provider &
 * configuration integration only; zero delivery changes).
 */
export function resolveNotificationCapabilitiesFromSnapshot(input: {
  source: NotificationCatalogSource;
  surfaces: NotificationSurfaceSnapshot[];
  channels: NotificationChannelSnapshot[];
  providers: NotificationProviderSnapshot[];
  types: NotificationTypeSnapshot[];
  consentPolicies: readonly CanonicalNotificationConsentPolicy[];
  redactionPolicies: readonly CanonicalNotificationRedactionPolicy[];
}): NotificationCapabilityFlags {
  if (input.source === 'restricted') {
    return emptyNotificationCapabilities();
  }

  const surfaceIds = new Set(input.surfaces.map((s) => s.surfaceId));

  const canViewNotificationCenter = surfaceIds.has('notification-center');
  const canViewCommunicationHistory = surfaceIds.has('communication-history');
  const canConfigureTemplates = surfaceIds.has('template-management');
  const canConfigureChannels = surfaceIds.has('channel-management');
  // No dedicated delivery-policy surface exists in the canonical vocabulary yet (Phase 41a);
  // delivery policy discoverability rides along with channel-management access.
  const canManageDeliveryPolicies = canConfigureChannels;
  const hasConsentPolicyVocabulary = input.consentPolicies.length > 0;
  const canManageConsentPolicies = surfaceIds.has('notification-preferences') && hasConsentPolicyVocabulary;
  const canViewDeliveryFailures = surfaceIds.has('delivery-failures');
  const canRetryFailedDelivery = canViewDeliveryFailures && canConfigureChannels;

  const hasAnyUsableChannel = RUNTIME_USABLE_CHANNEL_IDS.some((id) =>
    isChannelUsable(id, input.channels, input.providers),
  );
  const canSendManualNotifications = canViewNotificationCenter && hasAnyUsableChannel;
  const canSendPatientMessages = canSendManualNotifications;
  const canSendStaffMessages = canSendManualNotifications;
  const canSendCrossBranchMessages =
    canSendManualNotifications && input.surfaces.some((s) => s.branchScope === 'cross-branch');

  const canUseInApp = isChannelUsable('in-app', input.channels, input.providers);
  const canUseEmail = isChannelUsable('email', input.channels, input.providers);
  const canUseSms = isChannelUsable('sms', input.channels, input.providers);
  const canUseWhatsApp = isChannelUsable('whatsapp', input.channels, input.providers);
  const canUsePush = isChannelUsable('push', input.channels, input.providers);
  const canUseWebhook = isChannelUsable('webhook', input.channels, input.providers);

  const hasPromotionalType = input.types.some((t) => t.categoryId === 'marketing-promotions');
  const hasPromotionalOptInPolicy = input.consentPolicies.some((p) => p.policyId === 'promotional-opt-in');
  const canUseMarketingMessages = hasPromotionalType && hasPromotionalOptInPolicy;

  const hasRedactionPolicyVocabulary = input.redactionPolicies.length > 0;
  const canViewSensitiveMessageContent = hasRedactionPolicyVocabulary && canViewCommunicationHistory;
  const canExportCommunicationHistory = canViewCommunicationHistory;

  return {
    canViewNotificationCenter,
    canViewCommunicationHistory,
    canSendManualNotifications,
    canConfigureTemplates,
    canConfigureChannels,
    canManageDeliveryPolicies,
    canManageConsentPolicies,
    canViewDeliveryFailures,
    canRetryFailedDelivery,
    canSendPatientMessages,
    canSendStaffMessages,
    canSendCrossBranchMessages,
    canUseInApp,
    canUseEmail,
    canUseSms,
    canUseWhatsApp,
    canUsePush,
    canUseWebhook,
    canUseMarketingMessages,
    canViewSensitiveMessageContent,
    canExportCommunicationHistory,
  };
}

export function emptyNotificationCapabilities(): NotificationCapabilityFlags {
  return {
    canViewNotificationCenter: false,
    canViewCommunicationHistory: false,
    canSendManualNotifications: false,
    canConfigureTemplates: false,
    canConfigureChannels: false,
    canManageDeliveryPolicies: false,
    canManageConsentPolicies: false,
    canViewDeliveryFailures: false,
    canRetryFailedDelivery: false,
    canSendPatientMessages: false,
    canSendStaffMessages: false,
    canSendCrossBranchMessages: false,
    canUseInApp: false,
    canUseEmail: false,
    canUseSms: false,
    canUseWhatsApp: false,
    canUsePush: false,
    canUseWebhook: false,
    canUseMarketingMessages: false,
    canViewSensitiveMessageContent: false,
    canExportCommunicationHistory: false,
  };
}
