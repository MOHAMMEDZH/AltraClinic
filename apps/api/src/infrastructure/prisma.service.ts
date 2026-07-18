import { ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantDbContextService } from './tenant-db-context.service';

const SERVICE_METHODS = new Set([
  'withTenantContext',
  'withResolvedTenantContext',
  'withPlatformBypass',
  'getRootClient',
  'onModuleInit',
  'onModuleDestroy',
  'constructor',
]);

const ROOT_PRISMA_METHODS = new Set([
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

/**
 * NestJS-injectable Prisma client with tenant-aware RLS delegation.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  private static readonly SOFT_DELETE_MODELS = new Set([
    'Tenant',
    'Branch',
    'User',
    'Patient',
    'Appointment',
    'Encounter',
    'InventoryItem',
    'Invoice',
    'CommissionRule',
    'LoyaltyReward',
  ]);

  constructor(@Optional() private readonly tenantDbContext?: TenantDbContextService) {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [{ emit: 'stdout', level: 'query' }, { emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
          : [{ emit: 'stdout', level: 'error' }],
    });

    PrismaService.installSoftDeleteMiddleware(this);

    if (!this.tenantDbContext) {
      return;
    }

    const service = this;
    const ctx = this.tenantDbContext;

    return new Proxy(this, {
      get(target, prop, receiver) {
        const key = String(prop);

        if (SERVICE_METHODS.has(key)) {
          const val = Reflect.get(service, prop, service);
          return typeof val === 'function' ? val.bind(service) : val;
        }

        const store = ctx.getStore();
        if (store?.transactionClient && !ROOT_PRISMA_METHODS.has(key)) {
          const txVal = Reflect.get(store.transactionClient, prop);
          return typeof txVal === 'function' ? txVal.bind(store.transactionClient) : txVal;
        }

        if (store?.tenantId && !store.platformBypass && !ROOT_PRISMA_METHODS.has(key)) {
          throw new ForbiddenException(
            `Tenant RLS transaction required for Prisma access "${key}". Use withTenantContext().`,
          );
        }

        return Reflect.get(target, prop, receiver);
      },
    }) as PrismaService;
  }

  private static installSoftDeleteMiddleware(client: PrismaClient): void {
    client.$use(async (params, next) => {
      if (params.model && PrismaService.SOFT_DELETE_MODELS.has(params.model)) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst';
          params.args = params.args ?? {};
          params.args.where = { ...params.args.where, deletedAt: null };
        }
        if (params.action === 'findMany') {
          params.args = params.args ?? {};
          params.args.where = { ...params.args.where, deletedAt: null };
        }
      }
      return next(params);
    });
  }

  getRootClient(): PrismaClient {
    return this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  async withTenantContext<T>(tenantId: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    const normalized = tenantId.trim();
    if (!normalized) {
      throw new ForbiddenException('withTenantContext requires a non-empty tenantId');
    }

    const existingTx = this.tenantDbContext?.getTransactionClient();
    const existingTenant = this.tenantDbContext?.getTenantId();
    if (existingTx && existingTenant === normalized) {
      return fn(existingTx as unknown as PrismaClient);
    }
    if (existingTx && existingTenant && existingTenant !== normalized) {
      throw new ForbiddenException('Nested tenant context with a different tenantId is not allowed.');
    }

    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${normalized}, true)`;
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
      return fn(tx as unknown as PrismaClient);
    });
  }

  async withPlatformBypass<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
      return fn(tx as unknown as PrismaClient);
    });
  }

  async withResolvedTenantContext<T>(
    tenantId: string | undefined,
    fn: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    const resolved = tenantId?.trim() || this.tenantDbContext?.getTenantId();
    if (!resolved) {
      throw new ForbiddenException('Tenant context could not be resolved for database operation.');
    }
    return this.withTenantContext(resolved, fn);
  }
}

export type TenantTransactionClient = Prisma.TransactionClient;
