import { Test, TestingModule } from '@nestjs/testing';
import { CreateSubscriptionHandler } from '../application/handlers/create-subscription.handler';
import { CancelSubscriptionHandler } from '../application/handlers/cancel-subscription.handler';
import { GetSubscriptionHandler } from '../application/handlers/get-subscription.handler';
import { ListSubscriptionsHandler } from '../application/handlers/list-subscriptions.handler';
import { SUBSCRIPTION_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { InMemorySubscriptionRepository } from '../infrastructure/in-memory-subscription.repository';
import { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../contracts/tenant-context.contract';

class FakeTenantContextService {
  async resolve(): Promise<TenantContextContract> {
    return { tenantId: 'tenant-123', branchId: 'branch-1', environment: 'sandbox', locale: 'en', timezone: 'UTC' };
  }
}

class FakeEventPublisher implements EventPublisherInterface {
  async publish(): Promise<void> {
    return;
  }
}

describe('Subscription handlers', () => {
  let module: TestingModule;
  let createHandler: CreateSubscriptionHandler;
  let cancelHandler: CancelSubscriptionHandler;
  let getHandler: GetSubscriptionHandler;
  let listHandler: ListSubscriptionsHandler;
  let repository: InMemorySubscriptionRepository;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CreateSubscriptionHandler,
        CancelSubscriptionHandler,
        GetSubscriptionHandler,
        ListSubscriptionsHandler,
        { provide: SUBSCRIPTION_REPOSITORY, useClass: InMemorySubscriptionRepository },
        { provide: TenantContextService, useClass: FakeTenantContextService },
        { provide: 'EVENT_PUBLISHER', useClass: FakeEventPublisher },
      ],
    }).compile();

    createHandler = module.get(CreateSubscriptionHandler);
    cancelHandler = module.get(CancelSubscriptionHandler);
    getHandler = module.get(GetSubscriptionHandler);
    listHandler = module.get(ListSubscriptionsHandler);
    repository = module.get(SUBSCRIPTION_REPOSITORY);
  });

  it('creates and retrieves a subscription', async () => {
    const result = await createHandler.execute({
      customerId: 'customer-1',
      plan: 'standard',
      currency: 'USD',
      startDate: '2026-01-01T00:00:00Z',
      endDate: null,
      autoRenew: true,
      branchId: 'branch-1',
      createdBy: 'user-1',
    });

    expect(result.subscriptionId).toBeDefined();

    const subscription = await getHandler.execute({ subscriptionId: result.subscriptionId, branchId: 'branch-1' });
    expect(subscription.customerId).toBe('customer-1');
    expect(subscription.status).toBe('active');
  });

  it('lists subscriptions with pagination', async () => {
    await createHandler.execute({
      customerId: 'customer-1',
      plan: 'standard',
      currency: 'USD',
      startDate: '2026-01-01T00:00:00Z',
      endDate: null,
      autoRenew: true,
      branchId: 'branch-1',
      createdBy: 'user-1',
    });

    const subscriptions = await listHandler.execute({
      branchId: 'branch-1',
      customerId: null,
      status: null,
      plan: null,
      limit: 10,
      offset: 0,
    });

    expect(subscriptions.length).toBe(1);
  });

  it('cancels a subscription', async () => {
    const result = await createHandler.execute({
      customerId: 'customer-2',
      plan: 'premium',
      currency: 'USD',
      startDate: '2026-01-01T00:00:00Z',
      endDate: null,
      autoRenew: false,
      branchId: 'branch-1',
      createdBy: 'user-1',
    });

    await cancelHandler.execute({ subscriptionId: result.subscriptionId, canceledBy: 'user-2' });

    const subscription = await getHandler.execute({ subscriptionId: result.subscriptionId, branchId: 'branch-1' });
    expect(subscription.status).toBe('canceled');
  });
});
