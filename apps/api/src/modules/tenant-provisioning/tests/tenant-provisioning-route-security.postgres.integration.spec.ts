/**
 * Step 17 correction gate — auth boundaries, rate limits, disabled gate (no side effects).
 */
import { ForbiddenException, HttpException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { TenantProvisioningController } from '../controllers/tenant-provisioning.controller';
import { TenantProvisioningError } from '../domain/tenant-provisioning.types';
import {
  isTenantProvisioningEnabled,
  TENANT_PROVISIONING_DISABLED_CODE,
} from '../config/tenant-provisioning-flags';
import { PROVISION_PERMISSIONS } from '../tenant-provisioning.constants';
import {
  assertSafePlatformTestDatabaseUrl,
  buildRequestBody,
  cleanupProvisioningTables,
  countProvisioningAuditActions,
  createPlatformDbSecurityClient,
  createProvisioningStack,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  disableProvisioningFlag,
  enableProvisioningFlag,
  findPublishedPlanFixture,
  platformClaims,
  platformDbSecurityEnabled,
} from './tenant-provisioning-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 17 tenant provisioning route security (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    restoreFlag = enableProvisioningFlag();
  });

  afterAll(async () => {
    restoreFlag();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupProvisioningTables(prisma);
  });

  it('missing tenant.provision.create — denial creates no workflow or success audit', async () => {
    const fixture = await findPublishedPlanFixture(prisma);
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;

    const stack = createProvisioningStack({ prisma, permissions: [PROVISION_PERMISSIONS.view] });
    const before = await prisma.platformTenantProvisioningRequest.count();
    const auditBefore = await countProvisioningAuditActions(
      prisma,
      'tenant_provisioning.request.created',
    );

    await expect(
      stack.service.createRequest(platformClaims(), buildRequestBody(fixture as never)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(before);
    expect(
      await countProvisioningAuditActions(prisma, 'tenant_provisioning.request.created'),
    ).toBe(auditBefore);
  });

  it('stale step-up — activate denied; no COMPLETED workflow', async () => {
    const fixture = await findPublishedPlanFixture(prisma);
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;

    const stack = createProvisioningStack({ prisma, stepUpFresh: false });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture as never),
      `sec-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });

    await expect(
      stack.service.activate(claims, started.id, {
        expectedRowVersion: started.rowVersion,
        reason: 'blocked',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: started.id },
    });
    expect(row.status).not.toBe('COMPLETED');
  });

  it('clinic-scoped claims — still require platform permissions (empty perms denied)', async () => {
    const fixture = await findPublishedPlanFixture(prisma);
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;

    const stack = createProvisioningStack({ prisma, permissions: [] });
    const clinicClaims = {
      ...platformClaims(),
      tenantId: randomUUID(),
      sessionClass: 'clinic',
      principalType: 'clinic',
      aud: 'clinic',
    };

    await expect(
      stack.service.createRequest(clinicClaims as never, buildRequestBody(fixture as never)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rate limit — hammer highImpact until 429; no extra workflow rows', async () => {
    const fixture = await findPublishedPlanFixture(prisma);
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;

    const stack = createProvisioningStack({ prisma });
    stack.rateLimit.testHighImpactLimit = 1;
    stack.rateLimit.reset();

    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture as never),
      `rl-${randomUUID()}`,
    );
    const before = await prisma.platformTenantProvisioningRequest.count();

    await stack.service.start(
      claims,
      created.id,
      { expectedRowVersion: created.rowVersion },
      `rl-start-1-${randomUUID()}`,
    );

    await expect(
      stack.service.start(claims, created.id, {
        expectedRowVersion: created.rowVersion,
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(before);
  });

  it('controller assertEnabled — disabled flag returns 503 before service', async () => {
    const disable = disableProvisioningFlag();
    expect(isTenantProvisioningEnabled()).toBe(false);

    const stack = createProvisioningStack({ prisma });
    const controller = new TenantProvisioningController(stack.service);
    const fixture = await findPublishedPlanFixture(prisma);
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) {
      disable();
      restoreFlag = enableProvisioningFlag();
      return;
    }

    const claims = platformClaims();
    await expect(
      controller.create(claims, buildRequestBody(fixture as never), `ctrl-${randomUUID()}`),
    ).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: TENANT_PROVISIONING_DISABLED_CODE }),
    });

    disable();
    restoreFlag = enableProvisioningFlag();
  });

  it('disabled service create — TenantProvisioningError 503, zero side effects', async () => {
    const disable = disableProvisioningFlag();
    const stack = createProvisioningStack({ prisma });
    const fixture = await findPublishedPlanFixture(prisma);
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) {
      disable();
      restoreFlag = enableProvisioningFlag();
      return;
    }

    const before = await prisma.platformTenantProvisioningRequest.count();
    await expect(
      stack.service.createRequest(platformClaims(), buildRequestBody(fixture as never)),
    ).rejects.toBeInstanceOf(TenantProvisioningError);

    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(before);
    disable();
    restoreFlag = enableProvisioningFlag();
  });
});
