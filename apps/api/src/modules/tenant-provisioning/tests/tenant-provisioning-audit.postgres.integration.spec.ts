/**

 * Step 17 correction gate — audit success idempotency and redaction.

 */

import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';

import { TenantProvisioningError } from '../domain/tenant-provisioning.types';

import { TENANT_PROVISIONING_DISABLED_CODE } from '../config/tenant-provisioning-flags';

import { redactProvisioningAuditDetails } from '../application/tenant-provisioning-audit.log';

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



describeDb('Step 17 tenant provisioning audit (PostgreSQL)', () => {

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



  it('success create → exactly one tenant_provisioning.request.created audit', async () => {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const stack = createProvisioningStack({ prisma });

    const claims = platformClaims();

    const key = `audit-create-${randomUUID()}`;



    const progress = await stack.service.createRequest(

      claims,

      buildRequestBody(fixture as never),

      key,

    );



    expect(

      await countProvisioningAuditActions(

        prisma,

        'tenant_provisioning.request.created',

        progress.id,

      ),

    ).toBe(1);

  });



  it('replay create → no second success audit', async () => {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const stack = createProvisioningStack({ prisma });

    const claims = platformClaims();

    const key = `audit-replay-${randomUUID()}`;

    const body = buildRequestBody(fixture as never);



    const first = await stack.service.createRequest(claims, body, key);

    await stack.service.createRequest(claims, body, key);



    expect(

      await countProvisioningAuditActions(

        prisma,

        'tenant_provisioning.request.created',

        first.id,

      ),

    ).toBe(1);

  });



  it('failure/disabled → no success audit', async () => {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const disable = disableProvisioningFlag();

    const stack = createProvisioningStack({ prisma });

    const before = await prisma.auditEntry.count({

      where: { action: 'tenant_provisioning.request.created' },

    });



    await expect(

      stack.service.createRequest(platformClaims(), buildRequestBody(fixture as never)),

    ).rejects.toBeInstanceOf(TenantProvisioningError);



    expect(

      await prisma.auditEntry.count({

        where: { action: 'tenant_provisioning.request.created' },

      }),

    ).toBe(before);



    disable();

    restoreFlag = enableProvisioningFlag();



    // Invalid body — validation failure before audit

    await expect(

      stack.service.createRequest(platformClaims(), {

        ...buildRequestBody(fixture as never),

        tenantAdmin: { email: 'not-an-email' },

      }),

    ).rejects.toMatchObject({ code: 'validation_failed' });



    expect(

      await prisma.auditEntry.count({

        where: { action: 'tenant_provisioning.request.created' },

      }),

    ).toBe(before);

  });



  it('redaction strips token/password keys from persisted details', async () => {

    const redacted = redactProvisioningAuditDetails({

      onboardingType: 'STANDARD',

      invitationToken: 'secret-raw',

      password: 'hunter2',

      tempPassword: 'x',

      facilityTypeKey: 'facility_type.clinic',

    });

    expect(redacted).toEqual({

      onboardingType: 'STANDARD',

      facilityTypeKey: 'facility_type.clinic',

    });

    expect(redacted).not.toHaveProperty('invitationToken');

    expect(redacted).not.toHaveProperty('password');



    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const stack = createProvisioningStack({ prisma });

    const progress = await stack.service.createRequest(

      platformClaims(),

      buildRequestBody(fixture as never),

      `audit-redact-${randomUUID()}`,

    );



    const entry = await prisma.auditEntry.findFirst({

      where: {

        action: 'tenant_provisioning.request.created',

        resourceId: progress.id,

      },

    });

    expect(entry).toBeTruthy();

    const stored = JSON.stringify(entry!.details ?? {});

    expect(stored).not.toMatch(/token|password/i);

  });



  it('disabled code constant matches service throw', async () => {

    const disable = disableProvisioningFlag();

    const stack = createProvisioningStack({ prisma });

    await expect(

      stack.service.createRequest(platformClaims(), {

        organization: { legalOrDisplayName: 'x' },

        facilityTypeKey: 'x',

        specialtyKeys: [],

        publishedPlanVersionId: randomUUID(),

        tenantAdmin: { email: 'a@b.com' },

        onboardingType: 'STANDARD',

      }),

    ).rejects.toMatchObject({ code: TENANT_PROVISIONING_DISABLED_CODE });

    disable();

    restoreFlag = enableProvisioningFlag();

  });

});


