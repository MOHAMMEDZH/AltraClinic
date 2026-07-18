import type { CanonicalJourneyCategory } from './journey-types';

/** Canonical journey categories — Phase 40a foundation vocabulary. */
export const CANONICAL_JOURNEY_CATEGORIES: readonly CanonicalJourneyCategory[] = [
  { categoryId: 'acquisition', labelKey: 'journey.category.acquisition', descriptionKey: 'journey.category.acquisition.description', sortOrder: 10 },
  { categoryId: 'pre-visit', labelKey: 'journey.category.pre-visit', descriptionKey: 'journey.category.pre-visit.description', sortOrder: 20 },
  { categoryId: 'clinical', labelKey: 'journey.category.clinical', descriptionKey: 'journey.category.clinical.description', sortOrder: 30 },
  { categoryId: 'revenue', labelKey: 'journey.category.revenue', descriptionKey: 'journey.category.revenue.description', sortOrder: 40 },
  { categoryId: 'continuity', labelKey: 'journey.category.continuity', descriptionKey: 'journey.category.continuity.description', sortOrder: 50 },
  { categoryId: 'episode-closure', labelKey: 'journey.category.episode-closure', descriptionKey: 'journey.category.episode-closure.description', sortOrder: 60 },
] as const;

export const CANONICAL_JOURNEY_CATEGORY_COUNT = CANONICAL_JOURNEY_CATEGORIES.length;
export const CANONICAL_JOURNEY_CATEGORY_IDS = CANONICAL_JOURNEY_CATEGORIES.map((c) => c.categoryId);
