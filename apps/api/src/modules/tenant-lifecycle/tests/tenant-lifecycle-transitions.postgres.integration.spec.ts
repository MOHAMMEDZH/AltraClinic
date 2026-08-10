/**
 * Flexible Step 19 — core transition / SoD / containment / audit cardinality (PostgreSQL).
 */
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  cleanupLifecycleTables,
  clearLifecycleFailureInjection,
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

describeDb('Step 19 lifecycle transitions (PostgreSQL)', () => {
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

  afterEach(() => {
    clearLifecycleFailureInjection();
  });

  it('ACTIVE → SUSPENDED → ACTIVE with session revoke and EER invalidate', async () => {
    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `lc-actor-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });

    const { body: suspendBody } = await previewAndBody(
      stack,
      claims,
      seeded.tenantId,
      'suspend',
      seeded.platformTenant.rowVersion,
    );
    await stack.service.suspend(claims, seeded.tenantId, suspendBody, `sus-${randomUUID()}`);

    const afterSuspend = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(afterSuspend.status).toBe('SUSPENDED');
    expect(afterSuspend.rowVersion).toBe(2);
    expect(stack.revokedTenantIds).toEqual([seeded.tenantId]);
    expect(stack.eerCalls.invalidate).toContain(seeded.tenantId);

    const { body: reactBody } = await previewAndBody(
      stack,
      claims,
      seeded.tenantId,
      'reactivate',
      afterSuspend.rowVersion,
    );
    await stack.service.reactivate(claims, seeded.tenantId, reactBody, `rea-${randomUUID()}`);
    const afterRe = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(afterRe.status).toBe('ACTIVE');
    expect(stack.eerCalls.resolve.length).toBeGreaterThan(0);
  });

  it('denies self-approval and self-reject; allows cancel by requester', async () => {
    const stack = createLifecycleStack(prisma);
    const requester = await createPlatformUserFixture(prisma, {
      email: `lc-req-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const approver = await createPlatformUserFixture(prisma, {
      email: `lc-apr-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const reqClaims = platformClaims(requester.id, randomUUID());
    const aprClaims = platformClaims(approver.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });

    const { body } = await previewAndBody(
      stack,
      reqClaims,
      seeded.tenantId,
      'archive_request',
      seeded.platformTenant.rowVersion,
    );
    const created = (await stack.service.createArchiveRequest(
      reqClaims,
      seeded.tenantId,
      body,
      `arc-${randomUUID()}`,
    )) as { id: string };

    await expect(
      stack.service.approveRequest(
        reqClaims,
        created.id,
        {
          expectedRowVersion: seeded.platformTenant.rowVersion,
          reason: 'self approve',
          previewFingerprint: 'n/a',
        },
        `apr-self-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ response: { code: 'self_approval_denied' } });

    await expect(
      stack.service.rejectRequest(
        reqClaims,
        created.id,
        {
          expectedRowVersion: seeded.platformTenant.rowVersion,
          reason: 'self reject',
          previewFingerprint: 'n/a',
        },
        `rej-self-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ response: { code: 'self_approval_denied' } });

    const cancelled = await stack.service.cancelRequest(
      reqClaims,
      created.id,
      {
        expectedRowVersion: seeded.platformTenant.rowVersion,
        reason: 'requester cancel',
        previewFingerprint: 'n/a',
      },
      `can-${randomUUID()}`,
    );
    expect((cancelled as { status: string }).status).toBe('CANCELLED');

    // recreate and approve by different actor → ARCHIVED
    const seeded2 = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body: body2 } = await previewAndBody(
      stack,
      reqClaims,
      seeded2.tenantId,
      'archive_request',
      seeded2.platformTenant.rowVersion,
    );
    const created2 = (await stack.service.createArchiveRequest(
      reqClaims,
      seeded2.tenantId,
      body2,
      `arc2-${randomUUID()}`,
    )) as { id: string };
    await stack.service.approveRequest(
      aprClaims,
      created2.id,
      {
        expectedRowVersion: seeded2.platformTenant.rowVersion,
        reason: 'approve archive',
        previewFingerprint: 'n/a',
        decisionReason: 'dual control',
      },
      `apr-${randomUUID()}`,
    );
    const archived = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded2.tenantId },
    });
    expect(archived.status).toBe('ARCHIVED');
  });

  it('deletion approve yields APPROVED_HANDOFF without physical delete', async () => {
    const stack = createLifecycleStack(prisma);
    const requester = await createPlatformUserFixture(prisma, {
      email: `lc-del-r-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const approver = await createPlatformUserFixture(prisma, {
      email: `lc-del-a-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const reqClaims = platformClaims(requester.id, randomUUID());
    const aprClaims = platformClaims(approver.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, {
      status: 'ARCHIVED',
      displayName: 'Delete Target Clinic',
    });

    const { body } = await previewAndBody(
      stack,
      reqClaims,
      seeded.tenantId,
      'deletion_request',
      seeded.platformTenant.rowVersion,
      { typedConfirmation: seeded.displayName },
    );
    const created = (await stack.service.createDeletionRequest(
      reqClaims,
      seeded.tenantId,
      body,
      `del-${randomUUID()}`,
    )) as { id: string };

    const result = (await stack.service.approveRequest(
      aprClaims,
      created.id,
      {
        expectedRowVersion: seeded.platformTenant.rowVersion,
        reason: 'handoff',
        previewFingerprint: 'n/a',
      },
      `del-apr-${randomUUID()}`,
    )) as { request: { status: string }; physicalDeletion: boolean };

    expect(result.physicalDeletion).toBe(false);
    expect(result.request.status).toBe('APPROVED_HANDOFF');
    const stillThere = await prisma.platformTenant.findUnique({
      where: { tenantId: seeded.tenantId },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.status).toBe('ARCHIVED');
  });

  it('stale rowVersion is rejected and exact replay does not duplicate audit', async () => {
    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `lc-rv-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(
      stack,
      claims,
      seeded.tenantId,
      'suspend',
      seeded.platformTenant.rowVersion,
    );

    await expect(
      stack.service.suspend(
        claims,
        seeded.tenantId,
        { ...body, expectedRowVersion: 999 },
        `stale-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ response: { code: 'stale_row_version' } });

    const key = `replay-${randomUUID()}`;
    await stack.service.suspend(claims, seeded.tenantId, body, key);
    await stack.service.suspend(claims, seeded.tenantId, body, key);

    const audits = await prisma.auditEntry.findMany({
      where: {
        action: 'tenant_lifecycle.suspend',
        resourceId: seeded.tenantId,
      },
    });
    expect(audits).toHaveLength(1);
    const details = JSON.stringify(audits[0].details ?? {});
    expect(details).not.toMatch(/sessionId|refresh_token|Bearer |phi|password/i);
  });

  it('containment OFF blocks mutations with zero side effects', async () => {
    process.env.TENANT_LIFECYCLE_ENABLED = 'false';
    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `lc-off-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const preview = await stack.service.preview(claims, seeded.tenantId, 'suspend');
    await expect(
      stack.service.suspend(
        claims,
        seeded.tenantId,
        {
          expectedRowVersion: seeded.platformTenant.rowVersion,
          reason: 'should fail',
          previewFingerprint: preview.previewFingerprint,
        },
        `off-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: 'tenant_lifecycle_disabled' });
    const unchanged = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(unchanged.status).toBe('ACTIVE');
    expect(unchanged.rowVersion).toBe(1);
    expect(stack.revokedTenantIds).toHaveLength(0);
    process.env.TENANT_LIFECYCLE_ENABLED = 'true';
  });

  it('unrelated roles lack lifecycle mutation permissions', async () => {
    const stack = createLifecycleStack(prisma, { permissions: ['tenant.view'] });
    const actor = await createPlatformUserFixture(prisma, {
      email: `lc-sales-${randomUUID()}@test.local`,
      roleKeys: ['sales_manager'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const preview = await stack.service.preview(claims, seeded.tenantId, 'suspend');
    await expect(
      stack.service.suspend(
        claims,
        seeded.tenantId,
        {
          expectedRowVersion: 1,
          reason: 'denied',
          previewFingerprint: preview.previewFingerprint,
        },
        `den-${randomUUID()}`,
      ),
    ).rejects.toThrow(/Missing tenant\.suspend/);
  });

  it('fingerprint hash in audit is truncated and not raw preview', async () => {
    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `lc-fp-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(
      stack,
      claims,
      seeded.tenantId,
      'suspend',
      1,
    );
    await stack.service.suspend(claims, seeded.tenantId, body, `fp-${randomUUID()}`);
    const audit = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'tenant_lifecycle.suspend', resourceId: seeded.tenantId },
    });
    const details = audit.details as { fingerprint?: string };
    expect(details.fingerprint).toHaveLength(16);
    expect(details.fingerprint).toBe(
      createHash('sha256').update(body.previewFingerprint).digest('hex').slice(0, 16),
    );
  });
});
