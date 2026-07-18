import { TenantContextContract } from '../contracts/tenant-context.contract';

export interface TenantResolverInterface {
  resolve(context: unknown): Promise<TenantContextContract>;
}
