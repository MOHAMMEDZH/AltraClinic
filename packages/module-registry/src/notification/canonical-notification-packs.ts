import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalNotificationPack,
  type NotificationTypeId,
} from './notification-types';
import type { LicensedModuleId } from '../types';

type PackInput = {
  packId: string;
  includedTypeIds: readonly NotificationTypeId[];
  sortOrder: number;
};

const OWNER_MODULE_ID: LicensedModuleId = 'notifications';

function definePack(input: PackInput): CanonicalNotificationPack {
  return {
    packId: input.packId,
    localId: `pack-${input.packId}`,
    notificationKind: 'pack',
    moduleId: OWNER_MODULE_ID,
    ownerModuleId: OWNER_MODULE_ID,
    providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY,
    includedTypeIds: input.includedTypeIds,
    version: '1.0.0',
    labelKey: `notification.pack.${input.packId}`,
    descriptionKey: `notification.pack.${input.packId}.description`,
    permissionResource: 'api.notifications',
    permissionAction: 'view',
    branchScope: 'tenant',
    deepLinkTemplate: `/settings/notifications/packs?pack=${input.packId}`,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
    contributionSchemaVersion: NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  };
}

/**
 * Canonical notification marketplace packs — Phase 41a foundation (8 packs, counted in
 * ENTRY_COUNT). Bundles of related notification types for discoverability. Owned by the
 * `notifications` module regardless of the underlying types' individual owners. Zero runtime
 * behavior.
 */
export const CANONICAL_NOTIFICATION_PACKS: readonly CanonicalNotificationPack[] = [
  definePack({
    packId: 'appointment-communications',
    includedTypeIds: [
      'appointment-created',
      'appointment-confirmed',
      'appointment-reminder',
      'appointment-rescheduled',
      'appointment-cancelled',
      'patient-checked-in',
      'queue-position-changed',
      'clinician-ready',
    ],
    sortOrder: 10,
  }),
  definePack({
    packId: 'patient-engagement',
    includedTypeIds: [
      'laboratory-result-ready',
      'imaging-result-ready',
      'prescription-ready',
      'treatment-plan-updated',
      'journey-follow-up-due',
      'journey-recall-due',
    ],
    sortOrder: 20,
  }),
  definePack({
    packId: 'billing-communications',
    includedTypeIds: ['invoice-issued', 'payment-received', 'payment-overdue'],
    sortOrder: 30,
  }),
  definePack({
    packId: 'workflow-alerts',
    includedTypeIds: ['task-assigned', 'approval-required', 'workflow-escalation', 'stock-alert'],
    sortOrder: 40,
  }),
  definePack({
    packId: 'journey-reminders',
    includedTypeIds: ['journey-follow-up-due', 'journey-recall-due'],
    sortOrder: 50,
  }),
  definePack({
    packId: 'security-alerts',
    includedTypeIds: ['password-changed', 'login-alert', 'role-changed', 'branch-changed'],
    sortOrder: 60,
  }),
  definePack({
    packId: 'subscription-alerts',
    includedTypeIds: ['license-expiring', 'subscription-suspended'],
    sortOrder: 70,
  }),
  definePack({
    packId: 'reporting-export-notifications',
    includedTypeIds: ['report-ready', 'export-ready'],
    sortOrder: 80,
  }),
] as const;

export const CANONICAL_NOTIFICATION_PACK_COUNT = CANONICAL_NOTIFICATION_PACKS.length;
export const CANONICAL_NOTIFICATION_PACK_IDS = CANONICAL_NOTIFICATION_PACKS.map((p) => p.packId);
