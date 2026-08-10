import type { PlanLifecycle, PlanVersionLifecycle } from '../platform-plans.tokens';

const PLAN_ALLOWED: Record<PlanLifecycle, readonly PlanLifecycle[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
};

const VERSION_ALLOWED: Record<PlanVersionLifecycle, readonly PlanVersionLifecycle[]> = {
  DRAFT: ['PUBLISHED', 'RETIRED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [], // clone to new Draft — never restore
};

export function canTransitionPlanLifecycle(from: PlanLifecycle, to: PlanLifecycle): boolean {
  if (from === to) return false;
  return PLAN_ALLOWED[from].includes(to);
}

export function canTransitionVersionLifecycle(
  from: PlanVersionLifecycle,
  to: PlanVersionLifecycle,
): boolean {
  if (from === to) return false;
  return VERSION_ALLOWED[from].includes(to);
}

export function isVersionMutable(lifecycle: PlanVersionLifecycle): boolean {
  return lifecycle === 'DRAFT';
}
