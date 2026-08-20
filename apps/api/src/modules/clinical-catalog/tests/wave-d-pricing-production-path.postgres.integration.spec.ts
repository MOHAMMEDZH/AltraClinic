import { ClinicalPricingUnit, ClinicalPriceVersionStatus, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  createClinicalCatalogService,
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from './clinical-catalog-db.harness';
import { BookingCommercialResolver } from '../../scheduling/application/services/booking-commercial-resolver.service';
import { AppointmentSnapshotService } from '../../scheduling/application/services/appointment-snapshot.service';
import { BookingConcurrencyService } from '../../scheduling/application/services/booking-concurrency.service';
import { ProviderEligibilityService } from '../../scheduling/application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../../scheduling/application/services/service-resource-requirement.service';
import { CreateAppointmentHandler } from '../../scheduling/application/handlers/create-appointment.handler';
import { CreateAppointmentCommand } from '../../scheduling/application/commands/create-appointment.command';
import { ClinicalCatalogValidationError } from '../domain/clinical-catalog.errors';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const fakeAudit = {
  async record() {},
  async recordInTransaction() {},
};

describeDb('Wave D pricing production-path proof (publish + booking)', () => {
  let prisma: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let branchId: string;
  let actorId: string;
  let providerId: string;
  let patientId: string;
  let serviceId: string;
  let setup: ReturnType<typeof createClinicalCatalogService>;
  let resolver: BookingCommercialResolver;
  let createHandler: CreateAppointmentHandler;

  const actor = () => ({ actorId, actorRoles: ['owner'], tenantId });

  beforeAll(async () => {
    prisma = await createPlatformDbSecurityClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    branchId = randomUUID();
    actorId = randomUUID();
    providerId = randomUUID();
    patientId = randomUUID();
    serviceId = randomUUID();
    setup = createClinicalCatalogService({ prisma, tenantId });
    wrapper = setup.wrapper;
    resolver = new BookingCommercialResolver(
      setup.wrapper as never,
      setup.prices as never,
      setup.configs as never,
      new AppointmentSnapshotService(),
    );
    const concurrency = new BookingConcurrencyService(setup.wrapper as never);
    const snapshots = new AppointmentSnapshotService();
    const eligibility = new ProviderEligibilityService(setup.wrapper as never, fakeAudit as never);
    const resources = new ServiceResourceRequirementService(setup.wrapper as never, fakeAudit as never);
    createHandler = new CreateAppointmentHandler(
      { findById: async (id: string) => (id === patientId ? { id: patientId } : null) } as never,
      { resolve: async () => ({ tenantId, branchId }) } as never,
      { publish: async () => undefined } as never,
      { enforceAppointmentLimit: async () => undefined } as never,
      { incrementAppointments: async () => undefined } as never,
      concurrency,
      snapshots,
      resolver,
      eligibility,
      resources,
      setup.wrapper as never,
      fakeAudit as never,
    );

    await setup.wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'Wave D Pricing', slug: `wd-pricing-${tenantId.slice(0, 8)}` },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `Wave D Branch ${branchId.slice(0, 6)}` },
      });
      await c.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `wd-pricing-${actorId.slice(0, 8)}@tenant.local`,
          passwordHash: 'x',
          firstName: 'Wave',
          lastName: 'Pricing',
        },
      });
      await c.user.create({
        data: {
          id: providerId,
          tenantId,
          email: `wd-prov-${providerId.slice(0, 8)}@tenant.local`,
          passwordHash: 'x',
          firstName: 'Prov',
          lastName: 'Ider',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Book', lastName: 'Patient' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: serviceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.svc.${serviceId.slice(0, 8)}`,
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.providerServiceEligibility.create({
        data: {
          id: randomUUID(),
          tenantId,
          providerUserId: providerId,
          clinicalServiceId: serviceId,
          branchId: null,
          effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
          active: true,
        },
      });
    });

    await setup.configs.upsertConfig(actor() as never, {
      clinicalServiceId: serviceId,
      branchId: null,
      enabled: true,
      bookingVisibleOnPortal: true,
      requiresResourceTypes: [],
    });
  });

  async function insertDraft(
    unit: ClinicalPricingUnit,
    attrs?: { status?: ClinicalPriceVersionStatus },
  ) {
    return setup.wrapper.withPlatformBypass((c) =>
      c.clinicalServicePriceVersion.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId: null,
          clinicalServiceId: serviceId,
          pricingUnit: unit,
          currency: 'SYP',
          unitPrice: 100,
          taxPercent: 0,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          status: attrs?.status ?? ClinicalPriceVersionStatus.DRAFT,
          ...(attrs?.status === ClinicalPriceVersionStatus.ACTIVE
            ? { publishedAt: new Date('2026-09-01T00:00:00.000Z'), publishedBy: actorId }
            : {}),
        },
      }),
    );
  }

  it('publish succeeds for valid unit/domain and rejects mismatches without mutating draft state', async () => {
    const okDraft = await setup.prices.createDraft(actor() as never, {
      clinicalServiceId: serviceId,
      branchId: null,
      pricingUnit: ClinicalPricingUnit.PER_VISIT,
      currency: 'SYP',
      unitPrice: 80,
      taxPercent: 0,
      effectiveFrom: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const published = await setup.prices.publish(actor() as never, okDraft.id);
    expect(published.status).toBe(ClinicalPriceVersionStatus.ACTIVE);

    for (const badUnit of [
      ClinicalPricingUnit.PER_AREA,
      ClinicalPricingUnit.PER_COURSE,
      ClinicalPricingUnit.PER_PACKAGE,
    ]) {
      const bad = await insertDraft(badUnit);
      await expect(setup.prices.publish(actor() as never, bad.id)).rejects.toBeInstanceOf(
        ClinicalCatalogValidationError,
      );
      const after = await setup.wrapper.withPlatformBypass((c) =>
        c.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: bad.id } }),
      );
      expect(after.status).toBe(ClinicalPriceVersionStatus.DRAFT);
      expect(after.publishedAt).toBeNull();
      expect(after.inactivatedAt).toBeNull();
      expect(after.supersededAt).toBeNull();
    }
  });

  it('booking resolver enforces unit/domain and fail-closed course/package with no side effects', async () => {
    await insertDraft(ClinicalPricingUnit.PER_VISIT, { status: ClinicalPriceVersionStatus.ACTIVE });
    const valid = await resolver.resolveCanonical({
      tenantId,
      actorId,
      clinicalServiceId: serviceId,
      branchId: null,
      pricingUnit: ClinicalPricingUnit.PER_VISIT,
      currency: 'SYP',
      quantity: 1,
    });
    expect(valid.pricingUnit).toBe(ClinicalPricingUnit.PER_VISIT);

    const before = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
      versions: await c.clinicalServicePriceVersion.count({ where: { tenantId } }),
    }));

    await insertDraft(ClinicalPricingUnit.PER_AREA, { status: ClinicalPriceVersionStatus.ACTIVE });
    await insertDraft(ClinicalPricingUnit.PER_COURSE, { status: ClinicalPriceVersionStatus.ACTIVE });
    await insertDraft(ClinicalPricingUnit.PER_PACKAGE, { status: ClinicalPriceVersionStatus.ACTIVE });

    for (const badUnit of [
      ClinicalPricingUnit.PER_AREA,
      ClinicalPricingUnit.PER_COURSE,
      ClinicalPricingUnit.PER_PACKAGE,
    ]) {
      await expect(
        resolver.resolveCanonical({
          tenantId,
          actorId,
          clinicalServiceId: serviceId,
          branchId: null,
          pricingUnit: badUnit,
          currency: 'SYP',
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    }

    const after = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
      versions: await c.clinicalServicePriceVersion.count({ where: { tenantId } }),
    }));
    expect(after.appointments).toBe(before.appointments);
    expect(after.invoices).toBe(before.invoices);
    expect(after.versions).toBeGreaterThanOrEqual(before.versions);
  });

  it('CreateAppointmentHandler succeeds for valid PER_VISIT pricing and creates appointment', async () => {
    await insertDraft(ClinicalPricingUnit.PER_VISIT, { status: ClinicalPriceVersionStatus.ACTIVE });
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 86_400_000 + 3_600_000).toISOString();
    const result = await createHandler.execute(
      new CreateAppointmentCommand(
        patientId,
        providerId,
        start,
        end,
        undefined,
        null,
        false,
        undefined,
        null,
        serviceId,
        1,
        ClinicalPricingUnit.PER_VISIT,
        'SYP',
        null,
        [],
        actorId,
      ),
    );
    expect(result.appointmentId).toBeTruthy();
    const appt = await setup.wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: result.appointmentId } }),
    );
    expect(appt.clinicalServiceId).toBe(serviceId);
    expect(appt.tenantId).toBe(tenantId);
  });

  it('CreateAppointmentHandler fail-closed pricing rejects before durable booking side effects', async () => {
    await insertDraft(ClinicalPricingUnit.PER_VISIT, { status: ClinicalPriceVersionStatus.ACTIVE });
    const scheduledDraft = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.SCHEDULED,
    });
    const before = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      allocations: await c.appointmentResourceAllocation.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
      scheduled: await c.clinicalServicePriceVersion.findUniqueOrThrow({
        where: { id: scheduledDraft.id },
      }),
    }));
    const start = new Date(Date.now() + 172_800_000).toISOString();
    const end = new Date(Date.now() + 172_800_000 + 3_600_000).toISOString();

    for (const badUnit of [
      ClinicalPricingUnit.PER_AREA,
      ClinicalPricingUnit.PER_COURSE,
      ClinicalPricingUnit.PER_PACKAGE,
    ]) {
      await expect(
        createHandler.execute(
          new CreateAppointmentCommand(
            patientId,
            providerId,
            start,
            end,
            undefined,
            null,
            false,
            undefined,
            null,
            serviceId,
            1,
            badUnit,
            'SYP',
            null,
            [],
            actorId,
          ),
        ),
      ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    }

    const after = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      allocations: await c.appointmentResourceAllocation.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
      scheduled: await c.clinicalServicePriceVersion.findUniqueOrThrow({
        where: { id: scheduledDraft.id },
      }),
    }));
    expect(after.appointments).toBe(before.appointments);
    expect(after.allocations).toBe(before.allocations);
    expect(after.invoices).toBe(before.invoices);
    expect(after.scheduled.status).toBe(ClinicalPriceVersionStatus.SCHEDULED);
    expect(after.scheduled.publishedAt).toBeNull();
  });
});
