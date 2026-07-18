import type { LicensedModuleId, PermissionAction } from '../types';

export const NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

export const NOTIFICATION_BUILTIN_PROVIDER_KEY = 'notification.builtin' as const;

/** Candidate licensed feature — optional on surfaces; not a new LicensedModuleId (Phase 41a). */
export const CANONICAL_NOTIFICATION_FEATURE_IDS = ['notificationCenter'] as const;
export type CanonicalNotificationFeatureId = (typeof CANONICAL_NOTIFICATION_FEATURE_IDS)[number];

export type NotificationKind = 'channel' | 'type' | 'template' | 'provider' | 'surface' | 'pack';

export type NotificationBranchScope = 'tenant' | 'branch' | 'cross-branch';

export type NotificationImplementationStatus = 'not-implemented' | 'stub' | 'partial' | 'full';

export type NotificationPhiClassification = 'none' | 'limited' | 'phi';

export type NotificationChannelId =
  | 'in-app'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'push'
  | 'webhook'
  | 'voice-call'
  | 'print-letter';

export type NotificationCategoryId =
  | 'appointment-lifecycle'
  | 'appointment-reminders'
  | 'patient-flow'
  | 'diagnostics-results'
  | 'pharmacy'
  | 'treatment-planning'
  | 'billing-invoicing'
  | 'payments'
  | 'inventory-alerts'
  | 'task-management'
  | 'approvals'
  | 'escalations'
  | 'journey-follow-up'
  | 'journey-recall'
  | 'account-security'
  | 'role-management'
  | 'branch-management'
  | 'licensing'
  | 'subscription-management'
  | 'reporting-exports'
  | 'system-health'
  | 'emergency'
  | 'consent-management'
  | 'marketing-promotions';

export type NotificationTypeId =
  | 'appointment-created'
  | 'appointment-confirmed'
  | 'appointment-reminder'
  | 'appointment-rescheduled'
  | 'appointment-cancelled'
  | 'patient-checked-in'
  | 'queue-position-changed'
  | 'clinician-ready'
  | 'laboratory-result-ready'
  | 'imaging-result-ready'
  | 'prescription-ready'
  | 'treatment-plan-updated'
  | 'invoice-issued'
  | 'payment-received'
  | 'payment-overdue'
  | 'stock-alert'
  | 'task-assigned'
  | 'approval-required'
  | 'workflow-escalation'
  | 'journey-follow-up-due'
  | 'journey-recall-due'
  | 'password-changed'
  | 'login-alert'
  | 'role-changed'
  | 'branch-changed'
  | 'license-expiring'
  | 'subscription-suspended'
  | 'report-ready'
  | 'export-ready'
  | 'system-maintenance'
  | 'emergency-alert'
  | 'communication-consent-changed';

export type NotificationDeliveryPolicyId =
  | 'immediate'
  | 'scheduled'
  | 'quiet-hours-aware'
  | 'branch-local-time'
  | 'recipient-local-time'
  | 'batched'
  | 'emergency-priority'
  | 'manual-approval-required'
  | 'fallback-enabled'
  | 'no-fallback'
  | 'expiry-bounded';

export type NotificationRetryPolicyId =
  | 'no-retry'
  | 'bounded-linear'
  | 'bounded-exponential'
  | 'provider-outage'
  | 'transient-network'
  | 'manual-retry-only';

export type NotificationConsentPolicyId =
  | 'transactional-necessity'
  | 'promotional-opt-in'
  | 'guardian-consent'
  | 'emergency-override'
  | 'regional-restriction'
  | 'revocation-aware';

export type NotificationPreferencePolicyId =
  | 'channel-opt-in'
  | 'quiet-hours'
  | 'locale-preference'
  | 'category-opt-out';

export type NotificationEscalationPolicyId = 'none' | 'staff-notify' | 'manager-escalate' | 'ops-alert';

export type NotificationRedactionPolicyId =
  | 'no-sensitive-content'
  | 'minimum-necessary'
  | 'secure-link-only'
  | 'lock-screen-redacted'
  | 'patient-portal-required'
  | 'staff-secure-view'
  | 'phi-high-restriction';

export type NotificationRetentionPolicyId =
  | 'configuration-history'
  | 'delivery-metadata'
  | 'communication-history'
  | 'failed-delivery-metadata'
  | 'promotional-message'
  | 'compliance-retention';

/** Aggregate capabilities projected from an EffectiveNotificationView — never UI-recomputed (SSOT §4.4 pattern). */
export const NOTIFICATION_AGGREGATE_CAPABILITY_IDS = [
  'canViewNotificationCenter',
  'canManageNotificationPreferences',
  'canManageNotificationTemplates',
  'canManageNotificationChannels',
  'canManageNotificationProviders',
  'canViewNotificationDeliveryFailures',
  'canViewCommunicationHistory',
  'canOverrideNotificationConsent',
  'canManageNotificationEscalations',
  'canExportNotificationData',
] as const;

export type NotificationAggregateCapabilityId = (typeof NOTIFICATION_AGGREGATE_CAPABILITY_IDS)[number];

export interface NotificationFailureBehavior {
  strategy: 'fail-closed';
  failClosed: true;
}

