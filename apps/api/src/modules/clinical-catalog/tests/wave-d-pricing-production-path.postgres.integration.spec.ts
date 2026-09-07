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
import { TreatmentCourseService } from '../../aesthetic/services/treatment-course.service';

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
  let courses: TreatmentCourseService;

  const tenantContext = {
    resolve: async () => ({ tenantId, branchId: null, locale: 'en' }),
  };

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
    courses = new TreatmentCourseService(wrapper as never, tenantContext as never, fakeAudit as never);

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
    attrs?: {
      status?: ClinicalPriceVersionStatus;
      unitPrice?: number;
      clinicalServiceId?: string;
      branchId?: string | null;
      effectiveFrom?: Date;
      effectiveTo?: Date | null;
    },
  ) {
    const status = attrs?.status ?? ClinicalPriceVersionStatus.DRAFT;
    const needsPublishedAt =
      status === ClinicalPriceVersionStatus.ACTIVE ||
      status === ClinicalPriceVersionStatus.SCHEDULED;
    return setup.wrapper.withPlatformBypass((c) =>
      c.clinicalServicePriceVersion.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId: attrs?.branchId === undefined ? null : attrs.branchId,
          clinicalServiceId: attrs?.clinicalServiceId ?? serviceId,
          pricingUnit: unit,
          currency: 'SYP',
          unitPrice: attrs?.unitPrice ?? 100,
          taxPercent: 0,
          effectiveFrom: attrs?.effectiveFrom ?? new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: attrs?.effectiveTo === undefined ? null : attrs.effectiveTo,
          status,
          ...(needsPublishedAt
            ? { publishedAt: new Date('2026-09-01T00:00:00.000Z'), publishedBy: actorId }
            : {}),
        },
      }),
    );
  }

  async function backdateScheduled(
    id: string,
    effectiveFrom: Date,
    effectiveTo: Date | null = null,
  ) {
    await setup.wrapper.withPlatformBypass((c) =>
      c.clinicalServicePriceVersion.update({
        where: { id },
        data: { effectiveFrom, effectiveTo },
      }),
    );
  }

  async function publishCoursePrice(opts: {
    from: Date;
    to?: Date | null;
    unitPrice?: number;
    branchId?: string | null;
    pricingUnit?: ClinicalPricingUnit;
  }) {
    const draft = await setup.prices.createDraft(actor() as never, {
      clinicalServiceId: serviceId,
      branchId: opts.branchId === undefined ? null : opts.branchId,
      pricingUnit: opts.pricingUnit ?? ClinicalPricingUnit.PER_COURSE,
      currency: 'SYP',
      unitPrice: opts.unitPrice ?? 100,
      taxPercent: 0,
      effectiveFrom: opts.from.toISOString(),
      effectiveTo: opts.to ? opts.to.toISOString() : undefined,
    });
    return setup.prices.publish(actor() as never, draft.id);
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

    // PER_AREA remains invalid on DENTAL (domain matrix).
    const badArea = await insertDraft(ClinicalPricingUnit.PER_AREA);
    await expect(setup.prices.publish(actor() as never, badArea.id)).rejects.toBeInstanceOf(
      ClinicalCatalogValidationError,
    );
    const afterArea = await setup.wrapper.withPlatformBypass((c) =>
      c.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: badArea.id } }),
    );
    expect(afterArea.status).toBe(ClinicalPriceVersionStatus.DRAFT);
    expect(afterArea.publishedAt).toBeNull();

    // Wave E activates TreatmentCourse SoR — PER_COURSE / PER_PACKAGE are allowed (cross-specialty).
    for (const courseUnit of [ClinicalPricingUnit.PER_COURSE, ClinicalPricingUnit.PER_PACKAGE]) {
      const draft = await insertDraft(courseUnit);
      const publishedCourse = await setup.prices.publish(actor() as never, draft.id);
      expect(publishedCourse.status).toBe(ClinicalPriceVersionStatus.ACTIVE);
      expect(publishedCourse.pricingUnit).toBe(courseUnit);
    }
  });

  it('booking resolver rejects PER_AREA on DENTAL; standalone PER_COURSE/PER_PACKAGE fail-closed (E1-T1/T2/T8)', async () => {
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
      courses: await c.treatmentCourse.count({ where: { tenantId } }),
    }));

    await insertDraft(ClinicalPricingUnit.PER_AREA, { status: ClinicalPriceVersionStatus.ACTIVE });
    await insertDraft(ClinicalPricingUnit.PER_COURSE, { status: ClinicalPriceVersionStatus.ACTIVE });
    await insertDraft(ClinicalPricingUnit.PER_PACKAGE, { status: ClinicalPriceVersionStatus.ACTIVE });

    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_AREA,
        currency: 'SYP',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);

    for (const courseUnit of [ClinicalPricingUnit.PER_COURSE, ClinicalPricingUnit.PER_PACKAGE]) {
      await expect(
        resolver.resolveCanonical({
          tenantId,
          actorId,
          clinicalServiceId: serviceId,
          branchId: null,
          pricingUnit: courseUnit,
          currency: 'SYP',
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    }

    const after = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
      versions: await c.clinicalServicePriceVersion.count({ where: { tenantId } }),
      courses: await c.treatmentCourse.count({ where: { tenantId } }),
    }));
    expect(after.appointments).toBe(before.appointments);
    expect(after.invoices).toBe(before.invoices);
    expect(after.courses).toBe(before.courses);
    expect(after.versions).toBeGreaterThanOrEqual(before.versions);
  });

  it('booking resolver succeeds for PER_COURSE with TreatmentCourse context (E1-T3)', async () => {
    const price = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    const resolved = await resolver.resolveCanonical({
      tenantId,
      actorId,
      clinicalServiceId: serviceId,
      branchId: null,
      pricingUnit: ClinicalPricingUnit.PER_COURSE,
      currency: 'SYP',
      quantity: 1,
      treatmentCourseId: course.id,
      patientId,
    });
    expect(resolved.pricingUnit).toBe(ClinicalPricingUnit.PER_COURSE);
    expect(resolved.priceVersionId).toBe(price.id);
  });

  it('booking resolver succeeds for PER_PACKAGE bound to course.packagePriceVersionId (E1-T4)', async () => {
    const price = await insertDraft(ClinicalPricingUnit.PER_PACKAGE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 3,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    const resolved = await resolver.resolveCanonical({
      tenantId,
      actorId,
      clinicalServiceId: serviceId,
      branchId: null,
      pricingUnit: ClinicalPricingUnit.PER_PACKAGE,
      currency: 'SYP',
      quantity: 1,
      treatmentCourseId: course.id,
      patientId,
    });
    expect(resolved.pricingUnit).toBe(ClinicalPricingUnit.PER_PACKAGE);
    expect(resolved.priceVersionId).toBe(price.id);
  });

  it('R2-B1-T1: rejects course patient != booking patient', async () => {
    const otherPatient = randomUUID();
    await setup.wrapper.withPlatformBypass((c) =>
      c.patient.create({
        data: { id: otherPatient, tenantId, firstName: 'Other', lastName: 'Course' },
      }),
    );
    const price = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
    });
    const course = await courses.create({
      patientId: otherPatient,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    const before = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
    }));
    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: course.id,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    const after = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
    }));
    expect(after.appointments).toBe(before.appointments);
    expect(after.invoices).toBe(before.invoices);
  });

  it('R2-B1-T2: rejects course service != booking service', async () => {
    const otherService = randomUUID();
    await setup.wrapper.withPlatformBypass((c) =>
      c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherService,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.other-${otherService.slice(0, 8)}`,
          domain: 'AESTHETIC',
          lifecycle: 'PUBLISHED',
        },
      }),
    );
    const otherPrice = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
      clinicalServiceId: otherService,
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: otherService,
      plannedSessions: 2,
      packagePriceVersionId: otherPrice.id,
      actorId,
      actorRoles: ['owner'],
    });
    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: course.id,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('R2-B1-T3/T4: exact packagePriceVersionId binding beats other ACTIVE PER_COURSE price', async () => {
    const packagePrice = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
      unitPrice: 1111,
      effectiveFrom: new Date(Date.now() - 86_400_000),
    });
    // Different commercial key (branch-scoped) so PA-04 ACTIVE cardinality holds.
    const otherActive = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
      unitPrice: 9999,
      branchId,
      effectiveFrom: new Date(Date.now() - 86_400_000),
    });
    expect(otherActive.id).not.toBe(packagePrice.id);
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: packagePrice.id,
      actorId,
      actorRoles: ['owner'],
    });
    const resolved = await resolver.resolveCanonical({
      tenantId,
      actorId,
      clinicalServiceId: serviceId,
      branchId: null,
      pricingUnit: ClinicalPricingUnit.PER_COURSE,
      currency: 'SYP',
      quantity: 1,
      treatmentCourseId: course.id,
      patientId,
    });
    expect(resolved.priceVersionId).toBe(packagePrice.id);
    expect(resolved.priceVersionId).not.toBe(otherActive.id);
    expect(resolved.unitPrice).toBe(1111);
  });

  it('R2-B1-T5: rejects wrong-tenant course', async () => {
    const foreignTenant = randomUUID();
    const foreignPatient = randomUUID();
    const foreignService = randomUUID();
    const foreignCourse = randomUUID();
    const foreignActor = randomUUID();
    await setup.wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: foreignTenant, name: 'Foreign', slug: `fx-${foreignTenant.slice(0, 8)}` },
      });
      await c.user.create({
        data: {
          id: foreignActor,
          tenantId: foreignTenant,
          email: `fx-${foreignActor.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'F',
          lastName: 'U',
        },
      });
      await c.patient.create({
        data: { id: foreignPatient, tenantId: foreignTenant, firstName: 'F', lastName: 'P' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: foreignService,
          tenantId: foreignTenant,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${foreignTenant}.custom.fx`,
          domain: 'AESTHETIC',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.treatmentCourse.create({
        data: {
          id: foreignCourse,
          tenantId: foreignTenant,
          patientId: foreignPatient,
          clinicalServiceId: foreignService,
          plannedSessions: 1,
          createdBy: foreignActor,
          status: 'ACTIVE',
        },
      });
    });
    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: foreignCourse,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('R2-B1-T6: rejects inactive package price on course', async () => {
    const price = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.DRAFT,
    });
    const courseId = randomUUID();
    await setup.wrapper.withPlatformBypass((c) =>
      c.treatmentCourse.create({
        data: {
          id: courseId,
          tenantId,
          patientId,
          clinicalServiceId: serviceId,
          plannedSessions: 2,
          packagePriceVersionId: price.id,
          createdBy: actorId,
          status: 'ACTIVE',
        },
      }),
    );
    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: courseId,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
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

  it('CreateAppointmentHandler fail-closed PER_AREA on DENTAL before durable booking side effects', async () => {
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
          ClinicalPricingUnit.PER_AREA,
          'SYP',
          null,
          [],
          actorId,
        ),
      ),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);

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
    expect(after.scheduled.publishedAt?.toISOString()).toBe(
      before.scheduled.publishedAt?.toISOString() ?? undefined,
    );
  });

  it('CreateAppointmentHandler accepts PER_COURSE only with treatmentCourseId (E1-T3)', async () => {
    const price = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    const start = new Date(Date.now() + 259_200_000).toISOString();
    const end = new Date(Date.now() + 259_200_000 + 3_600_000).toISOString();
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
        ClinicalPricingUnit.PER_COURSE,
        'SYP',
        null,
        [],
        actorId,
        undefined,
        course.id,
      ),
    );
    expect(result.appointmentId).toBeTruthy();
    const appt = await setup.wrapper.withPlatformBypass((c) =>
      c.appointment.findUniqueOrThrow({ where: { id: result.appointmentId } }),
    );
    expect(appt.clinicalServiceId).toBe(serviceId);
    expect(appt.tenantId).toBe(tenantId);
  });

  it('CreateAppointmentHandler rejects standalone PER_COURSE without treatmentCourseId', async () => {
    await insertDraft(ClinicalPricingUnit.PER_COURSE, { status: ClinicalPriceVersionStatus.ACTIVE });
    const start = new Date(Date.now() + 345_600_000).toISOString();
    const end = new Date(Date.now() + 345_600_000 + 3_600_000).toISOString();
    const before = await setup.wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
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
          ClinicalPricingUnit.PER_COURSE,
          'SYP',
          null,
          [],
          actorId,
        ),
      ),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    const after = await setup.wrapper.withPlatformBypass((c) =>
      c.appointment.count({ where: { tenantId } }),
    );
    expect(after).toBe(before);
  });

  // --- R3-B1 course package + PA-04 lifecycle ---

  it('R3-B1-T1: ACTIVE package with valid effective interval → success + exact priceVersionId', async () => {
    const price = await publishCoursePrice({
      from: new Date(Date.now() - 86_400_000),
      unitPrice: 555,
    });
    expect(price.status).toBe(ClinicalPriceVersionStatus.ACTIVE);
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    const resolved = await resolver.resolveCanonical({
      tenantId,
      actorId,
      clinicalServiceId: serviceId,
      branchId: null,
      pricingUnit: ClinicalPricingUnit.PER_COURSE,
      currency: 'SYP',
      quantity: 1,
      treatmentCourseId: course.id,
      patientId,
    });
    expect(resolved.priceVersionId).toBe(price.id);
    expect(resolved.unitPrice).toBe(555);
  });

  it('R3-B1-T2/T9: ACTIVE with effectiveTo already expired → reject; no appt/invoice side effects', async () => {
    const expired = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
      effectiveFrom: new Date(Date.now() - 10 * 86_400_000),
      effectiveTo: new Date(Date.now() - 86_400_000),
      unitPrice: 77,
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: expired.id,
      actorId,
      actorRoles: ['owner'],
    });
    const before = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
      allocations: await c.appointmentResourceAllocation.count({ where: { tenantId } }),
    }));
    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: course.id,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    const after = await setup.wrapper.withPlatformBypass(async (c) => ({
      appointments: await c.appointment.count({ where: { tenantId } }),
      invoices: await c.invoice.count({ where: { tenantId } }),
      allocations: await c.appointmentResourceAllocation.count({ where: { tenantId } }),
    }));
    expect(after.appointments).toBe(before.appointments);
    expect(after.invoices).toBe(before.invoices);
    expect(after.allocations).toBe(before.allocations);
  });

  it('R3-B1-T3/T4: due SCHEDULED successor reconciles; course bound to V1 rejects (no substitute)', async () => {
    const v1 = await publishCoursePrice({
      from: new Date('2026-01-01T00:00:00.000Z'),
      unitPrice: 10,
    });
    expect(v1.status).toBe(ClinicalPriceVersionStatus.ACTIVE);

    const future = new Date(Date.now() + 86_400_000);
    const d2 = await setup.prices.createDraft(actor() as never, {
      clinicalServiceId: serviceId,
      branchId: null,
      pricingUnit: ClinicalPricingUnit.PER_COURSE,
      currency: 'SYP',
      unitPrice: 20,
      taxPercent: 0,
      effectiveFrom: future.toISOString(),
    });
    const v2 = await setup.prices.publish(actor() as never, d2.id);
    expect(v2.status).toBe(ClinicalPriceVersionStatus.SCHEDULED);
    await backdateScheduled(v2.id, new Date(Date.now() - 60_000));

    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: v1.id,
      actorId,
      actorRoles: ['owner'],
    });

    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: course.id,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);

    const after = await setup.wrapper.withPlatformBypass(async (c) => ({
      v1: await c.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } }),
      v2: await c.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } }),
    }));
    // PA-04 reconcile under lock should have activated V2 / superseded V1
    expect(after.v2.status).toBe(ClinicalPriceVersionStatus.ACTIVE);
    expect(after.v1.status).not.toBe(ClinicalPriceVersionStatus.ACTIVE);
  });

  it('R3-B1-T5: branch-specific package + booking branchId null → reject', async () => {
    const price = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
      branchId,
      effectiveFrom: new Date(Date.now() - 86_400_000),
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: null,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: course.id,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('R3-B1-T6: branch-specific package + wrong branch → reject', async () => {
    const otherBranch = randomUUID();
    await setup.wrapper.withPlatformBypass((c) =>
      c.branch.create({
        data: { id: otherBranch, tenantId, name: `Other ${otherBranch.slice(0, 6)}` },
      }),
    );
    const price = await insertDraft(ClinicalPricingUnit.PER_COURSE, {
      status: ClinicalPriceVersionStatus.ACTIVE,
      branchId,
      effectiveFrom: new Date(Date.now() - 86_400_000),
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    await expect(
      resolver.resolveCanonical({
        tenantId,
        actorId,
        clinicalServiceId: serviceId,
        branchId: otherBranch,
        pricingUnit: ClinicalPricingUnit.PER_COURSE,
        currency: 'SYP',
        quantity: 1,
        treatmentCourseId: course.id,
        patientId,
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
  });

  it('R3-B1-T7: global package + booking branchId set → success (global applies)', async () => {
    const price = await publishCoursePrice({
      from: new Date(Date.now() - 86_400_000),
      unitPrice: 333,
    });
    expect(price.branchId).toBeNull();
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    const resolved = await resolver.resolveCanonical({
      tenantId,
      actorId,
      clinicalServiceId: serviceId,
      branchId,
      pricingUnit: ClinicalPricingUnit.PER_COURSE,
      currency: 'SYP',
      quantity: 1,
      treatmentCourseId: course.id,
      patientId,
    });
    expect(resolved.priceVersionId).toBe(price.id);
    expect(resolved.unitPrice).toBe(333);
  });

  it('R3-B1-T8: concurrent resolveCanonical same commercial key → deterministic', async () => {
    const price = await publishCoursePrice({
      from: new Date(Date.now() - 86_400_000),
      unitPrice: 444,
    });
    const course = await courses.create({
      patientId,
      clinicalServiceId: serviceId,
      plannedSessions: 2,
      packagePriceVersionId: price.id,
      actorId,
      actorRoles: ['owner'],
    });
    const args = {
      tenantId,
      actorId,
      clinicalServiceId: serviceId,
      branchId: null as string | null,
      pricingUnit: ClinicalPricingUnit.PER_COURSE,
      currency: 'SYP',
      quantity: 1,
      treatmentCourseId: course.id,
      patientId,
    };
    const results = await Promise.all([
      resolver.resolveCanonical(args),
      resolver.resolveCanonical(args),
      resolver.resolveCanonical(args),
    ]);
    expect(results.map((r) => r.priceVersionId)).toEqual([price.id, price.id, price.id]);
    expect(results.map((r) => r.unitPrice)).toEqual([444, 444, 444]);
  });
});
