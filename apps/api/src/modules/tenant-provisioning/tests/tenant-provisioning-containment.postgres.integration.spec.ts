/**

 * Step 17 correction gate — containment flag (default OFF / explicit false / explicit true).

 */

import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';

import { TenantProvisioningError } from '../domain/tenant-provisioning.types';

import { TENANT_PROVISIONING_DISABLED_CODE } from '../config/tenant-provisioning-flags';

import {

  assertSafePlatformTestDatabaseUrl,

  buildRequestBody,

  cleanupProvisioningTables,

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



describeDb('Step 17 tenant provisioning containment (PostgreSQL)', () => {

  let prisma: PrismaClient;

  let restoreFlag: (() => void) | undefined;



  beforeAll(async () => {

    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);

    prisma = await createPlatformDbSecurityClient();

    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

  });



  afterAll(async () => {

    restoreFlag?.();

    await prisma?.$disconnect();

  });



  beforeEach(async () => {

    restoreFlag?.();

    await cleanupProvisioningTables(prisma);

  });



  it('default OFF — createRequest throws tenant_provisioning_disabled (503); zero provisioning rows', async () => {

    delete process.env.TENANT_PROVISIONING_ENABLED;

    const stack = createProvisioningStack({ prisma });

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const before = await prisma.platformTenantProvisioningRequest.count();

    await expect(

      stack.service.createRequest(platformClaims(), buildRequestBody(fixture as never)),

    ).rejects.toMatchObject({

      code: TENANT_PROVISIONING_DISABLED_CODE,

      httpStatus: 503,

    });

    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(before);

  });



  it('explicit false — createRequest and start throw disabled; zero provisioning rows', async () => {

    restoreFlag = disableProvisioningFlag();

    const stack = createProvisioningStack({ prisma });

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const body = buildRequestBody(fixture as never);

    const before = await prisma.platformTenantProvisioningRequest.count();



    await expect(stack.service.createRequest(platformClaims(), body)).rejects.toBeInstanceOf(

      TenantProvisioningError,

    );

    await expect(stack.service.createRequest(platformClaims(), body)).rejects.toMatchObject({

      code: TENANT_PROVISIONING_DISABLED_CODE,

      httpStatus: 503,

    });



    const fakeId = randomUUID();

    await expect(

      stack.service.start(platformClaims(), fakeId, { expectedRowVersion: 1 }),

    ).rejects.toMatchObject({

      code: TENANT_PROVISIONING_DISABLED_CODE,

      httpStatus: 503,

    });



    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(before);

  });



  it('explicit true — createRequest proceeds when fixtures exist', async () => {

    restoreFlag = enableProvisioningFlag();

    const stack = createProvisioningStack({ prisma });

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const progress = await stack.service.createRequest(

      platformClaims(),

      buildRequestBody(fixture as never),

      `contain-${randomUUID()}`,

    );

    expect(progress.status).toBe('READY');

    expect(progress.tenantId).toBeNull();



    const row = await prisma.platformTenantProvisioningRequest.findUnique({

      where: { id: progress.id },

    });

    expect(row).toBeTruthy();

  });

});


