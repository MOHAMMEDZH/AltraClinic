/**
 * Flexible Step 22 — durable idempotency matrix IDEM01–IDEM16 (PostgreSQL).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { OpsConsoleError } from '../domain/operations-console.types';
import { OPERATIONS_CONSOLE_ACTIONS } from '../platform-operations-console.constants';
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

async function countDurableRows(
  prisma: PrismaClient,
  operation: string,
  idempotencyKey: string,
  actorId?: string,
): Promise<number> {
  return prisma.platformOperationsIdempotencyRecord.count({
    where: {
      operation,
      idempotencyKey,
      status: 'completed',
      ...(actorId ? { actorId } : {}),
    },
  });
}

describeDb('Step 22 Operations Console durable idempotency IDEM01–IDEM16 (PostgreSQL)', () => {
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
    OpsIdempotencyService.clearProcessClaimsForTests();
    await cleanupOpsConsoleTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
  });

  afterEach(() => clearOpsFailureInjection());

  async function actorWithSession() {
    const user = await createPlatformUserFixture(prisma, {
      email: `ops-idem-${randomUUID()}@test.local`,
      roleKeys: ['operations_engineer'],
    });
    const session = await createPlatformRefreshSession(prisma, user.id, {
      stepUpVerifiedAt: new Date(),
    });
    return { user, session, claims: platformClaims(user.id, session.sessionId) };
  }

  function provInput(idem: string, reason = 'IDEM provisioning') {
    return {
      requestId: randomUUID(),
      expectedRowVersion: 1,
      reason,
      idempotencyKey: idem,
    };
  }

  function cacheInput(tenantId: string, idem: string, reason = 'IDEM cache') {
    return {
      tenantId,
      reason,
      idempotencyKey: idem,
      confirmation: 'INVALIDATE' as const,
    };
  }

  describe('provisioning retryProvisioning', () => {
    it('IDEM01: exact replay same process — no second source call, audit=1, durable=1', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const idem = `idem01-${randomUUID()}`;
      const input = provInput(idem);

      const first = await stack.actions.retryProvisioning(claims, stack.perms, input);
      stack.mockProvisioning.retry.mockClear();

      const second = await stack.actions.retryProvisioning(claims, stack.perms, input);

      expect(first.accepted).toBe(true);
      expect(second.accepted).toBe(true);
      expect(second.replayed).toBe(true);
      expect(stack.mockProvisioning.retry).not.toHaveBeenCalled();
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY)).toBe(1);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY,
          idem,
          claims.sub,
        ),
      ).toBe(1);
    });

    it('IDEM02: replay after service recreation — second stack replays without source call', async () => {
      const stackA = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const idem = `idem02-${randomUUID()}`;
      const input = provInput(idem);

      await stackA.actions.retryProvisioning(claims, stackA.perms, input);
      expect(stackA.mockProvisioning.retry).toHaveBeenCalledTimes(1);

      OpsIdempotencyService.clearProcessClaimsForTests();
      const stackB = createOpsStack(prisma);
      stackB.mockProvisioning.retry.mockClear();

      const replay = await stackB.actions.retryProvisioning(claims, stackB.perms, input);

      expect(replay.accepted).toBe(true);
      expect(replay.replayed).toBe(true);
      expect(stackB.mockProvisioning.retry).not.toHaveBeenCalled();
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY)).toBe(1);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY,
          idem,
          claims.sub,
        ),
      ).toBe(1);
    });

    it('IDEM03: after local cache loss — durable replay still works', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const idem = `idem03-${randomUUID()}`;
      const input = provInput(idem);

      await stack.actions.retryProvisioning(claims, stack.perms, input);
      stack.mockProvisioning.retry.mockClear();
      OpsIdempotencyService.clearProcessClaimsForTests();

      const replay = await stack.actions.retryProvisioning(claims, stack.perms, input);

      expect(replay.accepted).toBe(true);
      expect(replay.replayed).toBe(true);
      expect(stack.mockProvisioning.retry).not.toHaveBeenCalled();
    });

    it('IDEM04: concurrent duplicate — exactly one source effect, audit=1, durable=1', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const idem = `idem04-${randomUUID()}`;
      const input = provInput(idem);

      const results = await Promise.allSettled([
        stack.actions.retryProvisioning(claims, stack.perms, input),
        stack.actions.retryProvisioning(claims, stack.perms, input),
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(stack.mockProvisioning.retry).toHaveBeenCalledTimes(1);
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY)).toBe(1);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY,
          idem,
          claims.sub,
        ),
      ).toBe(1);
    });

    it('IDEM05: conflicting replay — same key different fingerprint -> idempotency_conflict 409', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const idem = `idem05-${randomUUID()}`;

      await stack.actions.retryProvisioning(claims, stack.perms, provInput(idem, 'first reason'));

      await expect(
        stack.actions.retryProvisioning(claims, stack.perms, provInput(idem, 'different reason')),
      ).rejects.toMatchObject({
        code: 'idempotency_conflict',
        httpStatus: 409,
      });
    });

    it('IDEM06: post-commit response failure then replay — one source call, audit=1', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const idem = `idem06-${randomUUID()}`;
      const input = provInput(idem);

      setOpsFailureInjection('after_commit_before_response');
      await expect(
        stack.actions.retryProvisioning(claims, stack.perms, input),
      ).rejects.toMatchObject({ code: 'injected_failure' });
      expect(stack.mockProvisioning.retry).toHaveBeenCalledTimes(1);

      clearOpsFailureInjection();
      stack.mockProvisioning.retry.mockClear();

      const replay = await stack.actions.retryProvisioning(claims, stack.perms, input);

      expect(replay.accepted).toBe(true);
      expect(replay.replayed).toBe(true);
      expect(stack.mockProvisioning.retry).not.toHaveBeenCalled();
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY)).toBe(1);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY,
          idem,
          claims.sub,
        ),
      ).toBe(1);
    });
  });

  describe('cache invalidateEntitlementCache', () => {
    it('IDEM07: exact replay — no second invalidate, audit=1, durable=1', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem07-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      const first = await stack.actions.invalidateEntitlementCache(claims, stack.perms, input);
      stack.mockEer.invalidateTenant.mockClear();

      const second = await stack.actions.invalidateEntitlementCache(claims, stack.perms, input);

      expect(first.accepted).toBe(true);
      expect(second.accepted).toBe(true);
      expect(second.replayed).toBe(true);
      expect(stack.mockEer.invalidateTenant).not.toHaveBeenCalled();
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE)).toBe(1);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE,
          idem,
          claims.sub,
        ),
      ).toBe(1);
    });

    it('IDEM08: replay after service recreation', async () => {
      const stackA = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem08-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      await stackA.actions.invalidateEntitlementCache(claims, stackA.perms, input);
      expect(stackA.mockEer.invalidateTenant).toHaveBeenCalledTimes(1);

      OpsIdempotencyService.clearProcessClaimsForTests();
      const stackB = createOpsStack(prisma);
      stackB.mockEer.invalidateTenant.mockClear();

      const replay = await stackB.actions.invalidateEntitlementCache(claims, stackB.perms, input);

      expect(replay.accepted).toBe(true);
      expect(replay.replayed).toBe(true);
      expect(stackB.mockEer.invalidateTenant).not.toHaveBeenCalled();
    });

    it('IDEM09: after local cache loss — durable replay still works', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem09-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      await stack.actions.invalidateEntitlementCache(claims, stack.perms, input);
      stack.mockEer.invalidateTenant.mockClear();
      OpsIdempotencyService.clearProcessClaimsForTests();

      const replay = await stack.actions.invalidateEntitlementCache(claims, stack.perms, input);

      expect(replay.accepted).toBe(true);
      expect(replay.replayed).toBe(true);
      expect(stack.mockEer.invalidateTenant).not.toHaveBeenCalled();
    });

    it('IDEM10: concurrent duplicate — exactly one invalidate, audit=1, durable=1', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem10-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      const results = await Promise.allSettled([
        stack.actions.invalidateEntitlementCache(claims, stack.perms, input),
        stack.actions.invalidateEntitlementCache(claims, stack.perms, input),
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(stack.mockEer.invalidateTenant).toHaveBeenCalledTimes(1);
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE)).toBe(1);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE,
          idem,
          claims.sub,
        ),
      ).toBe(1);
    });

    it('IDEM11: conflicting replay — same key different tenantId -> idempotency_conflict 409', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const idem = `idem11-${randomUUID()}`;

      await stack.actions.invalidateEntitlementCache(
        claims,
        stack.perms,
        cacheInput(randomUUID(), idem, 'first tenant'),
      );

      await expect(
        stack.actions.invalidateEntitlementCache(
          claims,
          stack.perms,
          cacheInput(randomUUID(), idem, 'second tenant'),
        ),
      ).rejects.toMatchObject({
        code: 'idempotency_conflict',
        httpStatus: 409,
      });
    });

    it('IDEM12: post-commit response failure then replay — one invalidate, audit=1', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem12-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      setOpsFailureInjection('after_commit_before_response');
      await expect(
        stack.actions.invalidateEntitlementCache(claims, stack.perms, input),
      ).rejects.toMatchObject({ code: 'injected_failure' });
      expect(stack.mockEer.invalidateTenant).toHaveBeenCalledTimes(1);

      clearOpsFailureInjection();
      stack.mockEer.invalidateTenant.mockClear();

      const replay = await stack.actions.invalidateEntitlementCache(claims, stack.perms, input);

      expect(replay.accepted).toBe(true);
      expect(replay.replayed).toBe(true);
      expect(stack.mockEer.invalidateTenant).not.toHaveBeenCalled();
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE)).toBe(1);
    });

    it('IDEM13: two tenants invalidate concurrently — different keys; both succeed; 2 durable rows; 2 audits', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const t1 = randomUUID();
      const t2 = randomUUID();
      const idem1 = `idem13a-${randomUUID()}`;
      const idem2 = `idem13b-${randomUUID()}`;

      const results = await Promise.allSettled([
        stack.actions.invalidateEntitlementCache(claims, stack.perms, cacheInput(t1, idem1)),
        stack.actions.invalidateEntitlementCache(claims, stack.perms, cacheInput(t2, idem2)),
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(stack.mockEer.invalidateTenant).toHaveBeenCalledTimes(2);
      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE)).toBe(2);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE,
          idem1,
          claims.sub,
        ),
      ).toBe(1);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE,
          idem2,
          claims.sub,
        ),
      ).toBe(1);
    });

    it('IDEM14: two API instances share durable replay — mockEer called once total', async () => {
      const stackA = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem14-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      await stackA.actions.invalidateEntitlementCache(claims, stackA.perms, input);
      expect(stackA.mockEer.invalidateTenant).toHaveBeenCalledTimes(1);

      OpsIdempotencyService.clearProcessClaimsForTests();
      const stackB = createOpsStack(prisma);
      stackB.mockEer.invalidateTenant.mockClear();

      const replay = await stackB.actions.invalidateEntitlementCache(claims, stackB.perms, input);

      expect(replay.accepted).toBe(true);
      expect(replay.replayed).toBe(true);
      expect(stackA.mockEer.invalidateTenant).toHaveBeenCalledTimes(1);
      expect(stackB.mockEer.invalidateTenant).not.toHaveBeenCalled();
    });

    it('IDEM15: exact audit cardinality — success + replay yields audit delta of 1', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem15-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      const before = await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE);

      await stack.actions.invalidateEntitlementCache(claims, stack.perms, input);
      await stack.actions.invalidateEntitlementCache(claims, stack.perms, input);

      const after = await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE);
      expect(after - before).toBe(1);
    });

    it('IDEM16: no orphan durable claims after rollback/failure — before_commit leaves audit=0 durable=0', async () => {
      const stack = createOpsStack(prisma);
      const { claims } = await actorWithSession();
      const tenantId = randomUUID();
      const idem = `idem16-${randomUUID()}`;
      const input = cacheInput(tenantId, idem);

      setOpsFailureInjection('before_commit');
      await expect(
        stack.actions.invalidateEntitlementCache(claims, stack.perms, input),
      ).rejects.toBeInstanceOf(OpsConsoleError);

      expect(await countOpsAudits(prisma, OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE)).toBe(0);
      expect(
        await countDurableRows(
          prisma,
          OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE,
          idem,
          claims.sub,
        ),
      ).toBe(0);
    });
  });
});
