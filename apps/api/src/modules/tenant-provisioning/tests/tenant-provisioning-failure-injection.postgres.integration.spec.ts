/**
 * Step 17 final gate — independently named failure injection points F01–F33.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  PROVISIONING_FAILURE_INJECTION_ENV,
  type ProvisioningFailureInjectionPoint,
} from '../domain/tenant-provisioning.types';
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
import { raceEvidence } from './tenant-provisioning-matrix.helpers';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const CREATE_POINTS: Array<{ id: string; point: ProvisioningFailureInjectionPoint }> = [
  { id: 'F01', point: 'after_validation' },
  { id: 'F02', point: 'after_idempotency_claim' },
  { id: 'F03', point: 'after_workflow_row_creation' },
  { id: 'F28', point: 'after_audit_staging' },
  { id: 'F29', point: 'after_idempotency_completion_staging' },
  { id: 'F30', point: 'before_transaction_commit' },
];

const START_POINTS: Array<{ id: string; point: ProvisioningFailureInjectionPoint }> = [
  { id: 'F04', point: 'after_tenant_slug_reservation' },
  { id: 'F05', point: 'after_tenant_registry' },
  { id: 'F06', point: 'after_initial_tenant_settings' },
  { id: 'F07', point: 'after_facility_assignment' },
  { id: 'F08', point: 'after_specialty_assignment' },
  { id: 'F09', point: 'after_commercial_configuration' },
  { id: 'F10', point: 'after_addon_assignment' },
  { id: 'F11', point: 'after_entitlement_preview_persistence' },
  { id: 'F12', point: 'during_first_module_provisioning' },
  { id: 'F13', point: 'after_partial_module_provisioning' },
  { id: 'F14', point: 'after_module_provisioning_completion' },
  { id: 'F15', point: 'during_initial_limit_integration' },
  { id: 'F16', point: 'during_u01_initialization' },
  { id: 'F17', point: 'after_invitation_prepare' },
];

const ACTIVATE_POINTS: Array<{ id: string; point: ProvisioningFailureInjectionPoint }> = [
  { id: 'F18', point: 'before_commercial_activation' },
  { id: 'F19', point: 'after_commercial_activation' },
  { id: 'F20', point: 'after_activation_snapshot_creation' },
  { id: 'F21', point: 'during_eer_verification' },
  { id: 'F22', point: 'after_eer_verification' },
  { id: 'F23', point: 'before_tenant_activation' },
  { id: 'F24', point: 'after_tenant_activation' },
  { id: 'F25', point: 'before_invitation_dispatch' },
  { id: 'F26', point: 'after_invitation_dispatch' },
  { id: 'F27', point: 'before_workflow_completion' },
  { id: 'F31', point: 'worker_crash_after_commit_before_ack' },
];

describeDb('Step 17 tenant provisioning failure injection F01-F33 (PostgreSQL)', () => {
  // Sequential Case C load can push create/start/retry past the 120s integration default.
  jest.setTimeout(300_000);

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

  async function fixtureOrSkip() {
    const fixture = await findPublishedPlanFixture(prisma);
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return null;
    return fixture as {
      planVersion: { id: string };
      facility: { canonicalKey: string };
      specialty: { canonicalKey: string };
    };
  }

  function assertSafeError(err: unknown) {
    const text = JSON.stringify(err, Object.getOwnPropertyNames(err as object));
    expect(text).not.toMatch(/PrismaClientKnownRequestError|password|Bearer |SELECT \*|stack trace/i);
  }

  for (const { id, point } of CREATE_POINTS) {
    it(`${id}: ${point}`, async () => {
      const fixture = await fixtureOrSkip();
      if (!fixture) return;
      const stack = createProvisioningStack({ prisma });
      const before = await prisma.platformTenantProvisioningRequest.count();
      process.env[PROVISIONING_FAILURE_INJECTION_ENV] = point;
      await expect(
        stack.service.createRequest(
          platformClaims(),
          buildRequestBody(fixture),
          `${id}-${randomUUID()}`,
        ),
      ).rejects.toMatchObject({ code: 'injected_failure' });
      delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];

      const after = await prisma.platformTenantProvisioningRequest.count();
      if (point === 'after_validation' || point === 'after_idempotency_claim') {
        expect(after).toBe(before);
      } else if (
        point === 'after_workflow_row_creation' ||
        point === 'after_idempotency_completion_staging' ||
        point === 'before_transaction_commit'
      ) {
        // Inside create TX — rolled back
        expect(after).toBe(before);
      } else if (point === 'after_audit_staging') {
        // After durable create + audit — row may remain; must not be COMPLETED workflow activation
        expect(after).toBeGreaterThanOrEqual(before);
        const rows = await prisma.platformTenantProvisioningRequest.findMany();
        for (const r of rows) {
          expect(r.status).not.toBe('COMPLETED');
        }
      }
      expect(await prisma.platformTenantProvisioningRequest.count({ where: { status: 'COMPLETED' } })).toBe(0);
    });
  }

  for (const { id, point } of START_POINTS) {
    it(`${id}: ${point}`, async () => {
      const fixture = await fixtureOrSkip();
      if (!fixture) return;
      const stack = createProvisioningStack({ prisma });
      const claims = platformClaims();
      const created = await stack.service.createRequest(
        claims,
        buildRequestBody(fixture),
        `${id}-c-${randomUUID()}`,
      );
      process.env[PROVISIONING_FAILURE_INJECTION_ENV] = point;
      let thrown: unknown;
      try {
        await stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion });
      } catch (err) {
        thrown = err;
      }
      delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
      expect(thrown).toMatchObject({ code: 'injected_failure' });
      assertSafeError(thrown);

      const ev = await raceEvidence(prisma, created.id);
      expect(ev.status).not.toBe('COMPLETED');
      expect(ev.tenantAccessible).toBe(false);
      expect(ev.snapshotCount).toBe(0);
      // Retryability: clear inject and retry must not leave false COMPLETED from injection
      const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
        where: { id: created.id },
      });
      const resumed = await stack.service.retry(claims, created.id, {
        expectedRowVersion: row.rowVersion,
      });
      expect(resumed.status).not.toBe('COMPLETED');
      expect(['AWAITING_ACTIVATION', 'PROVISIONING', 'FAILED_RETRYABLE', 'READY']).toContain(
        resumed.status,
      );
    });
  }

  for (const { id, point } of ACTIVATE_POINTS) {
    it(`${id}: ${point}`, async () => {
      const fixture = await fixtureOrSkip();
      if (!fixture) return;
      const stack = createProvisioningStack({ prisma });
      const claims = platformClaims();
      const created = await stack.service.createRequest(
        claims,
        buildRequestBody(fixture),
        `${id}-c-${randomUUID()}`,
      );
      const started = await stack.service.start(claims, created.id, {
        expectedRowVersion: created.rowVersion,
      });
      process.env[PROVISIONING_FAILURE_INJECTION_ENV] = point;
      let thrown: unknown;
      try {
        await stack.service.activate(
          claims,
          started.id,
          { expectedRowVersion: started.rowVersion, reason: `${id}` },
          `${id}-a-${randomUUID()}`,
        );
      } catch (err) {
        thrown = err;
      }
      delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];

      if (point === 'worker_crash_after_commit_before_ack') {
        // Durable COMPLETED already committed; inject simulates post-commit crash before ack.
        expect(thrown).toMatchObject({ code: 'injected_failure' });
        const ev = await raceEvidence(prisma, started.id);
        expect(ev.status).toBe('COMPLETED');
        expect(ev.tenantAccessible).toBe(true);
        expect(ev.invitationCount).toBe(1);
        // Client re-drive with same idempotency must replay, not duplicate
        const replay = await stack.service.activate(
          claims,
          started.id,
          { expectedRowVersion: ev.rowVersion!, reason: `${id}-replay` },
          `${id}-a-replay`,
        );
        expect(replay.status).toBe('COMPLETED');
        expect(stack.mails.length).toBeLessThanOrEqual(1);
        return;
      }

      expect(thrown).toMatchObject({ code: 'injected_failure' });
      assertSafeError(thrown);
      const mid = await raceEvidence(prisma, started.id);
      expect(mid.status).not.toBe('COMPLETED');
      if (
        [
          'after_commercial_activation',
          'after_activation_snapshot_creation',
          'during_eer_verification',
          'after_eer_verification',
          'before_tenant_activation',
        ].includes(point)
      ) {
        expect(mid.tenantAccessible).toBe(false);
      }
      if (
        [
          'after_tenant_activation',
          'before_invitation_dispatch',
          'after_invitation_dispatch',
          'before_workflow_completion',
        ].includes(point)
      ) {
        expect(String(mid.status)).not.toBe('COMPLETED');
      }

      const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
        where: { id: started.id },
      });
      const finished = await stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: row.rowVersion, reason: `${id}-resume` },
        `${id}-resume-${randomUUID()}`,
      );
      expect(finished.status).toBe('COMPLETED');
      const done = await raceEvidence(prisma, started.id);
      expect(done.snapshotCount).toBeGreaterThanOrEqual(1);
      expect(done.invitationCount).toBe(1);
    });
  }

  it('F32: compensation_failure', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `F32-c-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_tenant_registry';
    await stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }).catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'compensation_failure';
    await expect(
      stack.service.compensate(
        claims,
        created.id,
        { expectedRowVersion: row.rowVersion, reason: 'F32 compensate' },
        `F32-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const mid = await raceEvidence(prisma, created.id);
    expect(mid.status).not.toBe('COMPENSATED');
    expect(mid.tenantAccessible).toBe(false);
    // Compensation must not invent Step 19 archive/delete
    expect(JSON.stringify(mid)).not.toMatch(/archiv|restor|lifecycle_delete/i);
  });

  it('F33: retry_after_service_recreation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack1 = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack1.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `F33-c-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_entitlement_preview_persistence';
    await stack1.service
      .start(claims, created.id, { expectedRowVersion: created.rowVersion })
      .catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    const stack2 = createProvisioningStack({ prisma });
    const resumed = await stack2.service.retry(claims, created.id, {
      expectedRowVersion: row.rowVersion,
    });
    expect(['AWAITING_ACTIVATION', 'PROVISIONING', 'FAILED_RETRYABLE']).toContain(resumed.status);
    const activated = await stack2.service.activate(
      claims,
      created.id,
      { expectedRowVersion: resumed.rowVersion, reason: 'F33 activate' },
      `F33-a-${randomUUID()}`,
    );
    expect(activated.status).toBe('COMPLETED');
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.tenantCount).toBe(1);
    expect(ev.commercialCount).toBe(1);
    expect(ev.invitationCount).toBe(1);
    expect(ev.tenantAccessible).toBe(true);
  });
});
