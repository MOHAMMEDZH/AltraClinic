import type { CanonicalReportCategory, CanonicalReportCategoryId } from './reporting-types';

export const CANONICAL_REPORT_CATEGORY_IDS: CanonicalReportCategoryId[] = [
  'executive',
  'patients',
  'appointments',
  'scheduling',
  'queue',
  'emr',
  'dental',
  'beauty',
  'inventory',
  'billing',
  'revenue',
  'finance',
  'commission',
  'subscriptions',
  'staff',
  'operations',
  'audit',
  'notifications',
  'platform',
  'system',
  'custom',
];

export const CANONICAL_REPORT_CATEGORIES: CanonicalReportCategory[] = CANONICAL_REPORT_CATEGORY_IDS.map(
  (categoryId, idx) => ({
    categoryId,
    categoryKey: `reports.${categoryId}`,
    labelKey: `reports.categories.${categoryId}`,
    sortOrder: idx * 10,
  }),
);

export const CANONICAL_REPORT_CATEGORY_COUNT = CANONICAL_REPORT_CATEGORIES.length;

