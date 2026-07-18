import { normalizeEntitlementPlan } from '../value-objects/entitlement-plan';

describe('entitlement-plan aliases', () => {
  it('accepts prisma and legacy plan names', () => {
    expect(normalizeEntitlementPlan('LITE')).toBe('starter');
    expect(normalizeEntitlementPlan('lite')).toBe('starter');
    expect(normalizeEntitlementPlan('pro')).toBe('growth');
    expect(normalizeEntitlementPlan('PRO')).toBe('growth');
    expect(normalizeEntitlementPlan('professional')).toBe('growth');
    expect(normalizeEntitlementPlan('enterprise')).toBe('enterprise');
  });
});
