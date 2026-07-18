import type { CanonicalNotificationCategory, NotificationCategoryId } from './notification-types';
import type { LicensedModuleId } from '../types';

type CategoryInput = {
  categoryId: NotificationCategoryId;
  ownerModuleId: LicensedModuleId;
  sortOrder: number;
};

function defineCategory(input: CategoryInput): CanonicalNotificationCategory {
  return {
    categoryId: input.categoryId,
    ownerModuleId: input.ownerModuleId,
    labelKey: `notification.category.${input.categoryId}`,
    descriptionKey: `notification.category.${input.categoryId}.description`,
    sortOrder: input.sortOrder,
  };
}

/**
 * Canonical notification categories — Phase 41a foundation vocabulary (24 categories).
 * Vocabulary-only taxonomy referenced by CanonicalNotificationType.categoryId — not itself
 * a contribution kind and not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT (mirrors journey
 * category treatment in Phase 40a).
 */
export const CANONICAL_NOTIFICATION_CATEGORIES: readonly CanonicalNotificationCategory[] = [
  defineCategory({ categoryId: 'appointment-lifecycle', ownerModuleId: 'scheduling', sortOrder: 10 }),
  defineCategory({ categoryId: 'appointment-reminders', ownerModuleId: 'scheduling', sortOrder: 20 }),
  defineCategory({ categoryId: 'patient-flow', ownerModuleId: 'queue', sortOrder: 30 }),
  defineCategory({ categoryId: 'diagnostics-results', ownerModuleId: 'emr', sortOrder: 40 }),
  defineCategory({ categoryId: 'pharmacy', ownerModuleId: 'emr', sortOrder: 50 }),
  defineCategory({ categoryId: 'treatment-planning', ownerModuleId: 'emr', sortOrder: 60 }),
  defineCategory({ categoryId: 'billing-invoicing', ownerModuleId: 'billing', sortOrder: 70 }),
  defineCategory({ categoryId: 'payments', ownerModuleId: 'billing', sortOrder: 80 }),
  defineCategory({ categoryId: 'inventory-alerts', ownerModuleId: 'inventory', sortOrder: 90 }),
  defineCategory({ categoryId: 'task-management', ownerModuleId: 'workflow', sortOrder: 100 }),
  defineCategory({ categoryId: 'approvals', ownerModuleId: 'workflow', sortOrder: 110 }),
  defineCategory({ categoryId: 'escalations', ownerModuleId: 'workflow', sortOrder: 120 }),
  defineCategory({ categoryId: 'journey-follow-up', ownerModuleId: 'notifications', sortOrder: 130 }),
  defineCategory({ categoryId: 'journey-recall', ownerModuleId: 'notifications', sortOrder: 140 }),
  defineCategory({ categoryId: 'account-security', ownerModuleId: 'userManagement', sortOrder: 150 }),
  defineCategory({ categoryId: 'role-management', ownerModuleId: 'userManagement', sortOrder: 160 }),
  defineCategory({ categoryId: 'branch-management', ownerModuleId: 'settings', sortOrder: 170 }),
  defineCategory({ categoryId: 'licensing', ownerModuleId: 'settings', sortOrder: 180 }),
  defineCategory({ categoryId: 'subscription-management', ownerModuleId: 'settings', sortOrder: 190 }),
  defineCategory({ categoryId: 'reporting-exports', ownerModuleId: 'reporting', sortOrder: 200 }),
  defineCategory({ categoryId: 'system-health', ownerModuleId: 'notifications', sortOrder: 210 }),
  defineCategory({ categoryId: 'emergency', ownerModuleId: 'notifications', sortOrder: 220 }),
  defineCategory({ categoryId: 'consent-management', ownerModuleId: 'notifications', sortOrder: 230 }),
  defineCategory({ categoryId: 'marketing-promotions', ownerModuleId: 'notifications', sortOrder: 240 }),
] as const;

export const CANONICAL_NOTIFICATION_CATEGORY_COUNT = CANONICAL_NOTIFICATION_CATEGORIES.length;
export const CANONICAL_NOTIFICATION_CATEGORY_IDS = CANONICAL_NOTIFICATION_CATEGORIES.map((c) => c.categoryId);
