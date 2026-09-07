/**
 * Flexible Step 26 — productivity / commission snapshot service stack factory.
 */
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { CommissionAuditLog } from '../application/commission-audit.log';
import { CommissionDurableIdempotencyService } from '../application/commission-durable-idempotency.service';
import { CommissionSnapshotService } from '../application/commission-snapshot.service';
import { ProductivityExportService } from '../application/productivity-export.service';
import { ProductivityMetricsService } from '../application/productivity-metrics.service';
import { ProductivityQueryService } from '../application/productivity-query.service';
import { SALES_PRODUCTIVITY_PERMISSIONS } from '../platform-sales-productivity.constants';

/** sales_manager-equivalent permission set (full productivity + commission governance). */
export const MANAGER_PRODUCTIVITY_PERMS = [
  SALES_PRODUCTIVITY_PERMISSIONS.reportView,
  SALES_PRODUCTIVITY_PERMISSIONS.reportExport,
  SALES_PRODUCTIVITY_PERMISSIONS.snapshotView,
  SALES_PRODUCTIVITY_PERMISSIONS.snapshotReview,
  SALES_PRODUCTIVITY_PERMISSIONS.snapshotGenerate,
  SALES_PRODUCTIVITY_PERMISSIONS.snapshotMarkPaid,
  SALES_PRODUCTIVITY_PERMISSIONS.representativeManage,
];

/** sales_representative-equivalent (own productivity/snapshot read + export only). */
export const REP_PRODUCTIVITY_PERMS = [
  SALES_PRODUCTIVITY_PERMISSIONS.reportView,
  SALES_PRODUCTIVITY_PERMISSIONS.reportExport,
  SALES_PRODUCTIVITY_PERMISSIONS.snapshotView,
];

export type SalesProductivityStack = {
  prisma: PrismaService;
  metrics: ProductivityMetricsService;
  query: ProductivityQueryService;
  export: ProductivityExportService;
  snapshots: CommissionSnapshotService;
  durable: CommissionDurableIdempotencyService;
  audit: CommissionAuditLog;
  authz: PlatformAuthorizationService;
  perms: Set<string>;
};

export type CreateSalesProductivityStackOpts = {
  permissions?: string[];
};

function hybrid(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function createSalesProductivityStack(
  prisma: PrismaClient,
  opts: CreateSalesProductivityStackOpts = {},
): SalesProductivityStack {
  const wrapped = hybrid(prisma);
  const perms = new Set(opts.permissions ?? MANAGER_PRODUCTIVITY_PERMS);
  const users = new PrismaPlatformUserRepository(wrapped);
  const authz = new PlatformAuthorizationService(users, wrapped);
  const durable = new CommissionDurableIdempotencyService(wrapped);
  const audit = new CommissionAuditLog(wrapped);
  const metrics = new ProductivityMetricsService(wrapped);
  const query = new ProductivityQueryService(wrapped, metrics);
  const exportSvc = new ProductivityExportService(wrapped, metrics, audit);
  const snapshots = new CommissionSnapshotService(wrapped, metrics, durable, audit);
  return {
    prisma: wrapped,
    metrics,
    query,
    export: exportSvc,
    snapshots,
    durable,
    audit,
    authz,
    perms,
  };
}
