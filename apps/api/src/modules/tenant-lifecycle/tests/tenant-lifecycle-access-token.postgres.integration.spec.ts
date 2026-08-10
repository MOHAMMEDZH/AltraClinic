/**
 * Flexible Step 19 — Phase F: already-issued Clinic access token denied after suspension.
 */
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import {
  JwtTokenService,
  type JwtConfig,
} from '../../auth/infrastructure/services/jwt-token.service';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import {
  cleanupLifecycleTables,
  clearLifecycleFailureInjection,
  createHybridPrisma,
  createLifecycleStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableLifecycleFlag,
  platformClaims,
  platformDbSecurityEnabled,
  previewAndBody,
  seedClinicTenant,
} from './tenant-lifecycle-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const JWT_CFG: JwtConfig = {
  accessSecret: 'clinic-access-secret-min-32-characters-xx',
  refreshSecret: 'clinic-refresh-secret-min-32-characters-x',
  accessExpiresIn: 900,
  refreshExpiresIn: 604800,
  mfaChallengeExpiresIn: 300,
  platformAccessSecret: 'platform-access-secret-min-32-chars-xx',
  platformRefreshSecret: 'platform-refresh-secret-min-32-chars-x',
  platformIssuer: 'booking-platform',
  platformAccessExpiresIn: 900,
  platformRefreshExpiresIn: 604800,
  platformSecretsSharedWithClinic: false,
};

describeDb('Step 19 Clinic old access-token denial after suspension (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let strategy: JwtStrategy;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableLifecycleFlag();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
    strategy = new JwtStrategy(
      JWT_CFG,
      { isJtiBlacklisted: async () => false } as never,
      jwtTokens,
      jwtService,
      createHybridPrisma(prisma),
    );
  });

  afterAll(async () => {
    restoreFlag();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearLifecycleFailureInjection();
    await cleanupLifecycleTables(prisma);
  });

  it('F-access: same unexpired Clinic access token is denied after Step 19 suspend; other tenant + Platform unaffected', async () => {
    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `tok-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claims = platformClaims(actor.id, randomUUID());

    const target = await seedClinicTenant(prisma, { status: 'ACTIVE', displayName: 'Target Clinic' });
    const other = await seedClinicTenant(prisma, { status: 'ACTIVE', displayName: 'Other Clinic' });

    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        tenantId: target.tenantId,
        email: `clinic-${randomUUID()}@test.local`,
        passwordHash: 'x',
        firstName: 'Clinic',
        lastName: 'Owner',
        isActive: true,
      },
    });

    const sessionId = randomUUID();
    await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        tokenHash: createHash('sha256').update(`raw-${randomUUID()}`).digest('hex'),
        userId,
        tenantId: target.tenantId,
        sessionId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const pair = jwtTokens.issueTokenPair({
      userId,
      tenantId: target.tenantId,
      branchId: null,
      roles: ['OWNER'] as never,
      sessionId,
    });

    const payload = jwtService.decode(pair.accessToken) as Record<string, unknown>;
    const before = await strategy.validate(payload);
    expect(before.tenantId).toBe(target.tenantId);

    const { body } = await previewAndBody(stack, claims, target.tenantId, 'suspend', 1);
    await stack.service.suspend(claims, target.tenantId, body, `tok-sus-${randomUUID()}`);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);

    // Elevated roles / spoofed header-like claim fields cannot bypass suspended tenantId
    const spoofedRoles = { ...payload, roles: ['OWNER', 'ADMIN', '*'] };
    await expect(strategy.validate(spoofedRoles)).rejects.toBeInstanceOf(UnauthorizedException);

    const otherUser = randomUUID();
    await prisma.user.create({
      data: {
        id: otherUser,
        tenantId: other.tenantId,
        email: `other-${randomUUID()}@test.local`,
        passwordHash: 'x',
        firstName: 'Other',
        lastName: 'Owner',
        isActive: true,
      },
    });
    const otherPair = jwtTokens.issueTokenPair({
      userId: otherUser,
      tenantId: other.tenantId,
      branchId: null,
      roles: ['OWNER'] as never,
      sessionId: randomUUID(),
    });
    const otherPayload = jwtService.decode(otherPair.accessToken) as Record<string, unknown>;
    await expect(strategy.validate(otherPayload)).resolves.toMatchObject({
      tenantId: other.tenantId,
    });

    const platformSession = await createPlatformUserFixture(prisma, {
      email: `plat-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const platformPair = jwtTokens.issuePlatformTokenPair({
      platformUserId: platformSession.id,
      sessionId: randomUUID(),
    });
    const platformPayload = jwtService.decode(platformPair.accessToken) as Record<string, unknown>;
    await expect(strategy.validate(platformPayload)).resolves.toMatchObject({
      principalType: 'platform',
    });

    const audits = await prisma.auditEntry.findMany({
      where: { action: 'tenant_lifecycle.suspend', resourceId: target.tenantId },
    });
    expect(audits).toHaveLength(1);
    const detail = JSON.stringify(audits[0]?.details ?? {});
    expect(detail).not.toMatch(/Bearer|password|SELECT |Prisma|stack/i);
    expect(detail).not.toContain(pair.accessToken);
  });
});
