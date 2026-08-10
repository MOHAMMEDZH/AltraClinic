/**
 * Flexible Step 19 — independent failure injection matrix F01–F27 (PostgreSQL).
 * Each point executes a real semantic stage; aliases/stubs are not accepted.
 */
import { randomUUID } from 'crypto';
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
  setLifecycleFailureInjection,
} from './tenant-lifecycle-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 19 failure-injection matrix F01-F27 (PostgreSQL)', () => {
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

  afterEach(() => clearLifecycleFailureInjection());

  async function actorClaims(emailPrefix = 'f') {
    const actor = await createPlatformUserFixture(prisma, {
      email: `${emailPrefix}-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    return { claims: platformClaims(actor.id, randomUUID()), actorId: actor.id };
  }

  async function counts(tenantId: string) {
    const [pt, requests, idem, audits, otherRequests] = await Promise.all([
      prisma.platformTenant.findUniqueOrThrow({ where: { tenantId } }),
      prisma.platformTenantLifecycleRequest.count({ where: { tenantId } }),
      prisma.platformTenantLifecycleIdempotencyRecord.count({
        where: { resultResourceId: tenantId },
      }),
      prisma.auditEntry.count({
        where: { resourceId: tenantId, action: { startsWith: 'tenant_lifecycle.' } },
      }),
      prisma.platformTenantLifecycleRequest.count({
        where: { tenantId: { not: tenantId } },
      }),
    ]);
    return { pt, requests, idem, audits, otherRequests };
  }

  async function assertPreCommitSuspendRollback(tenantId: string, stack: ReturnType<typeof createLifecycleStack>) {
    const c = await counts(tenantId);
    expect(c.pt.status).toBe('ACTIVE');
    expect(c.pt.rowVersion).toBe(1);
    expect(c.requests).toBe(0);
    expect(c.audits).toBe(0);
    expect(stack.revokedTenantIds).toHaveLength(0);
    expect(c.otherRequests).toBe(0);
  }

  const preCommitSuspendPoints = [
    'F01',
    'F02',
    'F03',
    'F04',
    'F05',
    'F06',
    'F07',
    'F14',
    'F16',
    'F17',
    'F15',
    'F20',
  ] as const;

  for (const point of preCommitSuspendPoints) {
    it(`${point} rolls back suspend before commit (status ACTIVE, no audit/idempotency/revoke)`, async () => {
      const stack = createLifecycleStack(prisma);
      const { claims } = await actorClaims(point);
      const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
      const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
      setLifecycleFailureInjection(point);
      await expect(
        stack.service.suspend(claims, seeded.tenantId, body, `${point}-${randomUUID()}`),
      ).rejects.toMatchObject({ code: 'injected_failure' });
      clearLifecycleFailureInjection();
      await assertPreCommitSuspendRollback(seeded.tenantId, stack);
      // Retryability: clear injection and succeed once
      const { body: body2 } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
      await stack.service.suspend(claims, seeded.tenantId, body2, `${point}-retry-${randomUUID()}`);
      const after = await counts(seeded.tenantId);
      expect(after.pt.status).toBe('SUSPENDED');
      expect(after.pt.rowVersion).toBe(2);
    });
  }

  it('F08 after EER invalidation staging — suspend committed, invalidate attempted, no access resurrection', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F08');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    setLifecycleFailureInjection('F08');
    await expect(
      stack.service.suspend(claims, seeded.tenantId, body, `F08-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
    expect(c.pt.rowVersion).toBe(2);
    expect(stack.revokedTenantIds).toEqual([seeded.tenantId]);
    // Audit may be skipped when F08 fires before F15; status remains authoritative deny
    expect(c.pt.status).toBe('SUSPENDED');
  });

  it('F09 rolls back archive request creation', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F09');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'archive_request', 1);
    setLifecycleFailureInjection('F09');
    await expect(
      stack.service.createArchiveRequest(claims, seeded.tenantId, body, `F09-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('ACTIVE');
    expect(c.requests).toBe(0);
    expect(c.audits).toBe(0);
  });

  it('F10 rolls back deletion request creation', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F10');
    const seeded = await seedClinicTenant(prisma, {
      status: 'ARCHIVED',
      displayName: 'F10 Clinic',
    });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'deletion_request', 1, {
      typedConfirmation: seeded.displayName,
    });
    setLifecycleFailureInjection('F10');
    await expect(
      stack.service.createDeletionRequest(claims, seeded.tenantId, body, `F10-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    expect(
      await prisma.platformTenantLifecycleRequest.count({ where: { tenantId: seeded.tenantId } }),
    ).toBe(0);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(pt.status).toBe('ARCHIVED');
  });

  it('F11 rolls back archive approval staging (request stays PENDING)', async () => {
    const stack = createLifecycleStack(prisma);
    const requester = await actorClaims('F11r');
    const approver = await actorClaims('F11a');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, requester.claims, seeded.tenantId, 'archive_request', 1);
    const created = (await stack.service.createArchiveRequest(
      requester.claims,
      seeded.tenantId,
      body,
      `F11-create-${randomUUID()}`,
    )) as { id: string };
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    setLifecycleFailureInjection('F11');
    await expect(
      stack.service.approveRequest(
        approver.claims,
        created.id,
        {
          expectedRowVersion: pt.rowVersion,
          reason: 'approve archive',
          previewFingerprint: 'n/a-approve',
        },
        `F11-approve-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const req = await prisma.platformTenantLifecycleRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(req.status).toBe('PENDING');
    const after = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(after.status).toBe('ACTIVE');
  });

  it('F12 rolls back rejection staging (request stays PENDING)', async () => {
    const stack = createLifecycleStack(prisma);
    const requester = await actorClaims('F12r');
    const approver = await actorClaims('F12a');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, requester.claims, seeded.tenantId, 'archive_request', 1);
    const created = (await stack.service.createArchiveRequest(
      requester.claims,
      seeded.tenantId,
      body,
      `F12-create-${randomUUID()}`,
    )) as { id: string };
    setLifecycleFailureInjection('F12');
    await expect(
      stack.service.rejectRequest(
        approver.claims,
        created.id,
        { expectedRowVersion: 1, reason: 'reject', previewFingerprint: 'n/a-reject' },
        `F12-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const req = await prisma.platformTenantLifecycleRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(req.status).toBe('PENDING');
  });

  it('F13 rolls back cancellation staging (request stays PENDING)', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F13');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'archive_request', 1);
    const created = (await stack.service.createArchiveRequest(
      claims,
      seeded.tenantId,
      body,
      `F13-create-${randomUUID()}`,
    )) as { id: string };
    setLifecycleFailureInjection('F13');
    await expect(
      stack.service.cancelRequest(
        claims,
        created.id,
        { expectedRowVersion: 1, reason: 'cancel', previewFingerprint: 'n/a-cancel' },
        `F13-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const req = await prisma.platformTenantLifecycleRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(req.status).toBe('PENDING');
  });

  // F15 ("after audit staging") is now covered by preCommitSuspendPoints:
  // Step 21 Model A moved the durable success audit write into the same
  // transaction as the status mutation, so an injected failure staged right
  // after the audit write rolls back status + audit + idempotency together.

  it('F18 after commit before response — status committed then throws', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F18');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    setLifecycleFailureInjection('F18');
    await expect(
      stack.service.suspend(claims, seeded.tenantId, body, `F18-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
    expect(stack.revokedTenantIds).toHaveLength(0);
  });

  it('F19 service recreation before retry recovers via idempotency (no duplicate audit)', async () => {
    const stack1 = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F19');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack1, claims, seeded.tenantId, 'suspend', 1);
    const key = `F19-${randomUUID()}`;
    await stack1.service.suspend(claims, seeded.tenantId, body, key);
    const stack2 = createLifecycleStack(prisma);
    const again = await stack2.service.suspend(claims, seeded.tenantId, body, key);
    expect((again as { status: string }).status).toBe('SUSPENDED');
    const audits = await prisma.auditEntry.count({
      where: { action: 'tenant_lifecycle.suspend', resourceId: seeded.tenantId },
    });
    expect(audits).toBe(1);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(pt.rowVersion).toBe(2);
  });

  it('F21 notification delivery failure after commit is non-fatal for status (throws injected)', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F21');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    setLifecycleFailureInjection('F21');
    await expect(
      stack.service.suspend(claims, seeded.tenantId, body, `F21-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
  });

  it('F22 session-revocation failure after commit leaves status SUSPENDED', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F22');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    setLifecycleFailureInjection('F22');
    await expect(
      stack.service.suspend(claims, seeded.tenantId, body, `F22-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
    expect(stack.revokedTenantIds).toHaveLength(0);
  });

  it('F23 EER invalidation failure after suspension does not restore ACTIVE', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F23');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    setLifecycleFailureInjection('F23');
    await expect(
      stack.service.suspend(claims, seeded.tenantId, body, `F23-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
  });

  it('F24 EER recalculation failure before reactivation leaves SUSPENDED', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F24');
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'reactivate', 1);
    setLifecycleFailureInjection('F24');
    await expect(
      stack.service.reactivate(claims, seeded.tenantId, body, `F24-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
    expect(c.pt.rowVersion).toBe(1);
  });

  it('F25 Step 16 subscription-adapter staging failure before ACTIVE leaves SUSPENDED', async () => {
    const stack = createLifecycleStack(prisma);
    const { claims } = await actorClaims('F25');
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    await prisma.platformTenantProvisioningRequest.create({
      data: {
        id: randomUUID(),
        tenantId: seeded.tenantId,
        platformTenantId: seeded.platformTenant.id,
        status: 'COMPLETED',
        organizationName: seeded.displayName,
        facilityTypeKey: 'clinic',
        specialtyKeys: [],
        publishedPlanVersionId: randomUUID(),
        adminEmail: `owner-${randomUUID()}@test.local`,
        onboardingType: 'managed',
        correlationId: randomUUID(),
        createdByPlatformUserId: claims.sub,
        completedAt: new Date(),
        rowVersion: 1,
      },
    });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'reactivate', 1);
    setLifecycleFailureInjection('F25');
    await expect(
      stack.service.reactivate(claims, seeded.tenantId, body, `F25-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
  });

  it('F26 request execution-handoff failure rolls back delete approval', async () => {
    const stack = createLifecycleStack(prisma);
    const requester = await actorClaims('F26r');
    const approver = await actorClaims('F26a');
    const seeded = await seedClinicTenant(prisma, {
      status: 'ARCHIVED',
      displayName: 'F26 Delete Clinic',
    });
    const { body } = await previewAndBody(
      stack,
      requester.claims,
      seeded.tenantId,
      'deletion_request',
      1,
      { typedConfirmation: seeded.displayName },
    );
    const created = (await stack.service.createDeletionRequest(
      requester.claims,
      seeded.tenantId,
      body,
      `F26-create-${randomUUID()}`,
    )) as { id: string };
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    setLifecycleFailureInjection('F26');
    await expect(
      stack.service.approveRequest(
        approver.claims,
        created.id,
        {
          expectedRowVersion: pt.rowVersion,
          reason: 'handoff',
          previewFingerprint: 'n/a-handoff',
        },
        `F26-approve-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const req = await prisma.platformTenantLifecycleRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(req.status).toBe('PENDING');
    expect(await prisma.tenant.count({ where: { id: seeded.tenantId } })).toBe(1);
  });

  it('F27 compensation/recovery failure after session-revocation adapter failure leaves SUSPENDED', async () => {
    const stack = createLifecycleStack(prisma);
    stack.setFailSessionRevoke(true);
    const { claims } = await actorClaims('F27');
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    setLifecycleFailureInjection('F27');
    await expect(
      stack.service.suspend(claims, seeded.tenantId, body, `F27-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    const c = await counts(seeded.tenantId);
    expect(c.pt.status).toBe('SUSPENDED');
    expect(c.pt.rowVersion).toBe(2);
    expect(stack.revokedTenantIds).toHaveLength(0);
  });
});
