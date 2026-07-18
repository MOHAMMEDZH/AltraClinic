import { PLAN_LIMITS } from '../domain/config/plan-limits.config';

describe('plan-limits.config', () => {
  it('includes smsInvites on pro and enterprise only', () => {
    expect(PLAN_LIMITS.lite.features.smsInvites).toBe(false);
    expect(PLAN_LIMITS.pro.features.smsInvites).toBe(true);
    expect(PLAN_LIMITS.enterprise.features.smsInvites).toBe(true);
  });
});
