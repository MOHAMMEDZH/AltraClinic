export interface TenantContextContract {
  tenantId: string;
  branchId?: string;
  environment: 'production' | 'staging' | 'sandbox';
  locale?: string;
  timezone?: string;
}
