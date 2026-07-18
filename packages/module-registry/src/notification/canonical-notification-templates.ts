import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalNotificationTemplate,
  type NotificationPhiClassification,
  type NotificationTypeId,
} from './notification-types';
import { CANONICAL_NOTIFICATION_TYPES } from './canonical-notification-types';

/** Type ids with a real, seeded EN template + wired runtime delivery path (apps/api notifications seed). */
const PUBLISHED_TYPE_IDS = new Set<NotificationTypeId>([
  'appointment-reminder',
  'appointment-cancelled',
  'payment-received',
  'login-alert',
]);

/** PHI classification per type — mirrors CanonicalNotificationType.sensitive/redactionPolicyId intent. */
const PHI_CLASSIFICATION_OVERRIDES: Partial<Record<NotificationTypeId, NotificationPhiClassification>> = {
  'laboratory-result-ready': 'phi',
  'imaging-result-ready': 'phi',
  'prescription-ready': 'phi',
  'treatment-plan-updated': 'phi',
  'password-changed': 'limited',
  'login-alert': 'limited',
  'role-changed': 'limited',
  'branch-changed': 'limited',
};

/** Common, non-secret template variables per type. Never includes credential/token-like names. */
const VARIABLE_NAME_OVERRIDES: Partial<Record<NotificationTypeId, readonly string[]>> = {
  'appointment-created': ['patientName', 'appointmentDate', 'appointmentTime'],
  'appointment-confirmed': ['patientName', 'appointmentDate', 'appointmentTime'],
  'appointment-reminder': ['patientName', 'appointmentDate', 'appointmentTime'],
  'appointment-rescheduled': ['patientName', 'oldDate', 'newDate'],
  'appointment-cancelled': ['patientName', 'appointmentDate'],
  'patient-checked-in': ['patientName', 'checkInTime'],
  'queue-position-changed': ['patientName', 'queuePosition'],
  'clinician-ready': ['patientName', 'clinicianName', 'roomLabel'],
  'laboratory-result-ready': ['patientName', 'orderReference'],
  'imaging-result-ready': ['patientName', 'orderReference'],
  'prescription-ready': ['patientName', 'pharmacyName'],
  'treatment-plan-updated': ['patientName', 'planReference'],
  'invoice-issued': ['patientName', 'invoiceNumber', 'amountTotal'],
  'payment-received': ['patientName', 'invoiceNumber', 'amountPaid'],
  'payment-overdue': ['patientName', 'invoiceNumber', 'amountDue'],
  'stock-alert': ['itemName', 'branchName', 'quantityRemaining'],
  'task-assigned': ['assigneeName', 'taskTitle'],
  'approval-required': ['requesterName', 'approvalSubject'],
  'workflow-escalation': ['workflowName', 'escalationReason'],
  'journey-follow-up-due': ['patientName', 'stageLabel'],
  'journey-recall-due': ['patientName', 'recallReason'],
  'password-changed': ['userName', 'changedAt'],
  'login-alert': ['userName', 'ipAddress', 'loginAt'],
  'role-changed': ['userName', 'newRoleLabel'],
  'branch-changed': ['userName', 'newBranchName'],
  'license-expiring': ['tenantName', 'expiryDate'],
  'subscription-suspended': ['tenantName', 'suspendedReason'],
  'report-ready': ['reportName', 'requestedBy'],
  'export-ready': ['exportName', 'requestedBy'],
  'system-maintenance': ['maintenanceWindowStart', 'maintenanceWindowEnd'],
  'emergency-alert': ['alertTitle', 'alertSummary'],
  'communication-consent-changed': ['userName', 'consentStatus'],
};

function templateForType(type: (typeof CANONICAL_NOTIFICATION_TYPES)[number]): CanonicalNotificationTemplate {
  const published = PUBLISHED_TYPE_IDS.has(type.typeId);
  return {
    templateId: `${type.typeId}-en`,
    localId: `template-${type.typeId}-en`,
    notificationKind: 'template',
    ownerModuleId: type.ownerModuleId,
    moduleId: type.ownerModuleId,
    providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY,
    typeId: type.typeId,
    locale: 'en',
    channelId: type.defaultChannelIds[0],
    publicationStatus: published ? 'published' : 'draft',
    phiClassification: PHI_CLASSIFICATION_OVERRIDES[type.typeId] ?? 'none',
    variableNames: VARIABLE_NAME_OVERRIDES[type.typeId] ?? [],
    runtimeImplemented: published,
    labelKey: `notification.template.${type.typeId}.en`,
    descriptionKey: `notification.template.${type.typeId}.en.description`,
    sortOrder: type.sortOrder,
    permissionResource: type.permissionResource,
    permissionAction: 'view',
    schemaVersion: '1',
    contributionSchemaVersion: NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
    deepLinkTemplate: `/settings/notifications/templates?type=${type.typeId}&locale=en`,
  };
}

/**
 * Canonical notification templates — Phase 41a foundation (32 templates, one EN template per
 * type, counted in ENTRY_COUNT). Zero runtime behavior: registry metadata only. No secret/credential
 * variable names are declared. publicationStatus is 'published' only where a real seeded EN
 * template + wired delivery path exists in apps/api (see PUBLISHED_TYPE_IDS); all others are 'draft'.
 */
export const CANONICAL_NOTIFICATION_TEMPLATES: readonly CanonicalNotificationTemplate[] =
  CANONICAL_NOTIFICATION_TYPES.map(templateForType);

export const CANONICAL_NOTIFICATION_TEMPLATE_COUNT = CANONICAL_NOTIFICATION_TEMPLATES.length;
export const CANONICAL_NOTIFICATION_TEMPLATE_IDS = CANONICAL_NOTIFICATION_TEMPLATES.map((t) => t.templateId);
