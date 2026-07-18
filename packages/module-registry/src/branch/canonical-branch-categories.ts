import type { CanonicalBranchCategory } from './branch-types';

export const CANONICAL_BRANCH_CATEGORIES: readonly CanonicalBranchCategory[] = [
  {
    categoryId: 'branch-identity',
    configurationCategory: 'branch-identity',
    labelKey: 'modules.branch.categories.identity',
    descriptionKey: 'modules.branch.categories.identityDesc',
    sortOrder: 10,
  },
  {
    categoryId: 'branch-address',
    configurationCategory: 'branch-address',
    labelKey: 'modules.branch.categories.address',
    descriptionKey: 'modules.branch.categories.addressDesc',
    sortOrder: 20,
  },
  {
    categoryId: 'branch-clinical',
    configurationCategory: 'branch-clinical',
    labelKey: 'modules.branch.categories.clinical',
    descriptionKey: 'modules.branch.categories.clinicalDesc',
    sortOrder: 30,
  },
  {
    categoryId: 'branch-financial',
    configurationCategory: 'branch-financial',
    labelKey: 'modules.branch.categories.financial',
    descriptionKey: 'modules.branch.categories.financialDesc',
    sortOrder: 40,
  },
  {
    categoryId: 'branch-inventory',
    configurationCategory: 'branch-inventory',
    labelKey: 'modules.branch.categories.inventory',
    descriptionKey: 'modules.branch.categories.inventoryDesc',
    sortOrder: 50,
  },
  {
    categoryId: 'branch-reporting',
    configurationCategory: 'branch-reporting',
    labelKey: 'modules.branch.categories.reporting',
    descriptionKey: 'modules.branch.categories.reportingDesc',
    sortOrder: 60,
  },
  {
    categoryId: 'branch-analytics',
    configurationCategory: 'branch-analytics',
    labelKey: 'modules.branch.categories.analytics',
    descriptionKey: 'modules.branch.categories.analyticsDesc',
    sortOrder: 70,
  },
  {
    categoryId: 'branch-white-label',
    configurationCategory: 'branch-white-label',
    labelKey: 'modules.branch.categories.whiteLabel',
    descriptionKey: 'modules.branch.categories.whiteLabelDesc',
    sortOrder: 80,
  },
] as const;

export const CANONICAL_BRANCH_CATEGORY_COUNT = CANONICAL_BRANCH_CATEGORIES.length;

export const CANONICAL_BRANCH_CATEGORY_IDS = CANONICAL_BRANCH_CATEGORIES.map((category) => category.categoryId);

export const CANONICAL_BRANCH_CATEGORY_ID_SET = new Set(CANONICAL_BRANCH_CATEGORY_IDS);

export const CANONICAL_BRANCH_CONFIGURATION_CATEGORY_IDS = CANONICAL_BRANCH_CATEGORY_IDS;

export const CANONICAL_BRANCH_CONFIGURATION_CATEGORY_ID_SET = CANONICAL_BRANCH_CATEGORY_ID_SET;
