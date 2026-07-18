import { Subscription } from '../domain/entities/subscription.entity';
import { SubscriptionPlanVO } from '../domain/value-objects/subscription-plan.vo';
import { SubscriptionStatusVO } from '../domain/value-objects/subscription-status.vo';
import { SubscriptionDomainError } from '../domain/exceptions/subscription-domain.exception';

describe('Subscription aggregate', () => {
  it('creates a subscription successfully', () => {
    const subscription = Subscription.create({
      tenantId: 'tenant-123',
      branchId: 'branch-1',
      customerId: 'customer-1',
      plan: { value: 'standard' as SubscriptionPlanVO['value'] },
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: null,
      autoRenew: true,
      currency: 'USD',
      createdBy: 'user-1',
    });

    expect(subscription.id).toBeDefined();
    expect(subscription.status.value).toBe('active');
    // 'standard' is a legacy alias for 'pro' — VO normalises on construction
    expect(subscription.plan.value).toBe('pro');
  });

  it('throws when creating with missing customerId', () => {
    expect(() =>
      Subscription.create({
        tenantId: 'tenant-123',
        branchId: null,
        customerId: '',
        plan: { value: 'basic' as SubscriptionPlanVO['value'] },
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: null,
        autoRenew: false,
        currency: 'USD',
        createdBy: 'user-1',
      }),
    ).toThrow(SubscriptionDomainError);
  });

  it('cancels an active subscription', () => {
    const subscription = Subscription.create({
      tenantId: 'tenant-123',
      branchId: null,
      customerId: 'customer-1',
      plan: { value: 'basic' as SubscriptionPlanVO['value'] },
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: null,
      autoRenew: true,
      currency: 'USD',
      createdBy: 'user-1',
    });

    subscription.cancel('user-2');

    expect(subscription.status.value).toBe('canceled');
    expect(subscription.endDate).toBeDefined();
  });

  it('throws when canceling an already canceled subscription', () => {
    const subscription = Subscription.create({
      tenantId: 'tenant-123',
      branchId: null,
      customerId: 'customer-1',
      plan: { value: 'basic' as SubscriptionPlanVO['value'] },
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: null,
      autoRenew: true,
      currency: 'USD',
      createdBy: 'user-1',
    });

    subscription.cancel('user-2');
    expect(() => subscription.cancel('user-3')).toThrow(SubscriptionDomainError);
  });
});
