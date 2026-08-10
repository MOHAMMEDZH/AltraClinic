/**

 * Step 17 correction gate — full happy-path orchestration with real subscriptions + EER.

 */

import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';

import {

  assertSafePlatformTestDatabaseUrl,

  buildRequestBody,

  cleanupProvisioningTables,

  countProvisioningAuditActions,

  createPlatformDbSecurityClient,

  createProvisioningStack,

  DEFAULT_PLATFORM_DB_SECURITY_URL,

  enableProvisioningFlag,

  findPublishedPlanFixture,

  platformClaims,

  platformDbSecurityEnabled,

  runFullHappyPath,

} from './tenant-provisioning-db.harness';



const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;



describeDb('Step 17 tenant provisioning E2E orchestration (PostgreSQL)', () => {

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



  it('createRequest → start → activate — full durable evidence chain', async () => {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const stack = createProvisioningStack({ prisma });

    const claims = platformClaims();

    const body = buildRequestBody(fixture as never);

    const prefix = randomUUID().slice(0, 8);



    const beforeTenants = await prisma.tenant.count();

    const beforeObs = await prisma.platformUsageObservation.count();



    const { activated } = await runFullHappyPath(stack, claims, body, prefix);



    expect(activated.status).toBe('COMPLETED');

    expect(activated.tenantId).toBeTruthy();



    expect(await prisma.tenant.count()).toBe(beforeTenants + 1);



    const workflow = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({

      where: { id: activated.id },

    });

    expect(workflow.status).toBe('COMPLETED');



    const commercialConfigs = await prisma.platformSubscriptionCommercialConfig.count({

      where: { platformTenantId: workflow.platformTenantId! },

    });

    expect(commercialConfigs).toBe(1);



    const snapshots = await prisma.platformSubscriptionCommercialSnapshot.count({

      where: { configId: workflow.commercialConfigId! },

    });

    expect(snapshots).toBeGreaterThanOrEqual(1);



    const invitations = await prisma.staffInvitation.count({

      where: { tenantId: workflow.tenantId! },

    });

    expect(invitations).toBe(1);



    expect(stack.mails).toHaveLength(1);

    expect(stack.emailSender.sendPasswordReset).toHaveBeenCalledTimes(1);



    expect(

      await countProvisioningAuditActions(prisma, 'tenant_provisioning.request.created', activated.id),

    ).toBe(1);

    expect(

      await countProvisioningAuditActions(prisma, 'tenant_provisioning.started', activated.id),

    ).toBe(1);

    expect(

      await countProvisioningAuditActions(prisma, 'tenant_provisioning.activated', activated.id),

    ).toBe(1);



    const idemRows = await prisma.platformTenantProvisioningIdempotencyRecord.count({
      where: {
        resultResourceId: activated.id,
        status: { in: ['completed', 'COMPLETED'] },
      },
    });

    expect(idemRows).toBeGreaterThanOrEqual(1);



    expect(await prisma.platformUsageObservation.count()).toBe(beforeObs);

  });



  it('with U01 flags ON — provisioning does not invent usage observations', async () => {

    const prevU01 = process.env.USAGE_METERING_ENABLED;

    const prevIngest = process.env.USAGE_METERING_INGESTION_ENABLED;

    const prevEnforce = process.env.USAGE_METERING_ENFORCEMENT_ENABLED;

    process.env.USAGE_METERING_ENABLED = 'true';

    process.env.USAGE_METERING_INGESTION_ENABLED = 'true';

    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'true';



    try {

      const fixture = await findPublishedPlanFixture(prisma);

      if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



      const stack = createProvisioningStack({ prisma });

      const beforeObs = await prisma.platformUsageObservation.count();

      const beforeCounters = await prisma.platformUsageCounter.count();



      await runFullHappyPath(stack, platformClaims(), buildRequestBody(fixture as never));



      expect(await prisma.platformUsageObservation.count()).toBe(beforeObs);

      expect(await prisma.platformUsageCounter.count()).toBe(beforeCounters);

    } finally {

      if (prevU01 === undefined) delete process.env.USAGE_METERING_ENABLED;

      else process.env.USAGE_METERING_ENABLED = prevU01;

      if (prevIngest === undefined) delete process.env.USAGE_METERING_INGESTION_ENABLED;

      else process.env.USAGE_METERING_INGESTION_ENABLED = prevIngest;

      if (prevEnforce === undefined) delete process.env.USAGE_METERING_ENFORCEMENT_ENABLED;

      else process.env.USAGE_METERING_ENFORCEMENT_ENABLED = prevEnforce;

    }

  });

});


