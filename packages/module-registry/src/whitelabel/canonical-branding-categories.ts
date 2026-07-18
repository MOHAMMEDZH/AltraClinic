import type { CanonicalBrandingCategory } from './white-label-types';

export const CANONICAL_BRANDING_CATEGORIES: readonly CanonicalBrandingCategory[] = [
  {
    categoryId: 'core-branding',
    labelKey: 'whitelabel.categories.core',
    descriptionKey: 'whitelabel.categories.coreDesc',
    sortOrder: 10,
  },
  {
    categoryId: 'advanced-theme',
    labelKey: 'whitelabel.categories.advancedTheme',
    descriptionKey: 'whitelabel.categories.advancedThemeDesc',
    sortOrder: 20,
  },
  {
    categoryId: 'identity-domain',
    labelKey: 'whitelabel.categories.identity',
    descriptionKey: 'whitelabel.categories.identityDesc',
    sortOrder: 30,
  },
  {
    categoryId: 'delivery-surfaces',
    labelKey: 'whitelabel.categories.delivery',
    descriptionKey: 'whitelabel.categories.deliveryDesc',
    sortOrder: 40,
  },
] as const;

export const CANONICAL_BRANDING_CATEGORY_COUNT = CANONICAL_BRANDING_CATEGORIES.length;

export const CANONICAL_BRANDING_CATEGORY_IDS = CANONICAL_BRANDING_CATEGORIES.map((category) => category.categoryId);

export const CANONICAL_BRANDING_CATEGORY_ID_SET = new Set(CANONICAL_BRANDING_CATEGORY_IDS);
