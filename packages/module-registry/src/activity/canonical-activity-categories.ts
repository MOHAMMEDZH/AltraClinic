import type { CanonicalActivityCategory } from './activity-types';

/** Canonical activity categories — SSOT Phase 38 §6. */
export const CANONICAL_ACTIVITY_CATEGORIES: readonly CanonicalActivityCategory[] = [
  {
    categoryId: 'clinical',
    labelKey: 'activity.category.clinical',
    descriptionKey: 'activity.category.clinical.description',
    sortOrder: 10,
  },
  {
    categoryId: 'financial',
    labelKey: 'activity.category.financial',
    descriptionKey: 'activity.category.financial.description',
    sortOrder: 20,
  },
  {
    categoryId: 'operational',
    labelKey: 'activity.category.operational',
    descriptionKey: 'activity.category.operational.description',
    sortOrder: 30,
  },
  {
    categoryId: 'administrative',
    labelKey: 'activity.category.administrative',
    descriptionKey: 'activity.category.administrative.description',
    sortOrder: 40,
  },
  {
    categoryId: 'security',
    labelKey: 'activity.category.security',
    descriptionKey: 'activity.category.security.description',
    sortOrder: 50,
  },
  {
    categoryId: 'licensing',
    labelKey: 'activity.category.licensing',
    descriptionKey: 'activity.category.licensing.description',
    sortOrder: 60,
  },
  {
    categoryId: 'inventory',
    labelKey: 'activity.category.inventory',
    descriptionKey: 'activity.category.inventory.description',
    sortOrder: 70,
  },
  {
    categoryId: 'communication',
    labelKey: 'activity.category.communication',
    descriptionKey: 'activity.category.communication.description',
    sortOrder: 80,
  },
  {
    categoryId: 'workflow',
    labelKey: 'activity.category.workflow',
    descriptionKey: 'activity.category.workflow.description',
    sortOrder: 90,
  },
  {
    categoryId: 'ai',
    labelKey: 'activity.category.ai',
    descriptionKey: 'activity.category.ai.description',
    sortOrder: 100,
  },
  {
    categoryId: 'system',
    labelKey: 'activity.category.system',
    descriptionKey: 'activity.category.system.description',
    sortOrder: 110,
  },
  {
    categoryId: 'branch',
    labelKey: 'activity.category.branch',
    descriptionKey: 'activity.category.branch.description',
    sortOrder: 120,
  },
  {
    categoryId: 'branding',
    labelKey: 'activity.category.branding',
    descriptionKey: 'activity.category.branding.description',
    sortOrder: 130,
  },
  {
    categoryId: 'other',
    labelKey: 'activity.category.other',
    descriptionKey: 'activity.category.other.description',
    sortOrder: 999,
  },
] as const;

export const CANONICAL_ACTIVITY_CATEGORY_COUNT = CANONICAL_ACTIVITY_CATEGORIES.length;

export const CANONICAL_ACTIVITY_CATEGORY_IDS = CANONICAL_ACTIVITY_CATEGORIES.map((c) => c.categoryId);
