/**
 * Flexible Step 19 — PostgreSQL test harness.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { LifecycleIdempotencyService } from '../application/lifecycle-idempotency.service';
import { TenantLifecycleAuditLog } from '../application/tenant-lifecycle-audit.log';
import { TenantLifecyclePreviewService } from '../application/tenant-lifecycle-preview.service';
import { TenantLifecycleRateLimitService } from '../application/tenant-lifecycle-rate-limit.service';
import { TenantLifecycleService } from '../application/tenant-lifecycle.service';
import { LIFECYCLE_PERMISSIONS } from '../tenant-lifecycle.constants';
import { LIFECYCLE_FAILURE_INJECTION_ENV } from '../domain/tenant-lifecycle.types';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  LIFECYCLE_FAILURE_INJECTION_ENV,
};

export const ALL_LIFECYCLE_PERMS = Object.values(LIFECYCLE_PERMISSIONS);

export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function enableLifecycleFlag(): () => void {
  const prev = process.env.TENANT_LIFECYCLE_ENABLED;
  process.env.TENANT_LIFECYCLE_ENABLED = 'true';
  return () => {
    if (prev === undefined) delete process.env.TENANT_LIFECYCLE_ENABLED;
    else process.env.TENANT_LIFECYCLE_ENABLED = prev;
  };
}

export function disableLifecycleFlag(): () => void {
  const prev = process.env.TENANT_LIFECYCLE_ENABLED;
  process.env.TENANT_LIFECYCLE_ENABLED = 'false';
  return () => {
    if (prev === undefined) delete process.env.TENANT_LIFECYCLE_ENABLED;
    else process.env.TENANT_LIFECYCLE_ENABLED = prev;
  };
}

export function clearLifecycleFailureInjection(): void {
  delete process.env[LIFECYCLE_FAILURE_INJECTION_ENV];
}

export function setLifecycleFailureInjection(point: string): void {
  process.env[LIFECYCLE_FAILURE_INJECTION_ENV] = point;
}

export function platformClaims(sub: string, sessionId: string): JwtClaimsVO {
  return new JwtClaimsVO({
    sub,
    tenantId: null,
    branchId: null,
    roles: [],
    sessionId,
    sessionClass: 'platform',
    principalType: 'platform',
    aud: PLATFORM_TOKEN_AUDIENCE,
    iss: 'booking-platform',
  });
}

export async function cleanupLifecycleTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_tenant_lifecycle_idempotency",
      "platform_tenant_lifecycle_requests"
    RESTART IDENTITY CASCADE
  `);
}

export async function seedClinicTenant(
  prisma: PrismaClient,
  opts: {
    status?: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
    displayName?: string;
    slug?: string;
  } = {},
) {
  const tenantId = randomUUID();
  const slug = opts.slug ?? `lc-${tenantId.slice(0, 8)}`;
  const displayName = opts.displayName ?? `Lifecycle Clinic ${slug}`;
  const status = opts.status ?? 'ACTIVE';
  const clinicStatus =
    status === 'PROVISIONING' ? 'ACTIVE' : status === 'ARCHIVED' ? 'ARCHIVED' : status;
  const lifecycleStatus =
    status === 'PROVISIONING' ? 'TRIAL' : (status as 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED');
  await prisma.tenant.create({
    data: {
      id: tenantId,
      name: displayName,
      slug,
      status: clinicStatus,
      lifecycleStatus,
      timezone: 'UTC',
      locale: 'en-US',
      features: {},
    },
  });
  const pt = await prisma.platformTenant.create({
    data: {
      tenantId,
      displayName,
      region: 'ME_SOUTH',
      plan: 'PRO',
      status,
      rowVersion: 1,
      provisionedBy: randomUUID(),
      activatedAt: status === 'ACTIVE' || status === 'SUSPENDED' ? new Date() : null,
      suspendedAt: status === 'SUSPENDED' ? new Date() : null,
      suspensionReason: status === 'SUSPENDED' ? 'seed' : null,
      archivedAt: status === 'ARCHIVED' ? new Date() : null,
      archivedReason: status === 'ARCHIVED' ? 'seed' : null,
    },
  });
  return { tenantId, platformTenant: pt, displayName, slug };
}

export type LifecycleStack = {
  service: TenantLifecycleService;
  permissions: Set<string>;
  revokedTenantIds: string[];
  publishedEvents: unknown[];
  eerCalls: { invalidate: string[]; resolve: string[] };
  rateLimit: TenantLifecycleRateLimitService;
  setEerSource: (source: string) => void;
  setStepUpFresh: (fresh: boolean) => void;
  setFailSessionRevoke: (fail: boolean) => void;
  wrapped: PrismaService;
};

export function createLifecycleStack(
  prisma: PrismaClient,
  opts: {
    permissions?: string[];
    stepUpFresh?: boolean;
    eerSource?: string;
    failSessionRevoke?: boolean;
  } = {},
): LifecycleStack {
  const wrapped = createHybridPrisma(prisma);
  const permissions = new Set(opts.permissions ?? ALL_LIFECYCLE_PERMS);
  let stepUpFresh = opts.stepUpFresh !== false;
  let eerSource = opts.eerSource ?? 'SNAPSHOT';
  let failSessionRevoke = opts.failSessionRevoke === true;
  const revokedTenantIds: string[] = [];
  const publishedEvents: unknown[] = [];
  const eerCalls = { invalidate: [] as string[], resolve: [] as string[] };
  const rateLimit = new TenantLifecycleRateLimitService();

  const authz = {
    assertPermission: async (_claims: JwtClaimsVO, key: string) => {
      if (!permissions.has(key)) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException(`Missing ${key}`);
      }
    },
    resolveEffectivePermissions: async () => [...permissions],
  };

  const assurance = {
    requireStepUp: () => {
      if (!stepUpFresh) {
        const { ForbiddenException } = require('@nestjs/common');
        throw new ForbiddenException({
          code: 'PLATFORM_STEP_UP_REQUIRED',
          message: 'Step-up verification is required for this action.',
        });
      }
    },
  };

  const platformSessions = {
    findBySessionId: async (sessionId: string) =>
      sessionId
        ? {
            sessionId,
            stepUpVerifiedAt: stepUpFresh ? new Date() : null,
          }
        : null,
  };

  const clinicSessions = {
    revokeAllByTenantId: async (tenantId: string) => {
      if (failSessionRevoke) {
        throw new Error('simulated session revocation adapter failure');
      }
      revokedTenantIds.push(tenantId);
      await prisma.refreshToken.updateMany({
        where: { tenantId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return 1;
    },
  };

  const eer = {
    invalidateTenant: async (tenantId: string) => {
      eerCalls.invalidate.push(tenantId);
    },
    resolveEffectiveEntitlements: async (tenantId: string) => {
      eerCalls.resolve.push(tenantId);
      return { source: eerSource, tenantId, modules: [], features: [], limits: [] };
    },
  };

  const events = {
    publish: async (event: unknown) => {
      publishedEvents.push(event);
    },
  };

  const service = new TenantLifecycleService(
    wrapped,
    authz as never,
    assurance as never,
    platformSessions as never,
    clinicSessions as never,
    eer as never,
    events as never,
    new LifecycleIdempotencyService(wrapped),
    new TenantLifecycleAuditLog(wrapped),
    new TenantLifecyclePreviewService(wrapped),
    rateLimit,
  );

  return {
    service,
    permissions,
    revokedTenantIds,
    publishedEvents,
    eerCalls,
    rateLimit,
    setEerSource: (source: string) => {
      eerSource = source;
    },
    setStepUpFresh: (fresh: boolean) => {
      stepUpFresh = fresh;
    },
    setFailSessionRevoke: (fail: boolean) => {
      failSessionRevoke = fail;
    },
    wrapped,
  };
}

export async function previewAndBody(
  stack: LifecycleStack,
  claims: JwtClaimsVO,
  tenantId: string,
  action: 'activate' | 'suspend' | 'reactivate' | 'archive_request' | 'deletion_request',
  rowVersion: number,
  extra: { reason?: string; typedConfirmation?: string } = {},
) {
  const preview = await stack.service.preview(claims, tenantId, action);
  return {
    preview,
    body: {
      expectedRowVersion: rowVersion,
      reason: extra.reason ?? `${action} test reason`,
      previewFingerprint: preview.previewFingerprint,
      typedConfirmation: extra.typedConfirmation,
    },
  };
}
