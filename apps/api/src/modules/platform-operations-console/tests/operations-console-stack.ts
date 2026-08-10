/**
 * Flexible Step 22 — Operations Console service stack factory.
 */
import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PrismaPlatformRefreshTokenRepository } from '../../auth/infrastructure/repositories/prisma-platform-refresh-token.repository';
import { OpsQueryService } from '../application/ops-query.service';
import { OpsActionService } from '../application/ops-action.service';
import { OpsAuditLog } from '../application/ops-audit.log';
import { OpsIdempotencyService } from '../application/ops-idempotency.service';
import { OpsDurableIdempotencyService } from '../application/ops-durable-idempotency.service';
import { OpsRateLimitService } from '../application/ops-rate-limit.service';
import { OPERATIONS_CONSOLE_PERMISSIONS } from '../platform-operations-console.constants';

const DEFAULT_PERMS = [
  OPERATIONS_CONSOLE_PERMISSIONS.view,
  OPERATIONS_CONSOLE_PERMISSIONS.execute,
  OPERATIONS_CONSOLE_PERMISSIONS.backupsView,
  OPERATIONS_CONSOLE_PERMISSIONS.integrationsView,
  OPERATIONS_CONSOLE_PERMISSIONS.entitlementHealthView,
  OPERATIONS_CONSOLE_PERMISSIONS.cacheInvalidate,
  OPERATIONS_CONSOLE_PERMISSIONS.provisionView,
  OPERATIONS_CONSOLE_PERMISSIONS.provisionRetry,
];

export type OpsWebhookMock = {
  listProviders: jest.Mock;
  getQueueDiagnostics: jest.Mock;
};

export type OpsStack = {
  query: OpsQueryService;
  actions: OpsActionService;
  idempotency: OpsIdempotencyService;
  durable: OpsDurableIdempotencyService;
  rateLimit: OpsRateLimitService;
  perms: Set<string>;
  mockProvisioning: { retry: jest.Mock };
  mockEer: { invalidateTenant: jest.Mock };
  mockWebhooks?: OpsWebhookMock;
};

export type CreateOpsStackOpts = {
  permissions?: string[];
  actionRateLimit?: number;
  webhooks?: OpsWebhookMock;
};

function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function createWebhookMock(
  overrides: {
    providers?: Array<{ providerKey: string; status: string }>;
    diagnostics?: { wired: boolean; failed: number; dlq: number };
  } = {},
): OpsWebhookMock {
  return {
    listProviders: jest.fn().mockReturnValue(
      overrides.providers ?? [{ providerKey: 'test-provider', status: 'active' }],
    ),
    getQueueDiagnostics: jest.fn().mockReturnValue(
      overrides.diagnostics ?? { wired: true, failed: 0, dlq: 0 },
    ),
  };
}

export function createOpsStack(prisma: PrismaClient, opts: CreateOpsStackOpts = {}): OpsStack {
  const wrapped = createHybridPrisma(prisma);
  const perms = new Set(opts.permissions ?? DEFAULT_PERMS);
  const refreshRepo = new PrismaPlatformRefreshTokenRepository(wrapped);
  const assurance = {
    requireStepUp: (session: { isStepUpFresh: (n: number) => boolean }) => {
      if (!session.isStepUpFresh(300)) {
        throw new ForbiddenException({
          code: 'PLATFORM_STEP_UP_REQUIRED',
          message: 'Step-up verification is required for this action.',
        });
      }
    },
  } as unknown as PlatformAssuranceService;

  const mockProvisioning = {
    retry: jest.fn().mockResolvedValue({ status: 'PROVISIONING' }),
  };
  const mockEer = {
    invalidateTenant: jest.fn(),
  };

  const mockWebhooks = opts.webhooks;
  const query = new OpsQueryService(
    wrapped,
    undefined,
    undefined,
    mockEer as never,
    mockWebhooks as never,
  );
  const idempotency = new OpsIdempotencyService();
  const durable = new OpsDurableIdempotencyService(wrapped);
  const rateLimit = new OpsRateLimitService();
  if (opts.actionRateLimit != null) rateLimit.setActionLimit(opts.actionRateLimit);
  const audit = new OpsAuditLog(wrapped);
  const actions = new OpsActionService(
    wrapped,
    idempotency,
    durable,
    rateLimit,
    audit,
    query,
    assurance,
    refreshRepo,
    mockProvisioning as never,
    mockEer as never,
  );

  return {
    query,
    actions,
    idempotency,
    durable,
    rateLimit,
    perms,
    mockProvisioning,
    mockEer,
    ...(mockWebhooks ? { mockWebhooks } : {}),
  };
}
