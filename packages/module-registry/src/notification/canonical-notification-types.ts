import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalNotificationType,
  type NotificationCategoryId,
  type NotificationChannelId,
  type NotificationConsentPolicyId,
  type NotificationImplementationStatus,
  type NotificationRedactionPolicyId,
  type NotificationTypeId,
} from './notification-types';
import type { LicensedModuleId } from '../types';

type TypeInput = {
  typeId: NotificationTypeId;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  categoryId: NotificationCategoryId;
  defaultChannelIds: readonly NotificationChannelId[];
  transactional?: boolean;
  requiresConsent?: boolean;
  consentPolicyId?: NotificationConsentPolicyId;
  sensitive?: boolean;
  redactionPolicyId?: NotificationRedactionPolicyId;
  runtimeImplemented?: boolean;
  implementationStatus?: NotificationImplementationStatus;
  sortOrder: number;
};

function defineType(input: TypeInput): CanonicalNotificationType {
  return {
    typeId: input.typeId,
    localId: `type-${input.typeId}`,
    notificationKind: 'type',
    ownerModuleId: input.ownerModuleId,
    moduleId: input.ownerModuleId,
    providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY,
    categoryId: input.categoryId,
    labelKey: `notification.type.${input.typeId}`,
    descriptionKey: `notification.type.${input.typeId}.description`,
    sortOrder: input.sortOrder,
    transactional: input.transactional ?? true,
    requiresConsent: input.requiresConsent ?? false,
    consentPolicyId: input.consentPolicyId ?? 'transactional-necessity',
    sensitive: input.sensitive ?? false,
    redactionPolicyId: input.redactionPolicyId,
    defaultChannelIds: input.defaultChannelIds,
    runtimeImplemented: input.runtimeImplemented ?? false,
    implementationStatus: input.implementationStatus ?? 'not-implemented',
    permissionResource: input.permissionResource,
    permissionAction: 'view',
    schemaVersion: '1',
    contributionSchemaVersion: NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
    deepLinkTemplate: `/settings/notifications/types?type=${input.typeId}`,
  };
}

/**
 * Canonical notification types — Phase 41a foundation (32 types, counted in ENTRY_COUNT).
 * Zero runtime behavior: registry metadata only. runtimeImplemented/implementationStatus are
 * kept honest against the actual apps/api notification runtime (in-app repository, automation
 * executor, appointment-reminder worker, seeded automation rules); most types default to
 * false/'not-implemented' since no wired runtime path exists yet.
 */
