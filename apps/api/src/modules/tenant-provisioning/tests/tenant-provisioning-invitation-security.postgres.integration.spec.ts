/**

 * Step 17 correction gate — invitation security (token hash only, dispatch once, compensate).

 */

import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';

import { PasswordResetToken } from '../../auth/domain/entities/password-reset-token.entity';

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



describeDb('Step 17 tenant provisioning invitation security (PostgreSQL)', () => {

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



  async function seedAwaitingActivation() {

    const fixture = await findPublishedPlanFixture(prisma);

    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return null;



    const stack = createProvisioningStack({ prisma });

    const claims = platformClaims();

    const created = await stack.service.createRequest(

      claims,

      buildRequestBody(fixture as never),

      `inv-${randomUUID()}`,

    );

    const started = await stack.service.start(claims, created.id, {

      expectedRowVersion: created.rowVersion,

    });

    return { stack, claims, started, fixture };

  }



  it('prepare persists invitation PENDING; token hash only in reset store; raw not in DB columns', async () => {

    const ctx = await seedAwaitingActivation();

    if (!ctx) return;



    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({

      where: { id: ctx.started.id },

    });

    expect(row.invitationId).toBeTruthy();



    const invite = await prisma.staffInvitation.findUniqueOrThrow({

      where: { id: row.invitationId! },

    });

    expect(invite.status).toBe('PENDING');



    const inviteJson = JSON.stringify(invite);

    expect(inviteJson).not.toMatch(/rawToken|invitationToken|"token"/i);



    const tokens = await prisma.passwordResetToken.findMany({

      where: { userId: invite.userId! },

    });

    expect(tokens.length).toBeGreaterThanOrEqual(1);

    for (const t of tokens) {

      expect(t.tokenHash).toMatch(/^[a-f0-9]{64}$/);

      expect(JSON.stringify(t)).not.toContain(ctx.stack.mails[0]?.token ?? '___none___');

    }

  });



  it('dispatch sends email once; duplicate dispatch is safe', async () => {

    const ctx = await seedAwaitingActivation();

    if (!ctx) return;



    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({

      where: { id: ctx.started.id },

    });



    const first = await ctx.stack.invitations.dispatch(row.invitationId!);

    expect(first.dispatched).toBe(true);

    expect(ctx.stack.mails).toHaveLength(1);



    const second = await ctx.stack.invitations.dispatch(row.invitationId!);

    expect(second.dispatched).toBe(false);

    expect(ctx.stack.mails).toHaveLength(1);

  });



  it('compensate revokes undispatched PENDING invitation', async () => {

    const ctx = await seedAwaitingActivation();

    if (!ctx) return;



    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({

      where: { id: ctx.started.id },

    });

    await ctx.stack.invitations.compensate(row.invitationId!);



    const invite = await prisma.staffInvitation.findUniqueOrThrow({

      where: { id: row.invitationId! },

    });

    expect(invite.status).toBe('CANCELLED');

  });



  it('audit/API DTO has no token fields', async () => {

    const ctx = await seedAwaitingActivation();

    if (!ctx) return;



    const progress = await ctx.stack.service.getProgress(ctx.claims, ctx.started.id);

    const progressJson = JSON.stringify(progress);

    expect(progressJson).not.toMatch(/token|password|rawToken|invitationToken/i);



    const audits = await prisma.auditEntry.findMany({

      where: { resourceId: ctx.started.id, resourceType: 'tenant_provisioning' },

    });

    for (const audit of audits) {

      const details = JSON.stringify(audit.details ?? {});

      expect(details).not.toMatch(/token|password|rawToken|invitationToken/i);

    }



    // Unit-level: raw token never equals stored hash

    const [, raw] = PasswordResetToken.generate({

      userId: randomUUID(),

      tenantId: randomUUID(),

      ipAddress: '127.0.0.1',

    });

    expect(raw).not.toBe(PasswordResetToken.hashRaw(raw));

  });

});


