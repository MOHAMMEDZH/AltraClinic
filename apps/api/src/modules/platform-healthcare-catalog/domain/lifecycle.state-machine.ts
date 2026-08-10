/**
 * Release 47 Step 12 — lifecycle transition matrix.
 * RETIRED keys are never recycled. No hard-delete.
 */
export type CatalogLifecycle = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED';

const ALLOWED: Record<CatalogLifecycle, readonly CatalogLifecycle[]> = {
  DRAFT: ['ACTIVE', 'RETIRED'],
  ACTIVE: ['DEPRECATED', 'RETIRED'],
  DEPRECATED: ['ACTIVE', 'RETIRED'],
  RETIRED: ['ACTIVE'], // reactivation only — high-impact
};

export function canTransitionLifecycle(
  from: CatalogLifecycle,
  to: CatalogLifecycle,
): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function isSelectableForNewReferences(lifecycle: CatalogLifecycle): boolean {
  return lifecycle === 'ACTIVE';
}

export function isResolvableHistorically(lifecycle: CatalogLifecycle): boolean {
  return lifecycle === 'ACTIVE' || lifecycle === 'DEPRECATED' || lifecycle === 'RETIRED';
}

/** High-impact transitions that require confirmation + fresh step-up when policy applies. */
export function isHighImpactLifecycleTransition(
  from: CatalogLifecycle,
  to: CatalogLifecycle,
): boolean {
  if (!canTransitionLifecycle(from, to)) return false;
  // All allowed transitions in Step 12 are high-impact except no-op (already excluded).
  return to === 'ACTIVE' || to === 'DEPRECATED' || to === 'RETIRED';
}
