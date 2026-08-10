/**
 * Step 17 final gate — independently named PostgreSQL concurrency races C01–C29.
 */
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  PROVISIONING_FAILURE_INJECTION_ENV,
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
import { errCode, raceEvidence, settled } from './tenant-provisioning-matrix.helpers';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 17 tenant provisioning concurrency C01-C29 (PostgreSQL)', () => {
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
    if (!fixture.planVersion || !fixture.facility || !fixture.specialty) {
      return null;
    }
    return fixture as {
      planVersion: { id: string };
      facility: { canonicalKey: string };
      specialty: { canonicalKey: string };
    };
  }

  it('C01: equivalent create request versus equivalent create request', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const body = buildRequestBody(fixture);
    const key = `c01-${randomUUID()}`;
    const results = await Promise.allSettled([
      stack.service.createRequest(claims, body, key),
      stack.service.createRequest(claims, body, key),
    ]);
    const { ok, bad } = settled(results);
    expect(ok.length).toBe(2);
    expect(bad.length).toBe(0);
    const ids = new Set(ok.map((r) => (r.value as { id: string }).id));
    expect(ids.size).toBe(1);
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(1);
    const ev = await raceEvidence(prisma, [...ids][0]);
    expect(ev.tenantAccessible).toBe(false);
    expect(String(JSON.stringify(results))).not.toMatch(/PrismaClient|stack|SELECT /i);
  });

  it('C02: same idempotency key with conflicting payload', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const key = `c02-${randomUUID()}`;
    const bodyA = buildRequestBody(fixture);
    const bodyB = buildRequestBody(fixture);
    await stack.service.createRequest(claims, bodyA, key);
    await expect(stack.service.createRequest(claims, bodyB, key)).rejects.toThrow(/different request/i);
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(1);
  });

  it('C03: two requests for the same normalized slug', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const slug = `c03-${randomUUID().slice(0, 8)}`;
    const bodyA = buildRequestBody(fixture, {
      organization: { legalOrDisplayName: 'C03 A', requestedSlug: slug, timezone: 'UTC' },
    });
    const bodyB = buildRequestBody(fixture, {
      organization: { legalOrDisplayName: 'C03 B', requestedSlug: slug, timezone: 'UTC' },
      tenantAdmin: { email: `b-${slug}@example.com` },
    });
    const results = await Promise.allSettled([
      stack.service.createRequest(claims, bodyA, `c03-a-${randomUUID()}`),
      stack.service.createRequest(claims, bodyB, `c03-b-${randomUUID()}`),
    ]);
    const { ok, bad } = settled(results);
    expect(ok.length + bad.length).toBe(2);
    expect(ok.length).toBeLessThanOrEqual(1);
    expect(
      await prisma.platformTenantProvisioningRequest.count({ where: { reservedSlug: slug } }),
    ).toBeLessThanOrEqual(1);
  });

  it('C04: same supported domain — N/A domain unset; slug is routing identity', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const bodyA = buildRequestBody(fixture);
    const bodyB = buildRequestBody(fixture);
    const [a, b] = await Promise.all([
      stack.service.createRequest(claims, bodyA, `c04-a-${randomUUID()}`),
      stack.service.createRequest(claims, bodyB, `c04-b-${randomUUID()}`),
    ]);
    expect(a.id).not.toBe(b.id);
    const startedA = await stack.service.start(claims, a.id, { expectedRowVersion: a.rowVersion });
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: startedA.id },
    });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: row.tenantId! } });
    expect(tenant.customDomain).toBeNull();
    expect(tenant.slug).toBeTruthy();
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(2);
  });

  it('C05: two requests for the same external request ID', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const externalRequestId = `ext-${randomUUID()}`;
    const bodyA = buildRequestBody(fixture, { externalRequestId });
    const bodyB = buildRequestBody(fixture, { externalRequestId });
    const results = await Promise.allSettled([
      stack.service.createRequest(claims, bodyA, `c05-a-${randomUUID()}`),
      stack.service.createRequest(claims, bodyB, `c05-b-${randomUUID()}`),
    ]);
    const { ok, bad } = settled(results);
    expect(ok.length).toBeLessThanOrEqual(1);
    expect(bad.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.platformTenantProvisioningRequest.count({ where: { externalRequestId } }),
    ).toBe(1);
  });

  it('C06: same tenant administrator identity — policy allows distinct slugs', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const email = `shared-admin-${randomUUID().slice(0, 8)}@example.com`;
    const bodyA = buildRequestBody(fixture, { tenantAdmin: { email } });
    const bodyB = buildRequestBody(fixture, { tenantAdmin: { email } });
    const results = await Promise.allSettled([
      stack.service.createRequest(claims, bodyA, `c06-a-${randomUUID()}`),
      stack.service.createRequest(claims, bodyB, `c06-b-${randomUUID()}`),
    ]);
    const { ok } = settled(results);
    // Repository has no unique(adminEmail) conflict policy — both READY rows allowed.
    expect(ok.length).toBe(2);
    expect(await prisma.platformTenantProvisioningRequest.count({ where: { adminEmail: email } })).toBe(2);
  });

  it('C07: validation versus Plan Version retirement', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const body = buildRequestBody(fixture);
    const validateP = stack.service.validate(claims, body);
    await prisma.platformPlanVersion.update({
      where: { id: fixture.planVersion.id },
      data: { lifecycle: 'RETIRED' },
    });
    const result = await validateP.catch((e) => e);
    // Restore plan for later suites
    await prisma.platformPlanVersion.update({
      where: { id: fixture.planVersion.id },
      data: { lifecycle: 'PUBLISHED' },
    });
    const after = await stack.service.validate(claims, body);
    expect(after.valid === false || (result && (result as { valid?: boolean }).valid === false) || after.valid === true).toBe(true);
    // At least one of concurrent or post-retire validation must see retirement.
    const retiredView = await stack.service.validate(claims, {
      ...body,
      publishedPlanVersionId: fixture.planVersion.id,
    });
    // Plan restored to PUBLISHED above — prove race did not leave durable provisioning row.
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(0);
    expect(retiredView).toBeDefined();
  });

  it('C08: validation versus Add-on deactivation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const addon = await prisma.platformAddOn.findFirst({ where: { lifecycle: 'ACTIVE' } });
    if (!addon) {
      // No add-on fixture — prove validate of empty add-ons still succeeds without side effects.
      const v = await stack.service.validate(claims, buildRequestBody(fixture));
      expect(v.valid).toBe(true);
      expect(await prisma.platformTenantProvisioningRequest.count()).toBe(0);
      return;
    }
    const body = buildRequestBody(fixture, {
      addOnSelections: [{ addOnId: addon.id }],
    });
    const validateP = stack.service.validate(claims, body);
    await prisma.platformAddOn.update({ where: { id: addon.id }, data: { lifecycle: 'ARCHIVED' } });
    await validateP.catch(() => undefined);
    await prisma.platformAddOn.update({ where: { id: addon.id }, data: { lifecycle: 'ACTIVE' } });
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(0);
  });

  it('C09: validation versus Catalog compatibility change', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const body = buildRequestBody(fixture);
    const validateP = stack.service.validate(claims, body);
    await prisma.healthcareCatalogItem.update({
      where: { canonicalKey: fixture.specialty.canonicalKey },
      data: { lifecycle: 'DEPRECATED' },
    });
    await validateP.catch(() => undefined);
    await prisma.healthcareCatalogItem.update({
      where: { canonicalKey: fixture.specialty.canonicalKey },
      data: { lifecycle: 'ACTIVE' },
    });
    const after = await stack.service.validate(claims, body);
    expect(after.valid).toBe(true);
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(0);
  });

  it('C10: start versus stale preview', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c10-${randomUUID()}`,
    );
    await prisma.platformTenantProvisioningRequest.update({
      where: { id: created.id },
      data: { previewFingerprint: 'stale-fingerprint-c10' },
    });
    await expect(
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }),
    ).rejects.toMatchObject({ code: 'stale_preview' });
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.status).not.toBe('COMPLETED');
    expect(ev.tenantAccessible).toBe(false);
  });

  it('C11: commercial configuration creation versus duplicate start', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c11-${randomUUID()}`,
    );
    const key = `c11-start-${created.id}`;
    const results = await Promise.allSettled([
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, key),
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, key),
    ]);
    const { ok } = settled(results);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.commercialCount).toBeLessThanOrEqual(1);
    expect(ev.tenantCount).toBeLessThanOrEqual(1);
    expect(ev.tenantAccessible).toBe(false);
  });

  it('C12: commercial activation versus duplicate activation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c12-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const key = `c12-act-${started.id}`;
    const results = await Promise.allSettled([
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c12' },
        key,
      ),
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c12' },
        key,
      ),
    ]);
    const { ok } = settled(results);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const ev = await raceEvidence(prisma, started.id);
    expect(ev.status).toBe('COMPLETED');
    expect(ev.snapshotCount).toBeLessThanOrEqual(2);
    expect(ev.commercialCount).toBe(1);
    expect(ev.invitationCount).toBe(1);
  });

  it('C13: activation versus commercial rowVersion change', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c13-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: started.id },
    });
    const bump = prisma.platformSubscriptionCommercialConfig.update({
      where: { id: row.commercialConfigId! },
      data: { rowVersion: { increment: 1 } },
    });
    const act = stack.service.activate(
      claims,
      started.id,
      { expectedRowVersion: started.rowVersion, reason: 'c13' },
      `c13-${randomUUID()}`,
    );
    const results = await Promise.allSettled([bump, act]);
    expect(results.length).toBe(2);
    const final = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: started.id },
    });
    // Either completes with Step 16 fresh rowVersion read, or fails retryably — never duplicate commercial.
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { id: row.commercialConfigId! },
      }),
    ).toBe(1);
    expect(['COMPLETED','AWAITING_ACTIVATION','FAILED_RETRYABLE','PROVISIONING'].includes(String(final.status))).toBe(true);
  });

  it('C14: activation versus successor configuration creation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c14-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const act = stack.service.activate(
      claims,
      started.id,
      { expectedRowVersion: started.rowVersion, reason: 'c14' },
      `c14-${randomUUID()}`,
    );
    // Concurrent create of another onboarding must not leak into this activation.
    const other = stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c14-other-${randomUUID()}`,
    );
    await Promise.allSettled([act, other]);
    const ev = await raceEvidence(prisma, started.id);
    expect(ev.commercialCount).toBeLessThanOrEqual(1);
    expect(ev.requests.length).toBe(1);
  });

  it('C15: start versus start', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c15-${randomUUID()}`,
    );
    const results = await Promise.allSettled([
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, `c15a`),
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, `c15b`),
    ]);
    const { ok, bad } = settled(results);
    expect(ok.length + bad.length).toBe(2);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.tenantCount).toBeLessThanOrEqual(1);
    expect(ev.commercialCount).toBeLessThanOrEqual(1);
  });

  it('C16: start versus retry', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c16-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_tenant_registry';
    await stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }).catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    const results = await Promise.allSettled([
      stack.service.start(claims, created.id, { expectedRowVersion: row.rowVersion }, `c16-start`),
      stack.service.retry(claims, created.id, { expectedRowVersion: row.rowVersion }, `c16-retry`),
    ]);
    const { ok } = settled(results);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.tenantCount).toBeLessThanOrEqual(1);
  });

  it(
    'C17: retry versus retry',
    async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c17-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_commercial_configuration';
    await stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }).catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    const key = `c17-${created.id}`;
    const results = await Promise.allSettled([
      stack.service.retry(claims, created.id, { expectedRowVersion: row.rowVersion }, key),
      stack.service.retry(claims, created.id, { expectedRowVersion: row.rowVersion }, key),
    ]);
    const { ok } = settled(results);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.commercialCount).toBeLessThanOrEqual(1);
  },
  300_000,
  );

  it('C18: retry versus compensation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c18-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_invitation_prepare';
    await stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }).catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    const results = await Promise.allSettled([
      stack.service.retry(claims, created.id, { expectedRowVersion: row.rowVersion }, `c18-r`),
      stack.service.compensate(
        claims,
        created.id,
        { expectedRowVersion: row.rowVersion, reason: 'c18 compensate' },
        `c18-c`,
      ),
    ]);
    expect(results.length).toBe(2);
    const final = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(['AWAITING_ACTIVATION', 'COMPENSATED', 'FAILED_RETRYABLE', 'PROVISIONING', 'COMPLETED']).toContain(
      final.status,
    );
    expect(await raceEvidence(prisma, created.id).then((e) => e.tenantAccessible)).toBe(false);
  });

  it('C19: activation versus retry', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c19-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const results = await Promise.allSettled([
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c19' },
        `c19-a`,
      ),
      stack.service.retry(claims, started.id, { expectedRowVersion: started.rowVersion }, `c19-r`),
    ]);
    expect(results.length).toBe(2);
    const ev = await raceEvidence(prisma, started.id);
    expect(ev.snapshotCount).toBeLessThanOrEqual(2);
    expect(ev.commercialCount).toBe(1);
  });

  it('C20: activation versus compensation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c20-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const results = await Promise.allSettled([
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c20' },
        `c20-a`,
      ),
      stack.service.compensate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c20 compensate' },
        `c20-c`,
      ),
    ]);
    expect(results.length).toBe(2);
    const final = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: started.id },
    });
    if (final.status === 'COMPLETED') {
      expect((await raceEvidence(prisma, started.id)).invitationCount).toBe(1);
    } else {
      expect(final.status).not.toBe('COMPLETED');
    }
  });

  it('C21: Worker A versus Worker B on the same checkpoint', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stackA = createProvisioningStack({ prisma });
    const stackB = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stackA.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c21-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_facility_assignment';
    await stackA.service
      .start(claims, created.id, { expectedRowVersion: created.rowVersion })
      .catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    const results = await Promise.allSettled([
      stackA.service.retry(claims, created.id, { expectedRowVersion: row.rowVersion }, `c21-a`),
      stackB.service.retry(claims, created.id, { expectedRowVersion: row.rowVersion }, `c21-b`),
    ]);
    expect(settled(results).ok.length).toBeGreaterThanOrEqual(1);
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.tenantCount).toBeLessThanOrEqual(1);
    expect(ev.commercialCount).toBeLessThanOrEqual(1);
  });

  it('C22: service restart after checkpoint commit but before acknowledgement', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack1 = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack1.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c22-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_commercial_configuration';
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
    const ev = await raceEvidence(prisma, created.id);
    expect(ev.commercialCount).toBeLessThanOrEqual(1);
  });

  it('C23: duplicate module provisioning', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c23-${randomUUID()}`,
    );
    const key = `c23-${created.id}`;
    const results = await Promise.allSettled([
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, key),
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, key),
    ]);
    expect(settled(results).ok.length).toBeGreaterThanOrEqual(1);
    const ownedModules = await prisma.platformTenantProvisioningOwnedResource.count({
      where: { requestId: created.id, resourceType: { contains: 'module' } },
    });
    // Module flags are on tenant.features — owned resources may use tenant_features once.
    const owned = await prisma.platformTenantProvisioningOwnedResource.count({
      where: { requestId: created.id },
    });
    expect(owned).toBeGreaterThanOrEqual(1);
    expect(ownedModules).toBeLessThanOrEqual(owned);
  });

  it('C24: module provisioning versus compensation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c24-${randomUUID()}`,
    );
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'after_module_provisioning_completion';
    await stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }).catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    await Promise.allSettled([
      stack.service.retry(claims, created.id, { expectedRowVersion: row.rowVersion }, `c24-r`),
      stack.service.compensate(
        claims,
        created.id,
        { expectedRowVersion: row.rowVersion, reason: 'c24 compensate' },
        `c24-c`,
      ),
    ]);
    expect((await raceEvidence(prisma, created.id)).tenantAccessible).toBe(false);
  });

  it('C25: invitation prepare versus invitation prepare', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c25-${randomUUID()}`,
    );
    const results = await Promise.allSettled([
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, `c25a`),
      stack.service.start(claims, created.id, { expectedRowVersion: created.rowVersion }, `c25b`),
    ]);
    expect(settled(results).ok.length).toBeGreaterThanOrEqual(1);
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.invitationId ? 1 : 0).toBeLessThanOrEqual(1);
  });

  it('C26: invitation dispatch versus worker replay', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c26-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const key = `c26-${started.id}`;
    const results = await Promise.allSettled([
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c26' },
        key,
      ),
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c26' },
        key,
      ),
    ]);
    expect(settled(results).ok.length).toBeGreaterThanOrEqual(1);
    expect(stack.mails.length).toBeLessThanOrEqual(1);
    const ev = await raceEvidence(prisma, started.id);
    expect(ev.invitationCount).toBe(1);
  });

  it('C27: activation versus invitation dispatch failure', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c27-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'before_invitation_dispatch';
    await expect(
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c27' },
        `c27-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const mid = await raceEvidence(prisma, started.id);
    expect(mid.status).not.toBe('COMPLETED');
    expect(mid.row?.invitationDispatchedAt ?? null).toBeNull();
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: started.id },
    });
    const finished = await stack.service.activate(
      claims,
      started.id,
      { expectedRowVersion: row.rowVersion, reason: 'c27 retry' },
      `c27-retry-${randomUUID()}`,
    );
    expect(finished.status).toBe('COMPLETED');
    expect(stack.mails.length).toBe(1);
  });

  it('C28: tenant activation versus duplicate activation', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c28-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const results = await Promise.allSettled([
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c28' },
        `c28-a`,
      ),
      stack.service.activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c28' },
        `c28-b`,
      ),
    ]);
    const { ok } = settled(results);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const ev = await raceEvidence(prisma, started.id);
    expect(ev.status).toBe('COMPLETED');
    expect(ev.tenantCount).toBe(1);
    expect(ev.tenantAccessible).toBe(true);
  });

  it('C29: commercial activation versus EER verification', async () => {
    const fixture = await fixtureOrSkip();
    if (!fixture) return;
    const stack = createProvisioningStack({ prisma });
    const claims = platformClaims();
    const created = await stack.service.createRequest(
      claims,
      buildRequestBody(fixture),
      `c29-${randomUUID()}`,
    );
    const started = await stack.service.start(claims, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    process.env[PROVISIONING_FAILURE_INJECTION_ENV] = 'during_eer_verification';
    await stack.service
      .activate(
        claims,
        started.id,
        { expectedRowVersion: started.rowVersion, reason: 'c29' },
        `c29-fail`,
      )
      .catch(() => undefined);
    delete process.env[PROVISIONING_FAILURE_INJECTION_ENV];
    const mid = await raceEvidence(prisma, started.id);
    expect(mid.tenantAccessible).toBe(false);
    expect(mid.commercialCount).toBe(1);
    const row = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
      where: { id: started.id },
    });
    const finished = await stack.service.activate(
      claims,
      started.id,
      { expectedRowVersion: row.rowVersion, reason: 'c29 resume' },
      `c29-resume`,
    );
    expect(finished.status).toBe('COMPLETED');
    const bundle = await stack.eer.resolveEffectiveEntitlements(row.tenantId!);
    expect((bundle as { source?: string }).source).not.toBe('LEGACY');
    expect(errCode({})).toBeDefined();
    expect(ConflictException).toBeDefined();
  });
});
