import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { TenantDbContextService } from './tenant-db-context.service';

export interface PlatformRlsBypassAudit {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  reason: string;
}

/**
 * Central execution boundary for tenant-scoped and audited platform-bypass DB work.
 */
@Injectable()
export class TenantExecutionService {
  private readonly logger = new Logger(TenantExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDbContext: TenantDbContextService,
  ) {}

  /** Run tenant-scoped work with PostgreSQL RLS session variable set (SET LOCAL). */
  async runAsTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.tenantDbContext.runWithTransactionAsync(tenantId, tx as never, fn);
    });
  }

  /**
   * Audited platform-operator bypass — sets app.platform_rls_bypass for cross-tenant maintenance.
   * Must never be used from normal tenant API handlers.
   */
  async runWithPlatformBypass<T>(audit: PlatformRlsBypassAudit, fn: () => Promise<T>): Promise<T> {
    this.logger.warn(
      JSON.stringify({
        event: 'platform_rls_bypass',
        actorId: audit.actorId,
        action: audit.action,
        resourceType: audit.resourceType,
        resourceId: audit.resourceId ?? null,
        reason: audit.reason,
      }),
    );

    return this.prisma.withPlatformBypass(async (tx) => {
      return this.tenantDbContext.runWithTransactionAsync(
        '__platform__',
        tx as never,
        fn,
        {
          platformBypass: true,
          bypassReason: audit.reason,
          bypassActorId: audit.actorId,
        },
      );
    });
  }

  /** Fail closed if caller expects an active tenant transaction (e.g. guard tests). */
  assertTenantTransaction(): void {
    if (!this.tenantDbContext.getTransactionClient()) {
      throw new ForbiddenException('Tenant RLS transaction is required for this operation.');
    }
  }
}
