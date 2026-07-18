import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantDbStore {
  tenantId: string;
  transactionClient: Prisma.TransactionClient;
  platformBypass: boolean;
  bypassReason?: string;
  bypassActorId?: string;
}

/**
 * Request/job-scoped tenant identity and active Prisma transaction for RLS.
 * JWT-validated tenantId is stored here by TenantDbInterceptor / TenantExecutionService.
 */
@Injectable()
export class TenantDbContextService {
  private readonly storage = new AsyncLocalStorage<TenantDbStore>();

  runWithTransaction<T>(
    tenantId: string,
    transactionClient: Prisma.TransactionClient,
    fn: () => T,
    options?: { platformBypass?: boolean; bypassReason?: string; bypassActorId?: string },
  ): T {
    const store: TenantDbStore = {
      tenantId: tenantId.trim(),
      transactionClient,
      platformBypass: options?.platformBypass ?? false,
      bypassReason: options?.bypassReason,
      bypassActorId: options?.bypassActorId,
    };
    return this.storage.run(store, fn);
  }

  async runWithTransactionAsync<T>(
    tenantId: string,
    transactionClient: Prisma.TransactionClient,
    fn: () => Promise<T>,
    options?: { platformBypass?: boolean; bypassReason?: string; bypassActorId?: string },
  ): Promise<T> {
    const store: TenantDbStore = {
      tenantId: tenantId.trim(),
      transactionClient,
      platformBypass: options?.platformBypass ?? false,
      bypassReason: options?.bypassReason,
      bypassActorId: options?.bypassActorId,
    };
    return this.storage.run(store, fn);
  }

  /** @deprecated Use getStore().tenantId */
  run<T>(tenantId: string, fn: () => T): T {
    throw new Error('TenantDbContextService.run() is deprecated — use PrismaService.withTenantContext().');
  }

  getStore(): TenantDbStore | undefined {
    return this.storage.getStore();
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  getTransactionClient(): Prisma.TransactionClient | undefined {
    return this.storage.getStore()?.transactionClient;
  }

  isPlatformBypass(): boolean {
    return this.storage.getStore()?.platformBypass === true;
  }

  requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant database context is not set for this operation.');
    }
    return tenantId;
  }

  requireTransactionClient(): Prisma.TransactionClient {
    const client = this.getTransactionClient();
    if (!client) {
      throw new ForbiddenException(
        'Tenant database transaction is not active. Operations must run inside withTenantContext().',
      );
    }
    return client;
  }
}