export interface CanonicalNotificationCategory {
  categoryId: NotificationCategoryId;
  ownerModuleId: LicensedModuleId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalNotificationChannel {
  channelId: NotificationChannelId;
  localId: string;
  notificationKind: 'channel';
  ownerModuleId: LicensedModuleId;
  moduleId: LicensedModuleId;
  providerKey: typeof NOTIFICATION_BUILTIN_PROVIDER_KEY;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  runtimeImplemented: boolean;
  implementationStatus: NotificationImplementationStatus;
  supportsRichContent: boolean;
  requiresRecipientAddress: boolean;
  fallbackChannelId?: NotificationChannelId;
  permissionResource: string;
  permissionAction: 'view';
  schemaVersion: string;
  contributionSchemaVersion: typeof NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION;
  deepLinkTemplate: string;
}

export interface CanonicalNotificationType {
  typeId: NotificationTypeId;
  localId: string;
  notificationKind: 'type';
  ownerModuleId: LicensedModuleId;
  moduleId: LicensedModuleId;
  providerKey: typeof NOTIFICATION_BUILTIN_PROVIDER_KEY;
  categoryId: NotificationCategoryId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  transactional: boolean;
  requiresConsent: boolean;
  consentPolicyId?: NotificationConsentPolicyId;
  sensitive: boolean;
  redactionPolicyId?: NotificationRedactionPolicyId;
  defaultChannelIds: readonly NotificationChannelId[];
  runtimeImplemented: boolean;
  implementationStatus: NotificationImplementationStatus;
  permissionResource: string;
  permissionAction: 'view';
  schemaVersion: string;
  contributionSchemaVersion: typeof NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION;
  deepLinkTemplate: string;
}

export interface CanonicalNotificationTemplate {
  templateId: string;
  localId: string;
  notificationKind: 'template';
  ownerModuleId: LicensedModuleId;
  moduleId: LicensedModuleId;
  providerKey: typeof NOTIFICATION_BUILTIN_PROVIDER_KEY;
  typeId: NotificationTypeId;
  locale: 'en';
  channelId: NotificationChannelId;
  publicationStatus: 'draft' | 'published';
  phiClassification: NotificationPhiClassification;
  variableNames: readonly string[];
  runtimeImplemented: boolean;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: 'view';
  schemaVersion: string;
  contributionSchemaVersion: typeof NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION;
  deepLinkTemplate: string;
}

export interface CanonicalNotificationProvider {
  providerId: string;
  localId: string;
  notificationKind: 'provider';
  ownerModuleId: LicensedModuleId;
  moduleId: LicensedModuleId;
  providerKey: typeof NOTIFICATION_BUILTIN_PROVIDER_KEY;
  channelId: NotificationChannelId;
  vendor: 'platform';
  requiresCredentials: false;
  runtimeImplemented: boolean;
  implementationStatus: NotificationImplementationStatus;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: 'view';
  schemaVersion: string;
  contributionSchemaVersion: typeof NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION;
  deepLinkTemplate: string;
}

export interface CanonicalNotificationSurface {
  surfaceId: string;
  localId: string;
  notificationKind: 'surface';
  moduleId: LicensedModuleId;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof NOTIFICATION_BUILTIN_PROVIDER_KEY;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  requiredFeature?: CanonicalNotificationFeatureId;
  branchScope: NotificationBranchScope;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: typeof NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalNotificationPack {
  packId: string;
  localId: string;
  notificationKind: 'pack';
  moduleId: LicensedModuleId;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof NOTIFICATION_BUILTIN_PROVIDER_KEY;
  includedTypeIds: readonly NotificationTypeId[];
  version: string;
  labelKey: string;
  descriptionKey: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: NotificationBranchScope;
  deepLinkTemplate: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: typeof NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION;
}

export type CanonicalNotificationCatalogEntry =
  | CanonicalNotificationChannel
  | CanonicalNotificationType
  | CanonicalNotificationTemplate
  | CanonicalNotificationProvider
  | CanonicalNotificationSurface
  | CanonicalNotificationPack;

export interface CanonicalNotificationDeliveryPolicy {
  policyId: NotificationDeliveryPolicyId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  failureBehavior: NotificationFailureBehavior;
}

export interface CanonicalNotificationRetryPolicy {
  policyId: NotificationRetryPolicyId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  failureBehavior: NotificationFailureBehavior;
}

export interface CanonicalNotificationConsentPolicy {
  policyId: NotificationConsentPolicyId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  failureBehavior: NotificationFailureBehavior;
}

export interface CanonicalNotificationPreferencePolicy {
  policyId: NotificationPreferencePolicyId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  failureBehavior: NotificationFailureBehavior;
}

export interface CanonicalNotificationEscalationPolicy {
  policyId: NotificationEscalationPolicyId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  failureBehavior: NotificationFailureBehavior;
}

export interface CanonicalNotificationRedactionPolicy {
  policyId: NotificationRedactionPolicyId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  failureBehavior: NotificationFailureBehavior;
}

export interface CanonicalNotificationRetentionPolicy {
  policyId: NotificationRetentionPolicyId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  failureBehavior: NotificationFailureBehavior;
}
