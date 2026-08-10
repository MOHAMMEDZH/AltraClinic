/**

 * Step 17 correction gate — incomplete managed states deny LEGACY fallback semantics.

 */

import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';

import { PROVISIONING_FAILURE_INJECTION_ENV } from '../domain/tenant-provisioning.types';

import {

  assertSafePlatformTestDatabaseUrl,

  buildRequestBody,

  cleanupProvisioningTables,

  createPlatformDbSecurityClient,

  createProvisioningStack,

  DEFAULT_PLATFORM_DB_SECURITY_URL,

  enableProvisioningFlag,

  findPublishedPlanFixture,

  platformClaims,

  platformDbSecurityEnabled,

} from './tenant-provisioning-db.harness';



const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;



describeDb('Step 17 tenant provisioning pending vs LEGACY (PostgreSQL)', () => {

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

    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];

    await cleanupProvisioningTables(prisma);

  });



  it('READY only — request exists, no tenant yet, no ACTIVE lifecycle', async () => {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const stack = createProvisioningStack({ prisma });

    const progress = await stack.service.createRequest(

      platformClaims(),

      buildRequestBody(fixture as never),

      `ready-${randomUUID()}`,

    );

    expect(progress.status).toBe('READY');

    expect(progress.tenantId).toBeNull();



    const activeTenants = await prisma.tenant.count({

      where: { status: 'ACTIVE', features: { path: ['provisioningRequestId'], equals: progress.id } },

    });

    expect(activeTenants).toBe(0);

  });



  it('PROVISIONING mid-flight — inject failure; PlatformTenant PROVISIONING, tenant SUSPENDED, not ACTIVE', async () => {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_tenant_registry';

    const stack = createProvisioningStack({ prisma });

    const claims = platformClaims();

    const created = await stack.service.createRequest(

      claims,

      buildRequestBody(fixture as never),

      `mid-${randomUUID()}`,

    );



    await expect(

      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }),

    ).rejects.toMatchObject({ code: 'injected_failure' });



    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];



    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({

      where: { id: created.id },

    });

    expect(row.status).toBe('FAILED_RETRYABLE');

    expect(row.tenantId).toBeTruthy();



    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: row.tenantId! } });

    expect(tenant.status).toBe('SUSPENDED');

    expect(tenant.status).not.toBe('ACTIVE');



    const pt = await prisma.platformTenant.findUniqueOrThrow({

      where: { id: row.platformTenantId! },

    });

    expect(pt.status).toBe('PROVISIONING');

    expect(pt.status).not.toBe('ACTIVE');



    const bundle = await stack.eer.resolveEffectiveEntitlements(row.tenantId!);

    // Before commercial config: may still classify as NEVER_MANAGED — activation barrier blocks completion.

    expect(bundle.source).not.toBe('SNAPSHOT');

  });



  it('AWAITING_ACTIVATION — EER returns SNAPSHOT pending (not LEGACY); tenant SUSPENDED', async () => {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;



    const stack = createProvisioningStack({ prisma });

    const claims = platformClaims();

    const created = await stack.service.createRequest(

      claims,

      buildRequestBody(fixture as never),

      `await-${randomUUID()}`,

    );

    const started = await stack.service.start(claims, created.id, {

      expectedRowVersion: created.rowVersion,

    });



    expect(started.status).toBe('AWAITING_ACTIVATION');



    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({

      where: { id: started.id },

    });

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: row.tenantId! } });

    expect(tenant.status).toBe('SUSPENDED');



    const pt = await prisma.platformTenant.findUniqueOrThrow({

      where: { id: row.platformTenantId! },

    });

    expect(pt.status).toBe('PROVISIONING');



    const bundle = await stack.eer.resolveEffectiveEntitlements(row.tenantId!);

    expect(bundle.source).toBe('SNAPSHOT');

    expect(bundle.code).toBe('runtime_pending_activation');

    expect(bundle.source).not.toBe('LEGACY');

  });



  it('NEVER_MANAGED — tenant without Step 16 commercial history may resolve LEGACY (documented)', async () => {

    const stack = createProvisioningStack({ prisma });

    const tenant = await prisma.tenant.create({

      data: {

        name: 'Legacy Clinic',

        slug: `legacy-${randomUUID().slice(0, 8)}`,

        features: {},

      },

    });

    await prisma.platformTenant.create({

      data: {

        tenantId: tenant.id,

        displayName: 'Legacy Clinic',

        region: 'ME_SOUTH',

        plan: 'PRO',

        status: 'ACTIVE',

        provisionedBy: randomUUID(),

      },

    });



    const bundle = await stack.eer.resolveEffectiveEntitlements(tenant.id);

    expect(bundle.source).toBe('LEGACY');

    expect(bundle.provenance).toBe('NEVER_MANAGED');

    expect(bundle.code).toBe('legacy_never_managed');

  });

});


