export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionRecord {
  subscriptionId: string;
  tenantId: string;
  branchId: string | null;
  customerId: string;
  plan: string;
  status: string;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  currency: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionCreateInput {
  customerId: string;
  plan: string;
  currency: string;
  startDate: string;
  endDate?: string | null;
  autoRenew?: boolean;
  branchId?: string | null;
}

export interface SubscriptionUsageSnapshot {
  activeUsers: number;
  queueDepth: number;
  totalPatients: number;
  lowStockCount: number;
  appointmentsToday: number;
  aiMessagesToday: number;
  aiTokensToday: number;
}

export interface PlanCatalogRow {
  id: 'starter' | 'professional' | 'business' | 'enterprise';
  monthlyPrice: number;
  annualPrice: number;
  users: number | 'unlimited';
  branches: number | 'unlimited';
  storageGb: number | 'unlimited';
  includes: string[];
}

export interface PlatformTenantListItem {
  platformTenantId: string;
  tenantId: string;
  displayName: string;
  plan: string;
  status: string;
  updatedAt: string;
  planLimits: {
    maxBranches: number | null;
    maxUsers: number | null;
  };
}
