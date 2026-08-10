/**
 * Flexible Step 23 — Sales Representative Management service stack factory.
 */
import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformSessionRevocationService } from '../../auth/application/services/platform-session-revocation.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { PrismaPlatformRefreshTokenRepository } from '../../auth/infrastructure/repositories/prisma-platform-refresh-token.repository';
import { PlatformInvitationRepository } from '../../auth/infrastructure/repositories/prisma-platform-rbac.repositories';
import { PLATFORM_RBAC_CONFIG, type PlatformRbacConfig } from '../../auth/platform-rbac/config/platform-rbac-config';
import type { PlatformInvitationDeliveryPort } from '../../auth/infrastructure/services/platform-invitation-delivery.port';
import { SalesRepresentativeAdminService } from '../application/sales-representative-admin.service';
import { SalesCustomerOwnershipService } from '../application/sales-customer-ownership.service';
import { SalesDurableIdempotencyService } from '../application/sales-durable-idempotency.service';
import { SalesAuditLog } from '../application/sales-audit.log';
import { SALES_REP_PERMISSIONS } from '../platform-sales-representatives.constants';

const DEFAULT_PERMS = [SALES_REP_PERMISSIONS.view, SALES_REP_PERMISSIONS.manage];

const DEFAULT_RBAC_CONFIG: PlatformRbacConfig = {
  invitationTtlSeconds: 72 * 3600,
  invitationAppOrigin: 'https://admin.test.local',
  invitationResendLimit: 5,
  mfaResetTtlSeconds: 3600,
};

export type SalesStack = {
  reps: SalesRepresentativeAdminService;
  ownership: SalesCustomerOwnershipService;
  durable: SalesDurableIdempotencyService;
  audit: SalesAuditLog;
  authz: PlatformAuthorizationService;
  revocations: PlatformSessionRevocationService;
  refreshRepo: PrismaPlatformRefreshTokenRepository;
  perms: Set<string>;
  mockInvitationDelivery: { deliver: jest.Mock };
};

export type CreateSalesStackOpts = {
  permissions?: string[];
  invitationDelivery?: PlatformInvitationDeliveryPort;
};

function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function createSalesStack(prisma: PrismaClient, opts: CreateSalesStackOpts = {}): SalesStack {
  const wrapped = createHybridPrisma(prisma);
  const perms = new Set(opts.permissions ?? DEFAULT_PERMS);
  const users = new PrismaPlatformUserRepository(wrapped);
  const authz = new PlatformAuthorizationService(users, wrapped);
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
  const mockEvents = { publish: async () => undefined };
  const revocations = new PlatformSessionRevocationService(refreshRepo, mockEvents as never);
  const invitations = new PlatformInvitationRepository(wrapped);
  const mockInvitationDelivery = { deliver: jest.fn().mockResolvedValue(undefined) };
  const invitationDelivery: PlatformInvitationDeliveryPort =
    opts.invitationDelivery ?? (mockInvitationDelivery as unknown as PlatformInvitationDeliveryPort);
  const durable = new SalesDurableIdempotencyService(wrapped);
  const audit = new SalesAuditLog(wrapped);

  const reps = new SalesRepresentativeAdminService(
    wrapped,
    authz,
    assurance,
    revocations,
    refreshRepo,
    invitations,
    DEFAULT_RBAC_CONFIG,
    invitationDelivery,
    durable,
    audit,
  );
  const ownership = new SalesCustomerOwnershipService(wrapped, audit);

  return { reps, ownership, durable, audit, authz, revocations, refreshRepo, perms, mockInvitationDelivery };
}
