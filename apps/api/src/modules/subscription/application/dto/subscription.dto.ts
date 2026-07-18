export interface SubscriptionDto {
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
