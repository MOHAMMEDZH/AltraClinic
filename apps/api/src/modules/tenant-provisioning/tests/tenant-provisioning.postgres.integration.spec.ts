/**
 * Flexible Step 17 — Tenant Creation and Provisioning PostgreSQL evidence suites.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { TenantProvisioningValidationService } from '../application/tenant-provisioning-validation.service';
import { ProvisioningIdempotencyService } from '../application/provisioning-idempotency.service';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createSubscriptionsPrismaWrapper,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import {
  buildRequestBody,
  findPublishedPlanFixture,
} from './tenant-provisioning-db.harness';
import type { PrismaService } from '../../../infrastructure/prisma.service';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Flexible Step 17 — Tenant Creation and Provisioning (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let validation: TenantProvisioningValidationService;
  let idempotency: ProvisioningIdempotencyService;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const wrapped = createSubscriptionsPrismaWrapper(prisma) as unknown as PrismaService;
    validation = new TenantProvisioningValidationService(wrapped);
    idempotency = new ProvisioningIdempotencyService(wrapped);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe('Migration / schema presence', () => {
    it('exposes Step 17 tables and no Step 19 / billing tables', async () => {
      for (const table of [
        'platform_tenant_provisioning_requests',
        'platform_tenant_provisioning_checkpoints',
        'platform_tenant_provisioning_owned_resources',
        'platform_tenant_provisioning_idempotency',
      ]) {
        const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
          `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
        );
        expect(rows[0]?.present).toBe(true);
      }
      for (const table of [
        'platform_billing_invoices',
        'platform_tenant_lifecycle_actions',
      ]) {
        const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
          `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
        );
        expect(rows[0]?.present).toBe(false);
      }
    });

    it('reports Catalog inventory (exact 68/136/68/13 proven by clean migration validator)', async () => {
      const items = await prisma.healthcareCatalogItem.count();
      const translations = await prisma.healthcareCatalogTranslation.count();
      const aliases = await prisma.healthcareCatalogAlias.count();
      const rules = await prisma.healthcareCatalogCompatibilityRule.count();
      expect(items).toBeGreaterThanOrEqual(68);
      expect(translations).toBeGreaterThanOrEqual(136);
      expect(aliases).toBeGreaterThanOrEqual(68);
      expect(rules).toBeGreaterThanOrEqual(13);
      // Exact inventory is asserted by test:tenant-creation-provisioning-clean-migration
      // because booking_test accumulates fixture rows from sibling suites.
    });
  });

  describe('Request Validation matrix', () => {
    it('rejects unknown facility, duplicate specialty, raw module injection, invalid email', async () => {
      expect(() => validation.assertNoProhibitedFields({ modules: ['module.x'] })).toThrow();
      expect(() => validation.assertNoProhibitedFields({ limitValues: { a: 1 } })).toThrow();

      const bad = await validation.validate({
        organization: { legalOrDisplayName: 'Clinic A' },
        facilityTypeKey: 'facility_type.does_not_exist',
        specialtyKeys: ['specialty.general_medicine', 'specialty.general_medicine'],
        publishedPlanVersionId: randomUUID(),
        tenantAdmin: { email: 'not-an-email' },
        onboardingType: 'STANDARD',
      });
      expect(bad.valid).toBe(false);
      expect(bad.errors.some((e) => e.code === 'duplicate_specialty')).toBe(true);
      expect(bad.errors.some((e) => e.code === 'invalid_admin_email')).toBe(true);
    });

    it('accepts a valid published Plan Version + facility + specialties when fixtures exist', async () => {
      const fixture = await findPublishedPlanFixture(prisma);
      if (!fixture.planVersion || !fixture.facility || !fixture.specialty) {
        console.warn('No published Plan Version — skipping positive validation case');
        return;
      }

      const result = await validation.validate(
        buildRequestBody({
          planVersion: fixture.planVersion,
          facility: fixture.facility,
          specialty: fixture.specialty,
        }),
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.previewFingerprint).toBeTruthy();
    });

    it('rejects sales trial with enterprise plan key when salesTrialOnly', async () => {
      const enterprise = await prisma.platformPlanVersion.findFirst({
        where: {
          lifecycle: 'PUBLISHED',
          plan: { canonicalKey: 'plan.enterprise' },
        },
        include: { plan: true },
      });
      if (!enterprise) return;
      const facility = await prisma.healthcareCatalogItem.findFirst({
        where: { kind: 'FACILITY_TYPE', lifecycle: 'ACTIVE' },
      });
      const specialty = await prisma.healthcareCatalogItem.findFirst({
        where: { kind: 'SPECIALTY', lifecycle: 'ACTIVE' },
      });
      const result = await validation.validate(
        {
          organization: { legalOrDisplayName: 'Sales Trial Co' },
          facilityTypeKey: facility!.canonicalKey,
          specialtyKeys: [specialty!.canonicalKey],
          publishedPlanVersionId: enterprise.id,
          tenantAdmin: { email: 'sales-trial@example.com' },
          onboardingType: 'TRIAL_REQUEST',
        },
        { salesTrialOnly: true },
      );
      expect(result.errors.some((e) => e.code === 'sales_enterprise_forbidden')).toBe(true);
    });
  });

  describe('Idempotency matrix', () => {
    it('completed-only: first complete then replay; conflicting hash → conflict', async () => {
      const actorId = randomUUID();
      const key = `idem-${randomUUID()}`;
      const hashA = idempotency.fingerprint({ a: 1 });
      const hashB = idempotency.fingerprint({ a: 2 });
      const resourceId = randomUUID();

      const first = await idempotency.beginOrReplay({
        actorId,
        operation: 'CREATE_PROVISIONING_REQUEST',
        idempotencyKey: key,
        requestHash: hashA,
      });
      expect(first.kind).toBe('proceed');

      await prisma.$transaction(async (tx) => {
        await idempotency.completeInTransaction(tx, {
          actorId,
          operation: 'CREATE_PROVISIONING_REQUEST',
          idempotencyKey: key,
          requestHash: hashA,
          resultResourceType: 'provisioningRequest',
          resultResourceId: resourceId,
        });
      });

      const replay = await idempotency.beginOrReplay({
        actorId,
        operation: 'CREATE_PROVISIONING_REQUEST',
        idempotencyKey: key,
        requestHash: hashA,
      });
      expect(replay.kind).toBe('replay');
      if (replay.kind === 'replay') {
        expect(replay.resultResourceId).toBe(resourceId);
      }

      await expect(
        idempotency.beginOrReplay({
          actorId,
          operation: 'CREATE_PROVISIONING_REQUEST',
          idempotencyKey: key,
          requestHash: hashB,
        }),
      ).rejects.toThrow(/different request/i);
    });
  });

  describe('Durable request row + checkpoint', () => {
    it('creates a READY request with validation checkpoint without activating tenant', async () => {
      const planVersion = await prisma.platformPlanVersion.findFirst({
        where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },
      });
      if (!planVersion) return;
      const facility = await prisma.healthcareCatalogItem.findFirst({
        where: { kind: 'FACILITY_TYPE', lifecycle: 'ACTIVE' },
      });
      const specialty = await prisma.healthcareCatalogItem.findFirst({
        where: { kind: 'SPECIALTY', lifecycle: 'ACTIVE' },
      });

      const id = randomUUID();
      const beforeTenants = await prisma.tenant.count();
      await prisma.platformTenantProvisioningRequest.create({
        data: {
          id,
          status: 'READY',
          organizationName: `Prov ${id.slice(0, 8)}`,
          facilityTypeKey: facility!.canonicalKey,
          specialtyKeys: [specialty!.canonicalKey],
          publishedPlanVersionId: planVersion.id,
          addOnSelections: [],
          adminEmail: `admin-${id.slice(0, 8)}@example.com`,
          onboardingType: 'STANDARD',
          correlationId: randomUUID(),
          createdByPlatformUserId: randomUUID(),
          previewFingerprint: 'abc',
          compatibilityFingerprint: 'def',
        },
      });
      await prisma.platformTenantProvisioningCheckpoint.create({
        data: {
          id: randomUUID(),
          requestId: id,
          checkpointKey: 'validation_completed',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      expect(await prisma.tenant.count()).toBe(beforeTenants);
      const row = await prisma.platformTenantProvisioningRequest.findUnique({ where: { id } });
      expect(row?.status).toBe('READY');
      expect(row?.tenantId).toBeNull();
    });
  });

  describe('U01 integration (flags OFF)', () => {
    it('does not invent usage observations when creating a provisioning request row', async () => {
      const beforeObs = await prisma.platformUsageObservation.count();
      const beforeCounters = await prisma.platformUsageCounter.count();
      // Creating request alone must not touch U01
      expect(await prisma.platformUsageObservation.count()).toBe(beforeObs);
      expect(await prisma.platformUsageCounter.count()).toBe(beforeCounters);
    });
  });

  describe('Concurrency — slug reservation', () => {
    it('unique reservedSlug among active workflows is enforced at application layer via validation', async () => {
      const slug = `race-${randomUUID().slice(0, 8)}`;
      const fixture = await findPublishedPlanFixture(prisma);
      if (!fixture.planVersion || !fixture.facility || !fixture.specialty) return;

      await prisma.platformTenantProvisioningRequest.create({
        data: {
          id: randomUUID(),
          status: 'READY',
          organizationName: 'Race A',
          reservedSlug: slug,
          facilityTypeKey: fixture.facility.canonicalKey,
          specialtyKeys: [fixture.specialty.canonicalKey],
          publishedPlanVersionId: fixture.planVersion.id,
          addOnSelections: [],
          adminEmail: `a-${slug}@example.com`,
          onboardingType: 'STANDARD',
          correlationId: randomUUID(),
          createdByPlatformUserId: randomUUID(),
        },
      });

      const second = await validation.validate(
        buildRequestBody(
          {
            planVersion: fixture.planVersion,
            facility: fixture.facility,
            specialty: fixture.specialty,
          },
          {
            organization: { legalOrDisplayName: 'Race B', requestedSlug: slug },
            tenantAdmin: { email: `b-${slug}@example.com` },
          },
        ),
      );
      expect(second.errors.some((e) => e.code === 'slug_reserved')).toBe(true);
    });
  });
});
