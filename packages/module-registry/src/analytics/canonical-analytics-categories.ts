import type { AnalyticsCategoryId } from './analytics-types';

export interface CanonicalAnalyticsCategory {
  categoryId: AnalyticsCategoryId;
  labelKey: string;
  sortOrder: number;
}

export const CANONICAL_ANALYTICS_CATEGORIES: readonly CanonicalAnalyticsCategory[] = [
  { categoryId: 'executive', labelKey: 'analytics.domains.executive.title', sortOrder: 0 },
  { categoryId: 'financial', labelKey: 'analytics.domains.financial.title', sortOrder: 10 },
  { categoryId: 'patients', labelKey: 'analytics.domains.patients.title', sortOrder: 20 },
  { categoryId: 'operations', labelKey: 'analytics.domains.operations.title', sortOrder: 30 },
  { categoryId: 'inventory', labelKey: 'analytics.domains.inventory.title', sortOrder: 40 },
  { categoryId: 'clinical', labelKey: 'analytics.domains.clinical.title', sortOrder: 50 },
  { categoryId: 'dental', labelKey: 'analytics.domains.dental.title', sortOrder: 60 },
  { categoryId: 'beauty', labelKey: 'analytics.domains.beauty.title', sortOrder: 70 },
  { categoryId: 'staff', labelKey: 'analytics.domains.staff.title', sortOrder: 80 },
  { categoryId: 'branches', labelKey: 'analytics.domains.branches.title', sortOrder: 90 },
  { categoryId: 'forecasting', labelKey: 'analytics.domains.forecasting.title', sortOrder: 100 },
  { categoryId: 'platform', labelKey: 'nav.analytics', sortOrder: 110 },
  { categoryId: 'platform.analytics', labelKey: 'nav.analytics', sortOrder: 120 },
  { categoryId: 'platform.builder', labelKey: 'analytics.builder.title', sortOrder: 130 },
  { categoryId: 'platform.export', labelKey: 'analytics.export.title', sortOrder: 140 },
] as const;

export const CANONICAL_ANALYTICS_CATEGORY_IDS = CANONICAL_ANALYTICS_CATEGORIES.map(
  (category) => category.categoryId,
);

export const CANONICAL_ANALYTICS_CATEGORY_COUNT = CANONICAL_ANALYTICS_CATEGORIES.length;