export const CANONICAL_NOTIFICATION_TYPES: readonly CanonicalNotificationType[] = [
  defineType({
    typeId: 'appointment-created',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    categoryId: 'appointment-lifecycle',
    defaultChannelIds: ['in-app', 'sms'],
    sortOrder: 10,
  }),
  defineType({
    typeId: 'appointment-confirmed',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    categoryId: 'appointment-lifecycle',
    defaultChannelIds: ['in-app', 'sms'],
    sortOrder: 20,
  }),
  defineType({
    typeId: 'appointment-reminder',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    categoryId: 'appointment-reminders',
    defaultChannelIds: ['sms', 'in-app'],
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 30,
  }),
  defineType({
    typeId: 'appointment-rescheduled',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    categoryId: 'appointment-lifecycle',
    defaultChannelIds: ['in-app', 'sms'],
    sortOrder: 40,
  }),
  defineType({
    typeId: 'appointment-cancelled',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    categoryId: 'appointment-lifecycle',
    defaultChannelIds: ['sms', 'in-app'],
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 50,
  }),
  defineType({
    typeId: 'patient-checked-in',
    ownerModuleId: 'queue',
    permissionResource: 'api.queue',
    categoryId: 'patient-flow',
    defaultChannelIds: ['in-app'],
    sortOrder: 60,
  }),
  defineType({
    typeId: 'queue-position-changed',
    ownerModuleId: 'queue',
    permissionResource: 'api.queue',
    categoryId: 'patient-flow',
    defaultChannelIds: ['in-app', 'push'],
    sortOrder: 70,
  }),
  defineType({
    typeId: 'clinician-ready',
    ownerModuleId: 'queue',
    permissionResource: 'api.queue',
    categoryId: 'patient-flow',
    defaultChannelIds: ['in-app', 'push'],
    sortOrder: 80,
  }),
  defineType({
    typeId: 'laboratory-result-ready',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    categoryId: 'diagnostics-results',
    defaultChannelIds: ['in-app', 'email'],
    sensitive: true,
    redactionPolicyId: 'patient-portal-required',
    sortOrder: 90,
  }),
  defineType({
    typeId: 'imaging-result-ready',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    categoryId: 'diagnostics-results',
    defaultChannelIds: ['in-app', 'email'],
    sensitive: true,
    redactionPolicyId: 'patient-portal-required',
    sortOrder: 100,
  }),
  defineType({
    typeId: 'prescription-ready',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    categoryId: 'pharmacy',
    defaultChannelIds: ['in-app', 'sms'],
    sensitive: true,
    redactionPolicyId: 'minimum-necessary',
    sortOrder: 110,
  }),
  defineType({
    typeId: 'treatment-plan-updated',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    categoryId: 'treatment-planning',
    defaultChannelIds: ['in-app', 'email'],
    sensitive: true,
    redactionPolicyId: 'staff-secure-view',
    sortOrder: 120,
  }),
  defineType({
    typeId: 'invoice-issued',
    ownerModuleId: 'billing',
    permissionResource: 'api.billing',
    categoryId: 'billing-invoicing',
    defaultChannelIds: ['in-app', 'email'],
    sortOrder: 130,
  }),
  defineType({
    typeId: 'payment-received',
    ownerModuleId: 'billing',
    permissionResource: 'api.billing',
    categoryId: 'payments',
    defaultChannelIds: ['in-app', 'email'],
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 140,
  }),
  defineType({
    typeId: 'payment-overdue',
    ownerModuleId: 'billing',
    permissionResource: 'api.billing',
    categoryId: 'payments',
    defaultChannelIds: ['in-app', 'email', 'sms'],
    sortOrder: 150,
  }),
  defineType({
    typeId: 'stock-alert',
    ownerModuleId: 'inventory',
    permissionResource: 'api.inventory',
    categoryId: 'inventory-alerts',
    defaultChannelIds: ['in-app'],
    sortOrder: 160,
  }),
  defineType({
    typeId: 'task-assigned',
    ownerModuleId: 'workflow',
    permissionResource: 'api.workflow',
    categoryId: 'task-management',
    defaultChannelIds: ['in-app'],
    sortOrder: 170,
  }),
  defineType({
    typeId: 'approval-required',
    ownerModuleId: 'workflow',
    permissionResource: 'api.workflow',
    categoryId: 'approvals',
    defaultChannelIds: ['in-app', 'email'],
    sortOrder: 180,
  }),
  defineType({
    typeId: 'workflow-escalation',
    ownerModuleId: 'workflow',
    permissionResource: 'api.workflow',
    categoryId: 'escalations',
    defaultChannelIds: ['in-app', 'email'],
    sortOrder: 190,
  }),
  defineType({
    typeId: 'journey-follow-up-due',
    ownerModuleId: 'notifications',
    permissionResource: 'api.notifications',
    categoryId: 'journey-follow-up',
    defaultChannelIds: ['in-app', 'sms'],
    sortOrder: 200,
  }),
  defineType({
    typeId: 'journey-recall-due',
    ownerModuleId: 'notifications',
    permissionResource: 'api.notifications',
    categoryId: 'journey-recall',
    defaultChannelIds: ['in-app', 'sms', 'email'],
    sortOrder: 210,
  }),
  defineType({
    typeId: 'password-changed',
    ownerModuleId: 'userManagement',
    permissionResource: 'api.identity',
    categoryId: 'account-security',
    defaultChannelIds: ['in-app', 'email'],
    redactionPolicyId: 'lock-screen-redacted',
    sortOrder: 220,
  }),
  defineType({
    typeId: 'login-alert',
    ownerModuleId: 'userManagement',
    permissionResource: 'api.identity',
    categoryId: 'account-security',
    defaultChannelIds: ['in-app', 'email'],
    redactionPolicyId: 'lock-screen-redacted',
    runtimeImplemented: true,
    implementationStatus: 'partial',
    sortOrder: 230,
  }),
  defineType({
    typeId: 'role-changed',
    ownerModuleId: 'userManagement',
    permissionResource: 'api.identity',
    categoryId: 'role-management',
    defaultChannelIds: ['in-app', 'email'],
    sortOrder: 240,
  }),
  defineType({
    typeId: 'branch-changed',
    ownerModuleId: 'settings',
    permissionResource: 'api.settings',
    categoryId: 'branch-management',
    defaultChannelIds: ['in-app'],
    sortOrder: 250,
  }),
  defineType({
    typeId: 'license-expiring',
    ownerModuleId: 'settings',
    permissionResource: 'api.subscription',
    categoryId: 'licensing',
    defaultChannelIds: ['in-app', 'email'],
    sortOrder: 260,
  }),
  defineType({
    typeId: 'subscription-suspended',
    ownerModuleId: 'settings',
    permissionResource: 'api.subscription',
    categoryId: 'subscription-management',
    defaultChannelIds: ['in-app', 'email'],
    sortOrder: 270,
  }),
  defineType({
    typeId: 'report-ready',
    ownerModuleId: 'reporting',
    permissionResource: 'api.reporting',
    categoryId: 'reporting-exports',
    defaultChannelIds: ['in-app'],
    sortOrder: 280,
  }),
  defineType({
    typeId: 'export-ready',
    ownerModuleId: 'reporting',
    permissionResource: 'api.reporting',
    categoryId: 'reporting-exports',
    defaultChannelIds: ['in-app'],
    sortOrder: 290,
  }),
  defineType({
    typeId: 'system-maintenance',
    ownerModuleId: 'notifications',
    permissionResource: 'api.notifications',
    categoryId: 'system-health',
    defaultChannelIds: ['in-app', 'email'],
    sortOrder: 300,
  }),
  defineType({
    typeId: 'emergency-alert',
    ownerModuleId: 'notifications',
    permissionResource: 'api.notifications',
    categoryId: 'emergency',
    defaultChannelIds: ['in-app', 'sms', 'push'],
    requiresConsent: true,
    consentPolicyId: 'emergency-override',
    sortOrder: 310,
  }),
  defineType({
    typeId: 'communication-consent-changed',
    ownerModuleId: 'notifications',
    permissionResource: 'api.notifications',
    categoryId: 'consent-management',
    defaultChannelIds: ['in-app', 'email'],
    consentPolicyId: 'revocation-aware',
    sortOrder: 320,
  }),
] as const;

export const CANONICAL_NOTIFICATION_TYPE_COUNT = CANONICAL_NOTIFICATION_TYPES.length;
export const CANONICAL_NOTIFICATION_TYPE_IDS = CANONICAL_NOTIFICATION_TYPES.map((t) => t.typeId);
