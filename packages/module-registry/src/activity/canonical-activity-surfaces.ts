import { CANONICAL_ACTIVITY_TYPES, CANONICAL_ACTIVITY_TYPE_COUNT } from './canonical-activity-types';
import { CANONICAL_ACTIVITY_FEEDS, CANONICAL_ACTIVITY_FEED_COUNT } from './canonical-activity-feeds';
import { CANONICAL_ACTIVITY_HUBS, CANONICAL_ACTIVITY_HUB_COUNT } from './canonical-activity-hubs';
import {
  CANONICAL_CROSS_MODULE_ACTIVITY,
  CANONICAL_CROSS_MODULE_ACTIVITY_COUNT,
} from './canonical-cross-module-activity';
import type { CanonicalActivitySurface, CanonicalActivityType } from './activity-types';

/** Aggregated contribution surfaces: types → feeds → hubs → cross-module types. */
export const CANONICAL_ACTIVITY_SURFACES: readonly CanonicalActivitySurface[] = [
  ...CANONICAL_ACTIVITY_TYPES,
  ...CANONICAL_ACTIVITY_FEEDS,
  ...CANONICAL_ACTIVITY_HUBS,
  ...CANONICAL_CROSS_MODULE_ACTIVITY,
] as const;

export const CANONICAL_ACTIVITY_SURFACE_COUNT = CANONICAL_ACTIVITY_SURFACES.length;

export const CANONICAL_ALL_ACTIVITY_TYPES: readonly CanonicalActivityType[] = [
  ...CANONICAL_ACTIVITY_TYPES,
  ...CANONICAL_CROSS_MODULE_ACTIVITY,
] as const;

export const CANONICAL_ALL_ACTIVITY_TYPE_COUNT = CANONICAL_ALL_ACTIVITY_TYPES.length;

export const CANONICAL_ACTIVITY_ENTRY_COUNT =
  CANONICAL_ACTIVITY_TYPE_COUNT +
  CANONICAL_ACTIVITY_FEED_COUNT +
  CANONICAL_ACTIVITY_HUB_COUNT +
  CANONICAL_CROSS_MODULE_ACTIVITY_COUNT;
