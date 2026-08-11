/**
 * Flexible Step 24 — Sales Leads service stack factory.
 */
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { LeadAdminService } from '../application/lead-admin.service';
import { LeadPlanFitService } from '../application/lead-plan-fit.service';
import { LeadDurableIdempotencyService } from '../application/lead-durable-idempotency.service';
import { LeadAuditLog } from '../application/lead-audit.log';
import { SALES_LEAD_PERMISSIONS } from '../platform-sales-leads.constants';

const DEFAULT_PERMS = [
  SALES_LEAD_PERMISSIONS.view,
  SALES_LEAD_PERMISSIONS.manage,
  SALES_LEAD_PERMISSIONS.assign,
];

export type SalesLeadsStack = {
  leads: LeadAdminService;
  planFit: LeadPlanFitService;
  durable: LeadDurableIdempotencyService;
  audit: LeadAuditLog;
  authz: PlatformAuthorizationService;
  perms: Set<string>;
};

export type CreateSalesLeadsStackOpts = {
  permissions?: string[];
};

function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function createSalesLeadsStack(
  prisma: PrismaClient,
  opts: CreateSalesLeadsStackOpts = {},
): SalesLeadsStack {
  const wrapped = createHybridPrisma(prisma);
  const perms = new Set(opts.permissions ?? DEFAULT_PERMS);
  const users = new PrismaPlatformUserRepository(wrapped);
  const authz = new PlatformAuthorizationService(users, wrapped);
  const durable = new LeadDurableIdempotencyService(wrapped);
  const audit = new LeadAuditLog(wrapped);
  const planFit = new LeadPlanFitService(wrapped);
  const leads = new LeadAdminService(wrapped, durable, audit, planFit);
  return { leads, planFit, durable, audit, authz, perms };
}
