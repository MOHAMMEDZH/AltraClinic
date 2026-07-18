import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import type { NotificationSnapshot } from './notification-types';
import {
  STATIC_NOTIFICATION_CATALOG,
  STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY,
} from './static-notification-catalog';
import {
  validateNotificationLayerParity,
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
} from '@booking/module-registry/notification';
import { resolveNotificationCapabilitiesFromSnapshot } from './notification-capabilities';

export function assertNotificationCatalogLoaded(): void {
  if (STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    throw new Error('STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY must remain false');
  }
  const errors = validateNotificationLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_NOTIFICATION_CATALOG]);
  if (errors.length > 0) {
    throw new Error(`Invalid static notification catalog:\n${errors.join('\n')}`);
  }
}

export function assertNotificationSnapshotValid(snapshot: NotificationSnapshot): string[] {
  const errors: string[] = [];

  if (STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    errors.push('Runtime authority flag must remain false');
  }

  if (snapshot.kind !== 'notification') {
    errors.push('Snapshot kind mismatch');
  }

  if (snapshot.providerKey !== NOTIFICATION_BUILTIN_PROVIDER_KEY) {
    errors.push('Snapshot providerKey mismatch');
  }

  if (snapshot.view.snapshotVersion !== snapshot.notificationSnapshotVersion) {
    errors.push('Snapshot view.snapshotVersion mismatch');
  }

  const projected = resolveNotificationCapabilitiesFromSnapshot({
    source: snapshot.source,
    surfaces: snapshot.surfaces,
    channels: snapshot.channels,
    providers: snapshot.providers,
    types: snapshot.types,
    consentPolicies: snapshot.consentPolicies,
    redactionPolicies: snapshot.redactionPolicies,
  });

  const capabilityKeys: Array<keyof NotificationSnapshot['capabilities']> = [
    'canViewNotificationCenter',
    'canViewCommunicationHistory',
    'canSendManualNotifications',
    'canConfigureTemplates',
    'canConfigureChannels',
    'canManageDeliveryPolicies',
    'canManageConsentPolicies',
    'canViewDeliveryFailures',
    'canRetryFailedDelivery',
    'canSendPatientMessages',
    'canSendStaffMessages',
    'canSendCrossBranchMessages',
    'canUseInApp',
    'canUseEmail',
    'canUseSms',
    'canUseWhatsApp',
    'canUsePush',
    'canUseWebhook',
    'canUseMarketingMessages',
    'canViewSensitiveMessageContent',
    'canExportCommunicationHistory',
  ];

  for (const key of capabilityKeys) {
    if (snapshot.capabilities[key] !== projected[key]) {
      errors.push(`Capability ${key} mismatch`);
    }
  }

  if (snapshot.source === 'restricted' || snapshot.registryStatus === 'restricted') {
    if (snapshot.channels.length > 0 || snapshot.types.length > 0) {
      errors.push('Restricted snapshot must fail closed (channels/types)');
    }
    if (snapshot.surfaces.length > 0 || snapshot.packs.length > 0) {
      errors.push('Restricted snapshot must fail closed (surfaces/packs)');
    }
    if (Object.values(snapshot.capabilities).some(Boolean)) {
      errors.push('Restricted snapshot must fail closed (capabilities)');
    }
  }

  for (const channel of snapshot.channels) {
    const entry = STATIC_NOTIFICATION_CATALOG.find((e) => e.extensionId === channel.extensionId);
    if (!entry) {
      errors.push(`Channel missing catalog match: ${channel.extensionId}`);
      continue;
    }
    if (entry.notificationKind !== 'channel') errors.push(`Channel kind mismatch: ${channel.extensionId}`);
    if (entry.permissionResource !== channel.permissionResource) {
      errors.push(`Channel permissionResource mismatch: ${channel.channelId}`);
    }
  }

  for (const type of snapshot.types) {
    const entry = STATIC_NOTIFICATION_CATALOG.find((e) => e.extensionId === type.extensionId);
    if (!entry) {
      errors.push(`Type missing catalog match: ${type.extensionId}`);
      continue;
    }
    if (entry.notificationKind !== 'type') errors.push(`Type kind mismatch: ${type.extensionId}`);
    if (entry.permissionResource !== type.permissionResource) {
      errors.push(`Type permissionResource mismatch: ${type.typeId}`);
    }
  }

  // Branch-scoped fail-closed: missing branch never widens to cross-branch.
  if (snapshot.identity.branchId == null) {
    if (snapshot.capabilities.canSendCrossBranchMessages) {
      errors.push('Missing branch must not widen canSendCrossBranchMessages');
    }
    if (snapshot.surfaces.some((s) => s.branchScope === 'cross-branch')) {
      errors.push('Cross-branch surfaces must be hidden when branchId is null');
    }
    if (snapshot.packs.some((p) => p.branchScope === 'cross-branch')) {
      errors.push('Cross-branch packs must be hidden when branchId is null');
    }
  }

  if (!Object.isFrozen(snapshot)) {
    errors.push('Snapshot must be frozen (immutability)');
  }

  if (snapshot.capabilities.canViewNotificationCenter !== snapshot.canViewNotificationCenter) {
    errors.push('canViewNotificationCenter flag mismatch');
  }
  if (snapshot.capabilities.canViewCommunicationHistory !== snapshot.canViewCommunicationHistory) {
    errors.push('canViewCommunicationHistory flag mismatch');
  }

  return errors;
}
