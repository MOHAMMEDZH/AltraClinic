import { isForbiddenPlanKey, isValidPlanKey } from '../platform-plans.tokens';
import {
  canTransitionPlanLifecycle,
  canTransitionVersionLifecycle,
  isVersionMutable,
} from '../domain/plan-lifecycle';
import { SEED_PLANS, UNRESOLVED_PLAN_IDENTIFIERS } from '../domain/plan-seed.inventory';

describe('Platform Plans domain', () => {
  it('accepts plan.* keys and rejects invalid keys', () => {
    expect(isValidPlanKey('plan.lite')).toBe(true);
    expect(isValidPlanKey('plan.pro')).toBe(true);
    expect(isValidPlanKey('plan.enterprise')).toBe(true);
    expect(isValidPlanKey('plan.Business')).toBe(false);
    expect(isValidPlanKey('lite')).toBe(false);
    expect(isValidPlanKey('plan. lite')).toBe(false);
    expect(isForbiddenPlanKey('plan.business')).toBe(true);
  });

  it('seeds exactly three Plans; business is unresolved non-Plan (Option B), not an alias', () => {
    expect(SEED_PLANS.map((p) => p.canonicalKey).sort()).toEqual([
      'plan.enterprise',
      'plan.lite',
      'plan.pro',
    ]);
    expect(UNRESOLVED_PLAN_IDENTIFIERS.some((u) => u.value === 'business')).toBe(true);
    expect(SEED_PLANS.some((p) => p.canonicalKey === 'plan.business')).toBe(false);
    expect(
      SEED_PLANS.flatMap((p) => p.aliases).some(
        (a) => a.aliasValue === 'business' && a.sourceNamespace === 'clinic_ui_plan',
      ),
    ).toBe(false);
  });

  it('enforces Plan and Version lifecycle transitions', () => {
    expect(canTransitionPlanLifecycle('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionPlanLifecycle('ACTIVE', 'ARCHIVED')).toBe(true);
    expect(canTransitionPlanLifecycle('ARCHIVED', 'ACTIVE')).toBe(true);
    expect(canTransitionPlanLifecycle('DRAFT', 'ARCHIVED')).toBe(true);
    expect(canTransitionVersionLifecycle('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransitionVersionLifecycle('PUBLISHED', 'RETIRED')).toBe(true);
    expect(canTransitionVersionLifecycle('RETIRED', 'DRAFT')).toBe(false);
    expect(isVersionMutable('DRAFT')).toBe(true);
    expect(isVersionMutable('PUBLISHED')).toBe(false);
    expect(isVersionMutable('RETIRED')).toBe(false);
  });
});
