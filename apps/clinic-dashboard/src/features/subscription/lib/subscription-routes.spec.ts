import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_ROUTES } from './subscription-routes';

describe('subscription-routes', () => {
  it('defines all subscription workspace routes', () => {
    expect(SUBSCRIPTION_ROUTES).toContain('/settings/subscription');
    expect(SUBSCRIPTION_ROUTES).toContain('/settings/subscription/admin');
    expect(SUBSCRIPTION_ROUTES.length).toBe(10);
  });
});
