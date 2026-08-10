/**
 * Flexible Step 22 — failure-injection matrix F01–F24 (Model B; NODE_ENV=test).
 */
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { OpsConsoleError } from '../domain/operations-console.types';
import {
  isOperationsConsoleFailureInjectionActive,
  OPERATIONS_CONSOLE_ACTIONS,
  OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS,
} from '../platform-operations-console.constants';
import { OpsRateLimitService } from '../application/ops-rate-limit.service';
import { OpsIdempotencyService } from '../application/ops-idempotency.service';
import {
  cleanupOpsConsoleTables,
  clearOpsFailureInjection,
  countOpsAudits,
  createOpsStack,
  createPlatformDbSecurityClient,
  enableOpsConsole,
  platformClaims,
  platformDbSecurityEnabled,
  setOpsFailureInjection,
} from './operations-console-db.harness';
import {
  createPlatformRefreshSession,
  createPlatformUserFixture,
} from '../../auth/tests/platform-db-security.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 22 Operations Console failure matrix F01-F24 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restore: () => void;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restore = enableOpsConsole();
  });

  afterAll(async () => {
    restore();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearOpsFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupOpsConsoleTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
  });

  afterEach(() => clearOpsFailureInjection());

  async function actor() {
    const user = await createPlatformUserFixture(prisma, {
      email: `ops-f-${randomUUID()}@test.local`,
      roleKeys: ['operations_engineer'],
    });
    const session = await createPlatformRefreshSession(prisma, user.id, {
      stepUpVerifiedAt: new Date(),
    });
    return {
      user,
      session,
      claims: platformClaims(user.id, session.sessionId),
      stack: createOpsStack(prisma),
    };
  }

  it('F01: health_adapter injection fails health query', async () => {
    const { stack } = await actor();
    setOpsFailureInjection('health_adapter');
    await expect(stack.query.health()).rejects.toMatchObject({
      code: 'source_unavailable',
      httpStatus: 503,
    });
  });

  it('F02: queue_adapter injection fails listJobs', async () => {
    const { stack } = await actor();
    setOpsFailureInjection('queue_adapter');
    await expect(stack.query.listJobs({ limit: 5 })).rejects.toMatchObject({
      code: 'source_unavailable',
      httpStatus: 503,
    });
  });

  it('F03: job_lookup injection fails job list path', async () => {
    const { stack } = await actor();
    setOpsFailureInjection('job_lookup');
    await expect(stack.query.listJobs({ limit: 5 })).rejects.toMatchObject({
      code: 'source_unavailable',
      httpStatus: 503,
    });
  });

  it('F04: backup_adapter injection fails listBackups', async () => {
    const { stack } = await actor();
    setOpsFailureInjection('backup_adapter');
    await expect(stack.query.listBackups({ limit: 5 })).rejects.toMatchObject({
      code: 'source_unavailable',
      httpStatus: 503,
    });
  });

  it('F05: integration_adapter injection fails listIntegrations', async () => {
    const { stack } = await actor();
    setOpsFailureInjection('integration_adapter');
    await expect(stack.query.listIntegrations()).rejects.toMatchObject({
      code: 'source_unavailable',
      httpStatus: 503,
    });
  });

  it('F06: entitlement_health_adapter injection fails entitlementHealth', async () => {
    const { stack } = await actor();
    setOpsFailureInjection('entitlement_health_adapter');
    await expect(stack.query.entitlementHealth()).rejects.toMatchObject({
      code: 'source_unavailable',
      httpStatus: 503,
    });
  });

  it('F07: source_state_validation injection on retry action', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('source_state_validation');
    await expect(
      stack.actions.retryProvisioning(claims, stack.perms, {
        requestId: randomUUID(),
        expectedRowVersion: 1,
        reason: 'F07',
        idempotencyKey: `f07-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: 'conflict', httpStatus: 409 });
  });

  it('F08: after_idempotency_claim injection fails before proceed', () => {
    setOpsFailureInjection('after_idempotency_claim');
    const idemp = new OpsIdempotencyService();
    expect(() => idemp.beginOrReplay('k', 'a', 'act', 't')).toThrow(OpsConsoleError);
  });

  it('F09: after_retry_request_staging injection on retry action', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('after_retry_request_staging');
    await expect(
      stack.actions.retryProvisioning(claims, stack.perms, {
        requestId: randomUUID(),
        expectedRowVersion: 1,
        reason: 'F09',
        idempotencyKey: `f09-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY)).toBe(0);
  });

  it('F10: after_audit_staging_before_commit injection rolls back audit', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('after_audit_staging_before_commit');
    await expect(
      stack.actions.invalidateEntitlementCache(claims, stack.perms, {
        tenantId: randomUUID(),
        reason: 'F10',
        idempotencyKey: `f10-${randomUUID()}`,
        confirmation: 'INVALIDATE',
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE)).toBe(0);
  });

  it('F11: before_commit injection on retry action', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('before_commit');
    await expect(
      stack.actions.retryProvisioning(claims, stack.perms, {
        requestId: randomUUID(),
        expectedRowVersion: 1,
        reason: 'F11',
        idempotencyKey: `f11-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY)).toBe(0);
  });

  it('F12: after_commit_before_response injection after successful retry commit', async () => {
    const { stack, claims } = await actor();
    setOpsFailureInjection('after_commit_before_response');
    await expect(
      stack.actions.retryProvisioning(claims, stack.perms, {
        requestId: randomUUID(),
        expectedRowVersion: 1,
        reason: 'F12',
        idempotencyKey: `f12-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY)).toBe(1);
  });

  it('F13: source_retry_service injection on retry action', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('source_retry_service');
    await expect(
      stack.actions.retryProvisioning(claims, stack.perms, {
        requestId: randomUUID(),
        expectedRowVersion: 1,
        reason: 'F13',
        idempotencyKey: `f13-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F14: cache_invalidation injection on invalidate action', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('cache_invalidation');
    await expect(
      stack.actions.invalidateEntitlementCache(claims, stack.perms, {
        tenantId: randomUUID(),
        reason: 'F14',
        idempotencyKey: `f14-${randomUUID()}`,
        confirmation: 'INVALIDATE',
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F15: provisioning_retry injection on retry action', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('provisioning_retry');
    await expect(
      stack.actions.retryProvisioning(claims, stack.perms, {
        requestId: randomUUID(),
        expectedRowVersion: 1,
        reason: 'F15',
        idempotencyKey: `f15-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F16 Not Applicable — no subscription_expiry_retry action in Step 22', () => {
    expect(isOperationsConsoleFailureInjectionActive('subscription_expiry_retry')).toBe(false);
    clearOpsFailureInjection();
    setOpsFailureInjection('subscription_expiry_retry');
    expect(isOperationsConsoleFailureInjectionActive('subscription_expiry_retry')).toBe(true);
  });

  it('F17 Not Applicable — no override_expiry_retry action in Step 22', () => {
    expect(true).toBe(true);
  });

  it('F18 Not Applicable — no compatibility_rerun action in Step 22', () => {
    expect(true).toBe(true);
  });

  it('F19 Not Applicable — no backup_request action in Step 22', () => {
    expect(true).toBe(true);
  });

  it('F20: service_recreation injection point registered (no runtime hook in Step 22)', () => {
    process.env.NODE_ENV = 'test';
    setOpsFailureInjection('service_recreation');
    expect(isOperationsConsoleFailureInjectionActive('service_recreation')).toBe(true);
    clearOpsFailureInjection();
  });

  it('F21: rate_limit_adapter injects 429', () => {
    setOpsFailureInjection('rate_limit_adapter');
    const rl = new OpsRateLimitService();
    expect(() => rl.assertAllowed('a', 'x')).toThrow(OpsConsoleError);
  });

  it('F22: step_up_validation injection denies action before source call', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('step_up_validation');
    await expect(
      stack.actions.invalidateEntitlementCache(claims, stack.perms, {
        tenantId: randomUUID(),
        reason: 'F22',
        idempotencyKey: `f22-${randomUUID()}`,
        confirmation: 'INVALIDATE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(stack.mockEer.invalidateTenant).not.toHaveBeenCalled();
  });

  it('F23: redaction injection fails audit staging on action', async () => {
    const { stack, claims, session } = await actor();
    setOpsFailureInjection('redaction');
    await expect(
      stack.actions.invalidateEntitlementCache(claims, stack.perms, {
        tenantId: randomUUID(),
        reason: 'F23',
        idempotencyKey: `f23-${randomUUID()}`,
        confirmation: 'INVALIDATE',
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
  });

  /**
   * F24-B NOT APPLICABLE — Step 22 owns no rollback/recovery compensation path.
   * Material actions: provisioning retry (D-A source + D-B ops claim) and cache invalidate (D-B).
   * Rollback/recovery for provisioning is owned by Step 17 TenantProvisioningService.
   * Cache invalidate is effect-idempotent local Map clear with no compensating transaction.
   * Other F cases cover source/adapter/audit/idempotency failures; do not conflate with hook containment.
   */
  it('F24 Not Applicable — Step 22 owns no rollback/recovery compensation path', () => {
    const materialActions = [
      OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY,
      OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE,
    ];
    expect(materialActions).toHaveLength(2);
    expect(OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS).toContain('rollback_recovery');
    // Hook exists for registry completeness only — activating it does not exercise a Step 22 compensator.
    process.env.NODE_ENV = 'test';
    setOpsFailureInjection('rollback_recovery');
    expect(isOperationsConsoleFailureInjectionActive('rollback_recovery')).toBe(true);
    clearOpsFailureInjection();
  });
});

describe('Step 22 hook containment (separate from F24)', () => {
  afterEach(() => clearOpsFailureInjection());

  it('HOOK01: NODE_ENV !== test -> injection impossible', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    for (const point of OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS) {
      setOpsFailureInjection(point);
      expect(isOperationsConsoleFailureInjectionActive(point)).toBe(false);
    }
    process.env.NODE_ENV = prev;
    clearOpsFailureInjection();
  });

  it('HOOK02: missing selector -> inactive', () => {
    process.env.NODE_ENV = 'test';
    clearOpsFailureInjection();
    expect(isOperationsConsoleFailureInjectionActive('health_adapter')).toBe(false);
  });

  it('HOOK03: invalid selector -> inactive', () => {
    process.env.NODE_ENV = 'test';
    setOpsFailureInjection('not_a_real_injection_point');
    expect(isOperationsConsoleFailureInjectionActive('health_adapter')).toBe(false);
    expect(isOperationsConsoleFailureInjectionActive('not_a_real_injection_point' as never)).toBe(
      false,
    );
  });

  it('HOOK04: NODE_ENV=test + exact selector -> selected hook only', () => {
    process.env.NODE_ENV = 'test';
    for (const point of OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS) {
      setOpsFailureInjection(point);
      expect(isOperationsConsoleFailureInjectionActive(point)).toBe(true);
      for (const other of OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS) {
        if (other !== point) {
          expect(isOperationsConsoleFailureInjectionActive(other)).toBe(false);
        }
      }
      clearOpsFailureInjection();
    }
  });
});

describe('Step 22 Operations Console failure unit hooks (always run)', () => {
  afterEach(() => clearOpsFailureInjection());

  it('F08 unit: after_idempotency_claim', () => {
    process.env.NODE_ENV = 'test';
    setOpsFailureInjection('after_idempotency_claim');
    const idemp = new OpsIdempotencyService();
    expect(() => idemp.beginOrReplay('k', 'a', 'act', 't')).toThrow(OpsConsoleError);
  });

  it('F21 unit: rate_limit_adapter', () => {
    process.env.NODE_ENV = 'test';
    setOpsFailureInjection('rate_limit_adapter');
    const rl = new OpsRateLimitService();
    expect(() => rl.assertAllowed('a', 'x')).toThrow(OpsConsoleError);
  });

  it('hooks inactive when NODE_ENV !== test', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    setOpsFailureInjection('health_adapter');
    expect(isOperationsConsoleFailureInjectionActive('health_adapter')).toBe(false);
    process.env.NODE_ENV = prev;
    clearOpsFailureInjection();
  });
});
