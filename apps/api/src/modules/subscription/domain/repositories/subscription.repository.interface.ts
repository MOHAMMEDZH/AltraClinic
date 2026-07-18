import { Subscription } from '../entities/subscription.entity';

export interface SubscriptionFilter {
  tenantId: string;
  branchId?: string | null;
  customerId?: string | null;
  status?: string | null;
  plan?: string | null;
  limit?: number;
  offset?: number;
}

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findById(subscriptionId: string, tenantId: string): Promise<Subscription | null>;
  list(filter: SubscriptionFilter): Promise<Subscription[]>;
  existsByCustomerId(customerId: string, tenantId: string): Promise<boolean>;
}
