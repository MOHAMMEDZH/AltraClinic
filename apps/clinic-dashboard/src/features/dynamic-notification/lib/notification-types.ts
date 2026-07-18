import type { LicensedModuleId, PermissionAction } from '@booking/module-registry';
import type {
  CanonicalNotificationConsentPolicy,
  CanonicalNotificationDeliveryPolicy,
  CanonicalNotificationEscalationPolicy,
  CanonicalNotificationPreferencePolicy,
  CanonicalNotificationRedactionPolicy,
  CanonicalNotificationRetentionPolicy,
  CanonicalNotificationRetryPolicy,
} from '@booking/module-registry/notification';

export type NotificationCatalogSource = 'registry' | 'static-fallback' | 'static-only' | 'restricted';

export type NotificationRegistryStatus = 'loading' | 'ready' | 'error' | 'restricted';

export interface NotificationSnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  branchId: string | null;
  locale: string;
}

export interface NotificationCategorySnapshot {
  categoryId: string;
  labelKey: string;
}

export interface NotificationChannelSnapshot {
  kind: 'channel';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  channelId: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  runtimeImplemented: boolean;
  implementationStatus: string;
  supportsRichContent: boolean;
  requiresRecipientAddress: boolean;
  fallbackChannelId?: string;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface NotificationTypeSnapshot {
  kind: 'type';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  typeId: string;
  categoryId: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  transactional: boolean;
  requiresConsent: boolean;
  consentPolicyId?: string;
  sensitive: boolean;
  redactionPolicyId?: string;
  defaultChannelIds: string[];
  runtimeImplemented: boolean;
  implementationStatus: string;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface NotificationTemplateSnapshot {
  kind: 'template';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  templateId: string;
  typeId: string;
  locale: string;
  channelId: string;
  publicationStatus: string;
  phiClassification: string;
  variableNames: string[];
  runtimeImplemented: boolean;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface NotificationProviderSnapshot {
  kind: 'provider';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  providerId: string;
  channelId: string;
  vendor?: string;
  requiresCredentials: boolean;
  runtimeImplemented: boolean;
  implementationStatus: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface NotificationSurfaceSnapshot {
  kind: 'surface';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  surfaceId: string;
  route?: string;
  requiredFeature?: string;
  branchScope: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface NotificationPackSnapshot {
  kind: 'pack';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  packId: string;
  includedTypeIds: string[];
  branchScope: string;
  version: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface NotificationLockedTypeEntry {
  extensionId: string;
  reason: 'licensing' | 'permission' | 'branch' | 'reference' | 'restricted';
}

export interface NotificationDisabledChannelEntry {
  channelId: string;
  reason: 'permission' | 'not-implemented' | 'restricted' | 'reference';
}

export interface NotificationTemplateVersionEntry {
  templateId: string;
  typeId: string;
  locale: string;
  schemaVersion: string;
}

/**
 * Aggregate capability flags derived from an EffectiveNotificationView only — never
 * UI-recomputed. `canUse*` flags mean the channel/provider pairing is discoverable and
 * marked runtime-implemented in the canonical vocabulary — they never assert that delivery
 * actually succeeds (Phase 41b remains provider/configuration wiring only).
 */
export interface NotificationCapabilityFlags {
  canViewNotificationCenter: boolean;
  canViewCommunicationHistory: boolean;
  canSendManualNotifications: boolean;
  canConfigureTemplates: boolean;
  canConfigureChannels: boolean;
  canManageDeliveryPolicies: boolean;
  canManageConsentPolicies: boolean;
  canViewDeliveryFailures: boolean;
  canRetryFailedDelivery: boolean;
  canSendPatientMessages: boolean;
  canSendStaffMessages: boolean;
  canSendCrossBranchMessages: boolean;
  canUseInApp: boolean;
  canUseEmail: boolean;
  canUseSms: boolean;
  canUseWhatsApp: boolean;
  canUsePush: boolean;
  canUseWebhook: boolean;
  canUseMarketingMessages: boolean;
  canViewSensitiveMessageContent: boolean;
  canExportCommunicationHistory: boolean;
}

export interface EffectiveNotificationView {
  tenantId: string;
  userId: string;
  branchId: string | null;
  locale: string;
  supportedLocales: string[];
  accessibleCategories: NotificationCategorySnapshot[];
  accessibleNotificationTypes: NotificationTypeSnapshot[];
  accessibleChannels: NotificationChannelSnapshot[];
  accessibleTemplates: NotificationTemplateSnapshot[];
  accessibleProviders: NotificationProviderSnapshot[];
  accessiblePacks: NotificationPackSnapshot[];
  accessibleSurfaces: NotificationSurfaceSnapshot[];
  lockedNotificationTypes: NotificationLockedTypeEntry[];
  disabledChannels: NotificationDisabledChannelEntry[];
  deliveryPolicies: readonly CanonicalNotificationDeliveryPolicy[];
  retryPolicies: readonly CanonicalNotificationRetryPolicy[];
  consentPolicies: readonly CanonicalNotificationConsentPolicy[];
  preferencePolicies: readonly CanonicalNotificationPreferencePolicy[];
  escalationPolicies: readonly CanonicalNotificationEscalationPolicy[];
  redactionPolicies: readonly CanonicalNotificationRedactionPolicy[];
  retentionPolicies: readonly CanonicalNotificationRetentionPolicy[];
  templateVersions: NotificationTemplateVersionEntry[];
  capabilityFlags: NotificationCapabilityFlags;
  branchScope: string;
  providerOwnership: {
    providerKey: string;
  };
  snapshotVersion: string;
  source: NotificationCatalogSource;
  resolvedAt: string;
}

export interface NotificationSnapshot {
  kind: 'notification';
  view: EffectiveNotificationView;
  source: NotificationCatalogSource;
  registryMode: boolean;
  registryStatus: NotificationRegistryStatus;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  whiteLabelSnapshotVersion: string | null;
  identity: NotificationSnapshotIdentity;
  generatedAt: string;
  notificationSnapshotVersion: string;
  notificationConfigurationVersion: string;
  cacheVersion: string;
  providerKey: string;

  categories: NotificationCategorySnapshot[];
  channels: NotificationChannelSnapshot[];
  types: NotificationTypeSnapshot[];
  templates: NotificationTemplateSnapshot[];
  providers: NotificationProviderSnapshot[];
  surfaces: NotificationSurfaceSnapshot[];
  packs: NotificationPackSnapshot[];

  deliveryPolicies: readonly CanonicalNotificationDeliveryPolicy[];
  retryPolicies: readonly CanonicalNotificationRetryPolicy[];
  consentPolicies: readonly CanonicalNotificationConsentPolicy[];
  preferencePolicies: readonly CanonicalNotificationPreferencePolicy[];
  escalationPolicies: readonly CanonicalNotificationEscalationPolicy[];
  redactionPolicies: readonly CanonicalNotificationRedactionPolicy[];
  retentionPolicies: readonly CanonicalNotificationRetentionPolicy[];

  capabilities: NotificationCapabilityFlags;
  canViewNotificationCenter: boolean;
  canViewCommunicationHistory: boolean;
  canSendManualNotifications: boolean;
  canConfigureTemplates: boolean;
  canConfigureChannels: boolean;
  canManageDeliveryPolicies: boolean;
  canManageConsentPolicies: boolean;
  canViewDeliveryFailures: boolean;
  canRetryFailedDelivery: boolean;
  canSendPatientMessages: boolean;
  canSendStaffMessages: boolean;
  canSendCrossBranchMessages: boolean;
  canUseInApp: boolean;
  canUseEmail: boolean;
  canUseSms: boolean;
  canUseWhatsApp: boolean;
  canUsePush: boolean;
  canUseWebhook: boolean;
  canUseMarketingMessages: boolean;
  canViewSensitiveMessageContent: boolean;
  canExportCommunicationHistory: boolean;
}

export interface NotificationCatalogContributionEntry {
  extensionId: string;
  notificationKind: string;
}
