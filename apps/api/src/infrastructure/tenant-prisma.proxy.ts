import { PrismaClient } from '@prisma/client';
import { TenantDbContextService } from './tenant-db-context.service';

const DELEGATED_METHODS = new Set([
  '$connect',
  '$disconnect',
  '$on',
  '$use',
  '$extends',
  '$transaction',
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
]);

const PRISMA_SERVICE_METHODS = new Set([
  'withTenantContext',
  'withResolvedTenantContext',
  'withPlatformBypass',
  'getRootClient',
  'onModuleInit',
  'onModuleDestroy',
]);

/**
 * Routes Prisma model/delegate access to the active tenant transaction client when RLS context is set.
 */
export function createTenantAwarePrismaProxy(
  base: PrismaClient,
  tenantDbContext: TenantDbContextService,
): PrismaClient {
  return new Proxy(base, {
    get(target, prop, receiver) {
      const key = String(prop);

      if (PRISMA_SERVICE_METHODS.has(key)) {
        return Reflect.get(receiver, prop, receiver);
      }

      const store = tenantDbContext.getStore();

      if (store?.transactionClient) {
        return Reflect.get(store.transactionClient, prop);
      }

      if (store?.tenantId && !store.platformBypass) {
        throw new Error(
          `Tenant RLS transaction missing for model access "${key}". Use withTenantContext().`,
        );
      }

      if (DELEGATED_METHODS.has(key) || key.startsWith('_')) {
        return Reflect.get(target, prop, receiver);
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as PrismaClient;
}
