import { Injectable } from '@nestjs/common';
import { Subscription } from '../domain/entities/subscription.entity';
import { SubscriptionRepository, SubscriptionFilter } from '../domain/repositories/subscription.repository.interface';

@Injectable()
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly items: Subscription[] = [];

  async save(subscription: Subscription): Promise<void> {
    const index = this.items.findIndex((item) => item.id === subscription.id && item.tenantId === subscription.tenantId);
    if (index >= 0) {
      this.items[index] = subscription;
      return;
    }
    this.items.push(subscription);
  }

  async findById(subscriptionId: string, tenantId: string): Promise<Subscription | null> {
    return this.items.find((item) => item.id === subscriptionId && item.tenantId === tenantId) ?? null;
  }

  async list(filter: SubscriptionFilter): Promise<Subscription[]> {
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
    const offset = filter.offset && filter.offset >= 0 ? filter.offset : 0;

    return this.items
      .filter((item) => item.tenantId === filter.tenantId)
      .filter((item) => (filter.branchId ? item.branchId === filter.branchId : true))
      .filter((item) => (filter.customerId ? item.customerId === filter.customerId : true))
      .filter((item) => (filter.status ? item.status.value === filter.status : true))
      .filter((item) => (filter.plan ? item.plan.value === filter.plan : true))
      .slice(offset, offset + limit);
  }

  async existsByCustomerId(customerId: string, tenantId: string): Promise<boolean> {
    return this.items.some((item) => item.customerId === customerId && item.tenantId === tenantId && item.status.value === 'active');
  }
}
