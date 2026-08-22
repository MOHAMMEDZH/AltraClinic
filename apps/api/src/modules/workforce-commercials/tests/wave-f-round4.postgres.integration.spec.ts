/**
 * Phase 48 Wave F Round 4 remediation — focused PostgreSQL integration tests.
 */
import { randomUUID } from 'crypto';
import { BadRequestException, GoneException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { CommissionController } from '../../commission/controllers/commission.controller';
import { Invoice } from '../../billing/domain/entities/invoice.entity';
import { PrismaInvoiceRepository } from '../../billing/infrastructure/prisma-invoice.repository';
import { CreateInvoiceHandler } from '../../billing/application/handlers/create-invoice.handler';
import { AddInvoiceLineItemDto } from '../../billing/application/dto/add-invoice-line-item.dto';
import { CreateInvoiceFromAppointmentHandler } from '../../scheduling/application/handlers/create-invoice-from-appointment.handler';
import { WorkforceCommercialsController } from '../api/workforce-commercials.controller';
import {
  assertInvoiceChargeFinalized,
  CommissionAccrualService,
} from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import { InvoiceLinePerformanceAttributionService } from '../services/invoice-line-performance-attribution.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F Round 4 remediation (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let actorId: string;
  let performerId: string;
  let patientId: string;
  let branchId: string;
  let clinicalServiceId: string;
  let appointmentId: string;
  const auditCalls: Array<Record<string, unknown>> = [];

  const tenantContext = {
    resolve: async () => ({ tenantId, branchId: null, locale: 'en' }),
  };
  const audit = {
    record: async (e: Record<string, unknown>) => {
      auditCalls.push({ ...e, via: 'record' });
    },
    recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
      auditCalls.push({ ...e, via: 'recordInTransaction' });
    },
  };
  const eventPublisherNoop = { publish: async () => undefined };

  function plans() {
    return new StaffCommissionPlanService(wrapper as never, tenantContext as never, audit as never);
  }
  function accruals() {
    return new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      plans(),
      audit as never,
    );
  }
  function binder() {
    return new InvoiceLinePerformanceAttributionService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }
  function packages() {
    return new CommissionPackageAllocationService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }
  function wfController() {
    return new WorkforceCommercialsController(
      plans(),
      accruals(),
      binder(),
      packages(),
    );
  }

  async function seed() {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R4', slug: `wfr4-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr4-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'One' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R4 B ${branchId.slice(0, 6)}` },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.wf-${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
    });
  }

  async function enableAndPublishPlan(opts: {
    userId: string;
    percentage: number;
    effectiveFrom: string;
    calculationBasis?: string;
    earningTrigger?: string;
  }) {
    await plans().setUserCommissionEligibility(
      opts.userId,
      true,
      opts.percentage,
      opts.effectiveFrom,
      { actorId, actorRoles: ['owner'] },
    );
    const draft = await plans().createDraftPlan({
      userId: opts.userId,
      percentage: opts.percentage,
      effectiveFrom: opts.effectiveFrom,
      calculationBasis: opts.calculationBasis ?? 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: opts.earningTrigger ?? 'INVOICE_OR_CHARGE_FINALIZED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance(opts?: {
    appointmentId?: string;
    patientId?: string;
    branchId?: string;
    clinicalServiceId?: string;
    snapshotRevisionId?: string | null;
    performedAt?: Date;
  }) {
    const performanceId = randomUUID();
    const performedAt = opts?.performedAt ?? new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId: opts?.branchId ?? branchId,
          appointmentId: opts?.appointmentId ?? appointmentId,
          patientId: opts?.patientId ?? patientId,
          clinicalServiceId: opts?.clinicalServiceId ?? clinicalServiceId,
          snapshotRevisionId: opts?.snapshotRevisionId ?? null,
          performedAt,
          status: 'DRAFT',
          createdBy: actorId,
          participants: {
            create: {
              id: randomUUID(),
              tenantId,
              userId: performerId,
              role: 'PRIMARY',
              attributionShare: null,
              recordedBy: actorId,
            },
          },
        },
      });
      await c.servicePerformance.update({
        where: { id: performanceId },
        data: { status: 'COMPLETED', completedAt: performedAt, completedBy: actorId },
      });
    });
    return performanceId;
  }

  async function createInvoiceViaProductionPath(
    servicePerformanceId: string | null,
    opts?: {
      amount?: string;
      issue?: boolean;
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      snapshotRevisionId?: string | null;
      courseSessionId?: string | null;
    },
  ) {
    const amount = opts?.amount ?? '1000.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R4-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R4 production path',
      lineItems: [
        {
          description: 'R4 clinical line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId: opts?.appointmentId === undefined ? appointmentId : opts.appointmentId,
          clinicalServiceId:
            opts?.clinicalServiceId === undefined ? clinicalServiceId : opts.clinicalServiceId,
          snapshotRevisionId: opts?.snapshotRevisionId ?? null,
          courseSessionId: opts?.courseSessionId ?? null,
        },
      ],
    });
    if (opts?.issue !== false) invoice.issue();
    const line = invoice.lineItems[0]!;
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: line.itemId, status: invoice.status.status };
  }

  async function createReplacementLine(opts?: { amount?: string }) {
    return createInvoiceViaProductionPath(null, {
      amount: opts?.amount ?? '1000.00',
      appointmentId,
      clinicalServiceId,
    });
  }

  async function createRefund(invoiceId: string, amount: string) {
    const refundId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceRefund.create({
        data: {
          id: refundId,
          tenantId,
          invoiceId,
          amount,
          reason: 'R4 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function createPayment(invoiceId: string, amount: string) {
    const paymentId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoicePayment.create({
        data: {
          id: paymentId,
          tenantId,
          invoiceId,
          amount,
          paymentMethod: 'cash',
          paymentDate: new Date('2026-09-01'),
          recordedBy: actorId,
        },
      });
    });
    return paymentId;
  }

  async function issueInvoice(invoiceId: string) {
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.update({ where: { id: invoiceId }, data: { status: 'ISSUED' } });
    });
  }

  async function createSnapshot(opts?: { unitPrice?: number; revisionNumber?: number }) {
    const snapId = randomUUID();
    const unitPrice = opts?.unitPrice ?? 1000;
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: snapId,
          tenantId,
          appointmentId,
          revisionNumber: opts?.revisionNumber ?? 1,
          stableKey: `r4.snap.${snapId.slice(0, 8)}`,
          displayNameAr: 'R4 snap',
          displayNameEn: 'R4 snap',
          quantity: 1,
          unitPrice,
          lineBasisAmount: unitPrice,
          currency: 'SYP',
          clinicalServiceId,
          actorId,
        },
      });
      await c.appointment.update({
        where: { id: appointmentId },
        data: { effectiveSnapshotRevisionId: snapId },
      });
      await c.tenant.update({
        where: { id: tenantId },
        data: { features: { 'billing.invoice.from.snapshot': true } },
      });
    });
    return snapId;
  }

  function appointmentBillingHandler() {
    const patientRepoStub = {
      findById: async (id: string, tid: string) =>
        id === patientId && tid === tenantId
          ? { id: patientId, tenantId, firstName: 'Pat', lastName: 'One' }
          : null,
    };
    const subscriptionStub = { existsByCustomerId: async () => false };
    const createInvoiceHandler = new CreateInvoiceHandler(
      new PrismaInvoiceRepository(raw as never) as never,
      patientRepoStub as never,
      subscriptionStub as never,
      tenantContext as never,
      eventPublisherNoop as never,
    );
    return new CreateInvoiceFromAppointmentHandler(
      {
        findDetailById: async (id: string, tid: string) =>
          id === appointmentId && tid === tenantId
            ? {
                id: appointmentId,
                patientId,
                branchId,
                serviceType: 'consultation',
              }
            : null,
      } as never,
      createInvoiceHandler,
      tenantContext as never,
      wrapper as never,
    );
  }

  async function seedCourseSession(opts?: {
    status?: 'PLANNED' | 'COMPLETED';
    appointmentId?: string;
    unitPrice?: string;
    pricingUnit?: 'PER_COURSE' | 'PER_PACKAGE' | 'PER_VISIT';
    currency?: string;
  }) {
    const courseId = randomUUID();
    const sessionId = randomUUID();
    const priceVersionId = randomUUID();
    const unitPrice = opts?.unitPrice ?? '5000.00';
    const pricingUnit = opts?.pricingUnit ?? 'PER_COURSE';
    const currency = opts?.currency ?? 'SYP';
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.create({
        data: {
          id: priceVersionId,
          tenantId,
          clinicalServiceId,
          pricingUnit,
          currency,
          unitPrice,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          status: 'ACTIVE',
          publishedAt: new Date('2026-01-01T00:00:00.000Z'),
          publishedBy: actorId,
        },
      });
      await c.treatmentCourse.create({
        data: {
          id: courseId,
          tenantId,
          patientId,
          clinicalServiceId,
          plannedSessions: 5,
          packagePriceVersionId: priceVersionId,
          status: 'ACTIVE',
          createdBy: actorId,
        },
      });
      await c.courseSession.create({
        data: {
          id: sessionId,
          tenantId,
          courseId,
          sequence: 1,
          appointmentId: opts?.appointmentId ?? appointmentId,
          status: opts?.status ?? 'COMPLETED',
        },
      });
    });
    return { courseId, sessionId, priceVersionId, unitPrice, currency };
  }

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
  });
  afterAll(async () => {
    await raw.$disconnect();
  });
  beforeEach(async () => {
    auditCalls.length = 0;
    tenantId = randomUUID();
    actorId = randomUUID();
    performerId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    await seed();
  });

  // ── R4-F2 invoice finalization ─────────────────────────────────────────────

  it('R4-F2-T1 DRAFT invoice post rejected', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId, { issue: false });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not finalized|ISSUED/i);
  });

  it('R4-F2-T2 same invoice after issue posts successfully', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      issue: false,
    });
    await issueInvoice(invoiceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((posted.accruals as unknown[]).length).toBe(1);
  });

  it('R4-F2-T3/T4 cancel before finalization → no EARNED; retry stays rejected', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      issue: false,
    });
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.update({ where: { id: invoiceId }, data: { status: 'CANCELLED' } });
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not finalized/i);
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not finalized/i);
    const earned = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, servicePerformanceId: performanceId, status: 'EARNED' },
      }),
    );
    expect(earned).toBe(0);
  });

  it('R4-F2-T5 COLLECTED_REVENUE path unaffected', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const paymentId = await createPayment(invoiceId, '500.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((posted.accruals as unknown[]).length).toBe(1);
    expect(
      (posted.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount.toFixed(2),
    ).toBe('150.00');
  });

  it('R4-F2-T6 assertInvoiceChargeFinalized + controller DRAFT reject', async () => {
    expect(() => assertInvoiceChargeFinalized('DRAFT')).toThrow(BadRequestException);
    expect(() => assertInvoiceChargeFinalized('ISSUED')).not.toThrow();
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId, { issue: false });
    await expect(
      wfController().postAccrual(
        { servicePerformanceId: performanceId, invoiceLineId: lineId },
        { user: { sub: actorId, roles: ['owner'] } },
      ),
    ).rejects.toThrow(/not finalized/i);
  });

  // ── R4-F3 binding + billing E2E ────────────────────────────────────────────

  it('R4-F3-T1 CreateInvoiceFromAppointmentHandler populates servicePerformanceId', async () => {
    const snapId = await createSnapshot({ unitPrice: 1000 });
    const performanceId = await createCompletedPerformance({ snapshotRevisionId: snapId });
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const result = await appointmentBillingHandler().execute(appointmentId);
    expect(result.servicePerformanceId).toBe(performanceId);
    const line = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { invoiceId: result.invoiceId } }),
    );
    expect(line?.servicePerformanceId).toBe(performanceId);
    expect(line?.appointmentId).toBe(appointmentId);
    expect(line?.snapshotRevisionId).toBe(snapId);
  });

  it('R4-F3-T2 public billing DTO cannot inject servicePerformanceId', () => {
    expect('servicePerformanceId' in AddInvoiceLineItemDto.prototype).toBe(false);
    const dto = new AddInvoiceLineItemDto();
    expect(Object.prototype.hasOwnProperty.call(dto, 'servicePerformanceId')).toBe(false);
  });

  it('R4-F3-T3/T4/T5 later bind wrong appointment/service/snapshot rejected', async () => {
    const snapA = await createSnapshot({ unitPrice: 1000, revisionNumber: 1 });
    const apptB = randomUUID();
    const svcB = randomUUID();
    const snapB = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: svcB,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.b-${svcB.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.appointment.create({
        data: {
          id: apptB,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-02T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-02T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId: svcB,
        },
      });
      await c.appointmentServiceSnapshotRevision.create({
        data: {
          id: snapB,
          tenantId,
          appointmentId: apptB,
          revisionNumber: 1,
          stableKey: `r4.snapb.${snapB.slice(0, 8)}`,
          displayNameAr: 'B',
          displayNameEn: 'B',
          quantity: 1,
          unitPrice: 500,
          lineBasisAmount: 500,
          currency: 'SYP',
          clinicalServiceId: svcB,
          actorId,
        },
      });
    });
    const good = await createCompletedPerformance({
      appointmentId,
      clinicalServiceId,
      snapshotRevisionId: snapA,
    });
    const wrongAppt = await createCompletedPerformance({ appointmentId: apptB, clinicalServiceId: svcB });
    const { lineId } = await createInvoiceViaProductionPath(null, {
      appointmentId,
      clinicalServiceId,
      snapshotRevisionId: snapA,
    });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: wrongAppt,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/appointmentId/i);

    const wrongSvc = await createCompletedPerformance({
      appointmentId,
      clinicalServiceId: svcB,
    });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: wrongSvc,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/clinicalServiceId/i);

    const wrongSnap = await createCompletedPerformance({
      appointmentId,
      clinicalServiceId,
      snapshotRevisionId: snapB,
    });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: wrongSnap,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/snapshotRevisionId/i);

    await binder().bindInvoiceLine({
      invoiceLineId: lineId,
      servicePerformanceId: good,
      actor: { actorId, actorRoles: ['owner'] },
    });
  });

  it('R4-F3-T6 same patient+branch without durable provenance rejected', async () => {
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(null, {
      appointmentId: null,
      clinicalServiceId: null,
    });
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: performanceId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/provenance|appointmentId|lacks durable/i);
  });

  it('R4-F3-T7/T8 correct later bind + rebind rejected', async () => {
    const performanceId = await createCompletedPerformance();
    const other = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(null);
    const before = auditCalls.length;
    await binder().bindInvoiceLine({
      invoiceLineId: lineId,
      servicePerformanceId: performanceId,
      actor: { actorId, actorRoles: ['owner'] },
    });
    expect(auditCalls.length).toBeGreaterThan(before);
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: other,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow(/reassignment|already bound/i);
  });

  it('R4-F3-T9 billing-created line → commission accrual succeeds', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const snapId = await createSnapshot({ unitPrice: 1000 });
    const performanceId = await createCompletedPerformance({ snapshotRevisionId: snapId });
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    const result = await appointmentBillingHandler().execute(appointmentId);
    await issueInvoice(result.invoiceId);
    const line = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({ where: { invoiceId: result.invoiceId } }),
    );
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: line!.id,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((posted.accruals as unknown[]).length).toBe(1);
  });

  it('R4-F3-T10 zero side effects on rejected binding', async () => {
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(null, {
      appointmentId: null,
      clinicalServiceId: null,
    });
    const before = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: lineId } }),
    );
    await expect(
      binder().bindInvoiceLine({
        invoiceLineId: lineId,
        servicePerformanceId: performanceId,
        actor: { actorId, actorRoles: ['owner'] },
      }),
    ).rejects.toThrow();
    const after = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: lineId } }),
    );
    expect(after?.servicePerformanceId).toBeNull();
    expect(after?.servicePerformanceId).toBe(before?.servicePerformanceId);
  });

  // ── R4-F4A correction semantics ────────────────────────────────────────────

  it('R4-F4A-T1/T2/T3/T8 full correction without refund + replacement source + audit', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string; commissionAmount: Prisma.Decimal }).id;
    const originalAmt = (posted.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount;
    const replacement = await createReplacementLine({ amount: '800.00' });
    const correctionEventId = randomUUID();
    const result = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'R4 correction',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((result.reversal as { refundId: string | null }).refundId).toBeNull();
    expect(
      (result.reversal as { commissionAmount: Prisma.Decimal }).commissionAmount.abs().toFixed(2),
    ).toBe(originalAmt.toFixed(2));
    const repostLineId = (
      (result.repost as { accruals: Array<{ invoiceLineId: string }> }).accruals[0]
    ).invoiceLineId;
    expect(repostLineId).toBe(replacement.lineId);
    const stale = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findUnique({ where: { id: lineId } }),
    );
    expect(stale?.performanceBindingStatus).toBe('SUPERSEDED');
    expect(auditCalls.some((a) => a.action === 'staff_commission.accrual.corrected')).toBe(true);
  });

  it('R4-F4A-T4/T5 stale line blocked; forced DRAFT replacement rolls back', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createReplacementLine();
    await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: replacement.lineId,
      reason: 'first',
      actor: actorId,
      actorRoles: ['owner'],
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/SUPERSEDED|not ACTIVE|already accrued/i);

    const perf2 = await createCompletedPerformance();
    const a = await createInvoiceViaProductionPath(perf2);
    const posted2 = await accruals().postFromServicePerformance({
      servicePerformanceId: perf2,
      invoiceLineId: a.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const badReplacement = await createReplacementLine();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoice.update({
        where: { id: badReplacement.invoiceId },
        data: { status: 'DRAFT' },
      });
    });
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: perf2 } }),
    );
    await expect(
      accruals().correctAndRepost({
        accrualId: (posted2.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: badReplacement.lineId,
        reason: 'should roll back',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not finalized/i);
    const afterCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: perf2 } }),
    );
    expect(afterCount).toBe(beforeCount);
  });

  it('R4-F4A-T6/T7 idempotent correction replay + concurrent safe', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const originalId = (posted.accruals[0] as { id: string }).id;
    const replacement = await createReplacementLine();
    const correctionEventId = randomUUID();
    const first = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'idem',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const second = await accruals().correctAndRepost({
      accrualId: originalId,
      correctionEventId,
      replacementInvoiceLineId: replacement.lineId,
      reason: 'idem',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(second.idempotent).toBe(true);
    expect((second.reversal as { id: string }).id).toBe((first.reversal as { id: string }).id);

    const perf2 = await createCompletedPerformance();
    const a = await createInvoiceViaProductionPath(perf2);
    const posted2 = await accruals().postFromServicePerformance({
      servicePerformanceId: perf2,
      invoiceLineId: a.lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const r1 = await createReplacementLine();
    const r2 = await createReplacementLine();
    const concurrent = await Promise.allSettled([
      accruals().correctAndRepost({
        accrualId: (posted2.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: r1.lineId,
        reason: 'concurrent',
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().correctAndRepost({
        accrualId: (posted2.accruals[0] as { id: string }).id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: r2.lineId,
        reason: 'concurrent',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    expect(concurrent.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
  });

  // ── R4-F4B basis-aware refund ──────────────────────────────────────────────

  it('R4-F4B-T1 invoice 1000 / collected 500 / refund 500 → commission net 0', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const paymentId = await createPayment(invoiceId, '500.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string; commissionAmount: Prisma.Decimal }).id;
    expect(
      (posted.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount.toFixed(2),
    ).toBe('150.00');
    const refundId = await createRefund(invoiceId, '500.00');
    const rev = await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev.commissionAmount.abs().toFixed(2)).toBe('150.00');
  });

  it('R4-F4B-T2/T3 partial + multiple collected refunds', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const paymentId = await createPayment(invoiceId, '500.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const r1 = await createRefund(invoiceId, '200.00');
    const rev1 = await accruals().reverseAccrual({
      accrualId,
      refundId: r1,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev1.commissionAmount.abs().toFixed(2)).toBe('60.00');
    const r2 = await createRefund(invoiceId, '200.00');
    const rev2 = await accruals().reverseAccrual({
      accrualId,
      refundId: r2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev2.commissionAmount.abs().toFixed(2)).toBe('60.00');
  });

  it('R4-F4B-T4 refund exceeds remaining collected basis → safe cap', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const paymentId = await createPayment(invoiceId, '500.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const bigRefund = await createRefund(invoiceId, '900.00');
    const capped = await accruals().reverseAccrual({
      accrualId,
      refundId: bigRefund,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(capped.commissionAmount.abs().toFixed(2)).toBe('150.00');
  });

  it('R4-F4B-T5 full-collected invoice refund regression', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const paymentId = await createPayment(invoiceId, '1000.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '1000.00');
    const rev = await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev.commissionAmount.abs().toFixed(2)).toBe('300.00');
  });

  it('R4-F4B-T6 invoice-basis refund regression', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string; commissionAmount: Prisma.Decimal }).id;
    const original = (posted.accruals[0] as { commissionAmount: Prisma.Decimal }).commissionAmount;
    const refundId = await createRefund(invoiceId, '500.00');
    const rev = await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev.commissionAmount.abs().toFixed(2)).toBe(
      original.mul(0.5).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    );
  });

  it('R4-F4B-T7/T8 concurrent refund reverse capped + same refund idempotent', async () => {
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 30,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId);
    const paymentId = await createPayment(invoiceId, '500.00');
    const posted = await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const rA = await createRefund(invoiceId, '500.00');
    const rB = await createRefund(invoiceId, '500.00');
    const race = await Promise.allSettled([
      accruals().reverseAccrual({
        accrualId,
        refundId: rA,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accruals().reverseAccrual({
        accrualId,
        refundId: rB,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    expect(race.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const rows = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: accrualId },
      }),
    );
    const reversedAbs = rows.reduce(
      (acc, r) => acc.add(new Prisma.Decimal(r.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    expect(reversedAbs.lte(150)).toBe(true);

    const perf2 = await createCompletedPerformance();
    const inv2 = await createInvoiceViaProductionPath(perf2);
    const pay2 = await createPayment(inv2.invoiceId, '500.00');
    const posted2 = await accruals().postFromCollectedPayment({
      servicePerformanceId: perf2,
      invoiceLineId: inv2.lineId,
      paymentId: pay2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrual2 = (posted2.accruals[0] as { id: string }).id;
    const refund2 = await createRefund(inv2.invoiceId, '500.00');
    const a = await accruals().reverseAccrual({
      accrualId: accrual2,
      refundId: refund2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const b = await accruals().reverseAccrual({
      accrualId: accrual2,
      refundId: refund2,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(b.id).toBe(a.id);
  });

  // ── R4-PKG course/package ──────────────────────────────────────────────────

  it('R4-PKG-T1/T3/T7/T9 allocated share not full package; production path', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await expect(
      accruals().postFromServicePerformance({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/explicit.*allocation|package/i);

    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      packageCommercialBasisAmount: '5000.00',
      currency: 'SYP',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `pkg-${sessionId}`,
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const row = posted.accruals[0] as {
      attributedRevenueAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
      packageAllocationId: string | null;
    };
    expect(row.attributedRevenueAmount.toFixed(2)).toBe('1000.00');
    expect(row.commissionAmount.toFixed(2)).toBe('300.00');
    expect(row.packageAllocationId).toBeTruthy();
  });

  it('R4-PKG-T2/T5/T6 cumulative cap + same session cannot earn twice', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '3000.00',
      packageCommercialBasisAmount: '5000.00',
      currency: 'SYP',
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `pkg-a-${sessionId}`,
    });
    const appt2 = randomUUID();
    const session2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.create({
        data: {
          id: appt2,
          tenantId,
          branchId,
          patientId,
          providerId: actorId,
          scheduledStart: new Date('2026-09-08T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-08T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
      await c.courseSession.create({
        data: {
          id: session2,
          tenantId,
          courseId,
          sequence: 2,
          appointmentId: appt2,
          status: 'COMPLETED',
        },
      });
    });
    const perf2 = await createCompletedPerformance({
      appointmentId: appt2,
      performedAt: new Date('2026-09-08T10:30:00.000Z'),
    });
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: session2,
        servicePerformanceId: perf2,
        allocatedRevenueAmount: '3000.00',
        packageCommercialBasisAmount: '5000.00',
        currency: 'SYP',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `pkg-b-${session2}`,
      }),
    ).rejects.toThrow(/exceed/i);

    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        packageCommercialBasisAmount: '5000.00',
        currency: 'SYP',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `pkg-dup-${sessionId}`,
      }),
    ).rejects.toThrow();
  });

  it('R4-PKG-T4/T8/T10 uncompleted earns zero; refund share; no course duplication', async () => {
    const { courseId, sessionId } = await seedCourseSession({ status: 'PLANNED' });
    const performanceId = await createCompletedPerformance();
    const coursesBefore = await wrapper.withPlatformBypass((c) =>
      c.treatmentCourse.count({ where: { tenantId } }),
    );
    await expect(
      packages().registerSessionAllocation({
        treatmentCourseId: courseId,
        courseSessionId: sessionId,
        servicePerformanceId: performanceId,
        allocatedRevenueAmount: '1000.00',
        packageCommercialBasisAmount: '5000.00',
        currency: 'SYP',
        actor: { actorId, actorRoles: ['owner'] },
        idempotencyKey: `pkg-plan-${sessionId}`,
      }),
    ).rejects.toThrow(/COMPLETED/i);
    const coursesAfter = await wrapper.withPlatformBypass((c) =>
      c.treatmentCourse.count({ where: { tenantId } }),
    );
    expect(coursesAfter).toBe(coursesBefore);

    await wrapper.withPlatformBypass(async (c) => {
      await c.courseSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' },
      });
    });
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      packageCommercialBasisAmount: '5000.00',
      currency: 'SYP',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `pkg-ref-${sessionId}`,
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '1000.00');
    const rev = await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev.commissionAmount.abs().toFixed(2)).toBe('60.00');
  });

  // ── R4-TRACE combined traceability ─────────────────────────────────────────

  it('R4-TRACE-T1/T2/T3/T4 non-empty inventory chain + reversal + settlement', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const snapId = await createSnapshot({ unitPrice: 1000 });
    const performanceId = await createCompletedPerformance({ snapshotRevisionId: snapId });
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      snapshotRevisionId: snapId,
    });
    const itemId = randomUUID();
    const batchId = randomUUID();
    const usageId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.inventoryItem.create({
        data: {
          id: itemId,
          tenantId,
          branchId,
          sku: `R4-${itemId.slice(0, 8)}`,
          nameEn: 'R4 item',
          unit: 'EA',
          quantityOnHand: 10,
        },
      });
      await c.inventoryBatch.create({
        data: {
          id: batchId,
          tenantId,
          inventoryItemId: itemId,
          lotNumber: 'LOT-R4',
          quantityOnHand: 10,
          status: 'ACTIVE',
        },
      });
      await c.$executeRaw`SELECT set_config('app.allow_inventory_usage_invoice_link', 'true', true)`;
      await c.inventoryUsageLedger.create({
        data: {
          id: usageId,
          tenantId,
          branchId,
          inventoryItemId: itemId,
          inventoryBatchId: batchId,
          quantityUsed: 1,
          usageType: 'CLINICAL_CONSUMPTION',
          consumedBy: actorId,
          patientId,
          appointmentId,
          clinicalServiceId,
          invoiceId,
          invoiceLineItemId: lineId,
          status: 'POSTED',
          attributionStatus: 'ATTRIBUTED',
        },
      });
    });
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const refundId = await createRefund(invoiceId, '100.00');
    await accruals().reverseAccrual({
      accrualId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    await accruals().settleAccrual({
      accrualId,
      settlementReference: 'R4-TRACE-SETTLE',
      amount: '50',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const report = await accruals().ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    const row = (report.drilldown as Array<Record<string, unknown>>).find(
      (d) => d.accrualId === accrualId,
    );
    expect(row).toBeTruthy();
    expect(row!.servicePerformanceId).toBe(performanceId);
    expect(row!.snapshotRevisionId).toBe(snapId);
    expect(row!.invoiceLineId).toBe(lineId);
    const usages = row!.inventoryUsages as Array<{ usageId: string; batchId: string | null }>;
    expect(usages.length).toBe(1);
    expect(usages[0]!.usageId).toBe(usageId);
    expect(usages[0]!.batchId).toBe(batchId);
    expect((row!.reversalIds as unknown[]).length).toBe(1);
    expect((row!.settlementAllocations as unknown[]).length).toBe(1);
  });

  it('R4-TRACE-T5/T6 cross-tenant hidden + zero-inventory still []', async () => {
    await enableAndPublishPlan({ userId: performerId, percentage: 30, effectiveFrom: '2026-01-01' });
    const performanceId = await createCompletedPerformance();
    const { lineId } = await createInvoiceViaProductionPath(performanceId);
    const posted = await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const accrualId = (posted.accruals[0] as { id: string }).id;
    const report = await accruals().ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    const row = (report.drilldown as Array<Record<string, unknown>>).find(
      (d) => d.accrualId === accrualId,
    );
    expect((row!.inventoryUsages as unknown[]).length).toBe(0);

    const otherTenant = randomUUID();
    const otherCtx = {
      resolve: async () => ({ tenantId: otherTenant, branchId: null, locale: 'en' }),
    };
    const otherAccruals = new CommissionAccrualService(
      wrapper as never,
      otherCtx as never,
      new StaffCommissionPlanService(wrapper as never, otherCtx as never, audit as never),
      audit as never,
    );
    const foreign = await otherAccruals.ownerReport({
      from: '2026-01-01',
      to: '2026-12-31',
      userId: performerId,
    });
    expect(
      (foreign.drilldown as Array<Record<string, unknown>>).some((d) => d.accrualId === accrualId),
    ).toBe(false);
  });

  // ── R4-CLOSED regressions ──────────────────────────────────────────────────

  it('R4-CLOSED F1 GoneException + F5 resolvePlanAt historical', async () => {
    const ctrl = new CommissionController(
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
      { execute: async () => ({}) } as never,
    );
    await expect(
      ctrl.calculateCommission({
        providerId: performerId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      } as never),
    ).rejects.toBeInstanceOf(GoneException);

    const oldPlan = await enableAndPublishPlan({
      userId: performerId,
      percentage: 25,
      effectiveFrom: '2026-01-01',
    });
    await enableAndPublishPlan({
      userId: performerId,
      percentage: 40,
      effectiveFrom: '2026-06-01',
    });
    const historical = await wrapper.withPlatformBypass((tx) =>
      plans().resolvePlanAt(tx, tenantId, performerId, new Date('2026-03-15')),
    );
    expect(historical.id).toBe(oldPlan.id);
    expect(Number(historical.percentage)).toBe(25);
  });
});
