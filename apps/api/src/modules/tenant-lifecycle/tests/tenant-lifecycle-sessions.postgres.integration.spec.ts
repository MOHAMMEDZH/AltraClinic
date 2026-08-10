/**
 * Flexible Step 19 — session revocation matrix (PostgreSQL).
 */
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { RefreshTokenHandler } from '../../auth/application/handlers/refresh-token.handler';
import { PrismaRefreshTokenRepository } from '../../auth/infrastructure/repositories/prisma-refresh-token.repository';
import {
  cleanupLifecycleTables,
  clearLifecycleFailureInjection,
  createHybridPrisma,
  createLifecycleStack,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  enableLifecycleFlag,
  platformClaims,
  platformDbSecurityEnabled,
  previewAndBody,
  seedClinicTenant,
} from './tenant-lifecycle-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 19 session revocation matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableLifecycleFlag();
  });

  afterAll(async () => {
    restoreFlag();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearLifecycleFailureInjection();
    await cleanupLifecycleTables(prisma);
  });

  it('suspend revokes target tenant clinic tokens only; platform sessions preserved', async () => {
    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `sess-a-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const platformSession = await createPlatformRefreshSession(prisma, actor.id);
    const claims = platformClaims(actor.id, platformSession.sessionId);

    const target = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const other = await seedClinicTenant(prisma, { status: 'ACTIVE' });

    const targetUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: target.tenantId,
        email: `u1-${randomUUID()}@clinic.test`,
        passwordHash: 'x',
        firstName: 'A',
        lastName: 'B',
        isActive: true,
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: other.tenantId,
        email: `u2-${randomUUID()}@clinic.test`,
        passwordHash: 'x',
        firstName: 'C',
        lastName: 'D',
        isActive: true,
      },
    });

    await prisma.refreshToken.createMany({
      data: [
        {
          id: randomUUID(),
          userId: targetUser.id,
          tenantId: target.tenantId,
          tokenHash: createHash('sha256').update(`t1-${randomUUID()}`).digest('hex'),
          sessionId: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
        {
          id: randomUUID(),
          userId: targetUser.id,
          tenantId: target.tenantId,
          tokenHash: createHash('sha256').update(`t2-${randomUUID()}`).digest('hex'),
          sessionId: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
        {
          id: randomUUID(),
          userId: otherUser.id,
          tenantId: other.tenantId,
          tokenHash: createHash('sha256').update(`o1-${randomUUID()}`).digest('hex'),
          sessionId: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    });

    const { body } = await previewAndBody(stack, claims, target.tenantId, 'suspend', 1);
    await stack.service.suspend(claims, target.tenantId, body, `sess-${randomUUID()}`);

    const targetActive = await prisma.refreshToken.count({
      where: { tenantId: target.tenantId, revokedAt: null },
    });
    const otherActive = await prisma.refreshToken.count({
      where: { tenantId: other.tenantId, revokedAt: null },
    });
    const platformActive = await prisma.platformRefreshToken.count({
      where: { sessionId: platformSession.sessionId, revokedAt: null },
    });

    expect(targetActive).toBe(0);
    expect(otherActive).toBe(1);
    expect(platformActive).toBe(1);
    expect(stack.revokedTenantIds).toEqual([target.tenantId]);
  });

  it('refresh handler denies SUSPENDED PlatformTenant', async () => {
    const wrapped = createHybridPrisma(prisma);
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: seeded.tenantId,
        email: `ref-${randomUUID()}@clinic.test`,
        passwordHash: 'x',
        firstName: 'R',
        lastName: 'F',
        isActive: true,
      },
    });
    const raw = `raw-${randomUUID()}`;
    const hash = createHash('sha256').update(raw).digest('hex');
    const sessionId = randomUUID();
    await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tenantId: seeded.tenantId,
        tokenHash: hash,
        sessionId,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const refreshRepo = new PrismaRefreshTokenRepository(wrapped);
    const handler = new RefreshTokenHandler(
      {
        findById: async () =>
          ({
            id: user.id,
            tenantId: seeded.tenantId,
            email: user.email,
            isActive: true,
            roles: ['OWNER'],
          }) as never,
      } as never,
      refreshRepo,
      {
        verifyRefreshToken: () => ({
          sub: user.id,
          sessionId,
          type: 'refresh',
          sessionClass: 'staff',
          principalType: 'staff',
          aud: 'clinic',
          iss: null,
        }),
        issueTokenPair: () => {
          throw new Error('should not issue');
        },
        generateSessionId: () => randomUUID(),
        getRefreshExpiresAt: () => new Date(Date.now() + 86400000),
      } as never,
      wrapped,
    );

    await expect(handler.execute(raw, '127.0.0.1', 'ua')).rejects.toThrow();
  });

  it('reactivation does not restore revoked sessions', async () => {
    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `rea-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: seeded.tenantId,
        email: `rea-u-${randomUUID()}@clinic.test`,
        passwordHash: 'x',
        firstName: 'R',
        lastName: 'E',
        isActive: true,
      },
    });
    await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tenantId: seeded.tenantId,
        tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        sessionId: randomUUID(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const sus = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claims, seeded.tenantId, sus.body, `rea-s-${randomUUID()}`);
    const afterSus = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    const rea = await previewAndBody(stack, claims, seeded.tenantId, 'reactivate', afterSus.rowVersion);
    await stack.service.reactivate(claims, seeded.tenantId, rea.body, `rea-r-${randomUUID()}`);

    const stillRevoked = await prisma.refreshToken.count({
      where: { tenantId: seeded.tenantId, revokedAt: null },
    });
    expect(stillRevoked).toBe(0);
  });
});
