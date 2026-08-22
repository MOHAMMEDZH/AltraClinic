/**
 * Phase 48 Wave F Round 13 — current-source guard + complete-set realizability (I2–I7).
 */
import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { Invoice } from '../../billing/domain/entities/invoice.entity';
import { PrismaInvoiceRepository } from '../../billing/infrastructure/prisma-invoice.repository';
import {
  CommissionAccrualService,
} from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type AccrualRootRow = {
  id: string;
  branchId: string | null;
  userId: string;
  servicePerformanceId: string;
  appointmentId: string | null;
  clinicalServiceId: string;
  snapshotRevisionId: string | null;
  invoiceId: string | null;
  invoiceLineId: string | null;
  paymentId: string | null;
  packageAllocationId: string | null;
  commissionPlanVersionId: string;
  calculationBasis: string;
  commissionPercent: Prisma.Decimal;
  currency: string;
};

describeDb('Wave F Round 13 remediation (PostgreSQL)', () => {
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
  function packages() {
    return new CommissionPackageAllocationService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    );
  }

  async function seed() {
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R13', slug: `wfr13-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr13-${u.id.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: u.first,
            lastName: u.last,
          },
        });
      }
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Ten' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: `R13 B ${branchId.slice(0, 6)}` },
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

  async function enableAndPublishPlan(opts?: {
    calculationBasis?: string;
    earningTrigger?: string;
    percentage?: number;
  }) {
    await plans().setUserCommissionEligibility(performerId, true, opts?.percentage ?? 10, '2026-01-01', {
      actorId,
      actorRoles: ['owner'],
    });
    const draft = await plans().createDraftPlan({
      userId: performerId,
      percentage: opts?.percentage ?? 10,
      effectiveFrom: '2026-01-01',
      calculationBasis: opts?.calculationBasis ?? 'COLLECTED_REVENUE',
      earningTrigger: opts?.earningTrigger ?? 'PAYMENT_COLLECTED',
      actor: { actorId, actorRoles: ['owner'] },
    });
    return plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
  }

  async function createCompletedPerformance() {
    const performanceId = randomUUID();
    const performedAt = new Date('2026-09-01T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId,
          patientId,
          appointmentId,
          clinicalServiceId,
          status: 'DRAFT',
          performedAt,
          createdBy: actorId,
          participants: {
            create: [
              {
                id: randomUUID(),
                tenantId,
                userId: performerId,
                role: 'PRIMARY',
                attributionShare: null,
                recordedBy: actorId,
              },
            ],
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
    opts?: { amount?: string; courseSessionId?: string | null },
  ) {
    const amount = opts?.amount ?? '5000.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R13-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R13',
      lineItems: [
        {
          description: 'R13 clinical line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId,
          clinicalServiceId,
          courseSessionId: opts?.courseSessionId ?? null,
        },
      ] as never,
    });
    invoice.issue();
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: invoice.lineItems[0]!.itemId };
  }

  async function seedCourseSession() {
    const courseId = randomUUID();
    const sessionId = randomUUID();
    const priceVersionId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.clinicalServicePriceVersion.create({
        data: {
          id: priceVersionId,
          tenantId,
          clinicalServiceId,
          pricingUnit: 'PER_COURSE',
          currency: 'SYP',
          unitPrice: '5000.00',
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
          appointmentId,
          status: 'COMPLETED',
        },
      });
    });
    return { courseId, sessionId };
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

  async function createRefund(invoiceId: string, amount: string) {
    const refundId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceRefund.create({
        data: {
          id: refundId,
          tenantId,
          invoiceId,
          amount,
          reason: 'R13 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function createSameInvoiceReplacementLine(
    invoiceId: string,
    opts?: { amount?: string; courseSessionId?: string | null },
  ) {
    const id = randomUUID();
    const amt = opts?.amount ?? '5000.00';
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceLineItem.create({
        data: {
          id,
          invoiceId,
          tenantId,
          description: 'R13 corrected line',
          quantity: 1,
          unitPrice: amt,
          discountPercent: 0,
          taxPercent: 0,
          subtotal: amt,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: amt,
          appointmentId,
          clinicalServiceId,
          courseSessionId: opts?.courseSessionId ?? null,
          servicePerformanceId: null,
        },
      });
    });
    return id;
  }

  async function openCollectedRoots(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          calculationBasis: 'COLLECTED_REVENUE',
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { id: 'asc' },
      });
      const open = [];
      for (const row of rows) {
        const revs = await c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: row.id, status: 'REVERSED' },
        });
        const reversed = revs.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
          new Prisma.Decimal(0),
        );
        if (new Prisma.Decimal(row.commissionAmount).sub(reversed).gt(0)) open.push(row);
      }
      return open;
    });
  }

  async function openInvoiceRoots(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          NOT: { calculationBasis: 'COLLECTED_REVENUE' },
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { id: 'asc' },
      });
      const open = [];
      for (const row of rows) {
        const revs = await c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: row.id, status: 'REVERSED' },
        });
        const reversed = revs.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
          new Prisma.Decimal(0),
        );
        if (new Prisma.Decimal(row.commissionAmount).sub(reversed).gt(0)) open.push(row);
      }
      return open;
    });
  }

  async function netAttributed(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const rows = await c.commissionAccrual.findMany({
        where: { tenantId, servicePerformanceId: performanceId, reversalOfAccrualId: null },
      });
      let total = new Prisma.Decimal(0);
      for (const row of rows) {
        const revs = await c.commissionAccrual.findMany({
          where: { tenantId, reversalOfAccrualId: row.id, status: 'REVERSED' },
        });
        const revSum = revs.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
          new Prisma.Decimal(0),
        );
        total = total.add(new Prisma.Decimal(row.attributedRevenueAmount).sub(revSum));
      }
      return total;
    });
  }

  async function setupPackageCollected() {
    await enableAndPublishPlan({
      calculationBasis: 'COLLECTED_REVENUE',
      earningTrigger: 'PAYMENT_COLLECTED',
      percentage: 10,
    });
    const { courseId, sessionId } = await seedCourseSession();
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    const alloc = await packages().registerSessionAllocation({
      treatmentCourseId: courseId,
      courseSessionId: sessionId,
      servicePerformanceId: performanceId,
      allocatedRevenueAmount: '1000.00',
      invoiceLineId: lineId,
      actor: { actorId, actorRoles: ['owner'] },
      idempotencyKey: `r13-${sessionId}`,
    });
    const pay = await createPayment(invoiceId, '800.00');
    await accruals().postFromCollectedPayment({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      paymentId: pay,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return {
      courseId,
      sessionId,
      performanceId,
      invoiceId,
      lineId,
      packageAllocationId: (alloc as { allocation: { id: string } }).allocation.id,
    };
  }

  async function setupInvoiceFinalized(amount = '160.00') {
    await enableAndPublishPlan({
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, { amount });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { performanceId, invoiceId, lineId };
  }

  async function plantRefundEffects(
    root: AccrualRootRow,
    effects: Array<{ refundId: string; attributed: string; commission: string; reason?: string }>,
  ) {
    for (const effect of effects) {
      await wrapper.withPlatformBypass(async (c) => {
        await c.commissionAccrual.create({
          data: {
            id: randomUUID(),
            tenantId,
            branchId: root.branchId,
            userId: root.userId,
            servicePerformanceId: root.servicePerformanceId,
            appointmentId: root.appointmentId,
            clinicalServiceId: root.clinicalServiceId,
            snapshotRevisionId: root.snapshotRevisionId,
            invoiceId: root.invoiceId,
            invoiceLineId: root.invoiceLineId,
            paymentId: root.paymentId,
            packageAllocationId: root.packageAllocationId,
            refundId: effect.refundId,
            commissionPlanVersionId: root.commissionPlanVersionId,
            calculationBasis: root.calculationBasis as never,
            attributedRevenueAmount: effect.attributed,
            commissionPercent: root.commissionPercent,
            commissionAmount: effect.commission,
            currency: root.currency,
            status: 'REVERSED',
            earnedAt: new Date(),
            reversalOfAccrualId: root.id,
            idempotencyKey: `rev:${root.id}:${effect.refundId}`,
            reason: effect.reason ?? 'R13 planted refund',
            createdBy: actorId,
          },
        });
      });
    }
  }

  async function snapshotPerf(performanceId: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const accrualsRows = await c.commissionAccrual.findMany({
        where: { tenantId, servicePerformanceId: performanceId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          status: true,
          attributedRevenueAmount: true,
          commissionAmount: true,
          refundId: true,
          correctionEventId: true,
          reversalOfAccrualId: true,
          idempotencyKey: true,
          packageAllocationId: true,
        },
      });
      const audits = await c.auditEntry.findMany({
        where: { tenantId, resourceType: 'workforce_commercials_wave_f' },
        orderBy: { id: 'asc' },
        select: { id: true, action: true, resourceId: true },
      });
      return {
        accruals: accrualsRows.map((r) => ({
          ...r,
          attributedRevenueAmount: r.attributedRevenueAmount.toString(),
          commissionAmount: r.commissionAmount.toString(),
        })),
        audits,
        net: (await netAttributed(performanceId)).toFixed(2),
      };
    });
  }

  async function findActiveLine(performanceId: string) {
    return wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          performanceBindingStatus: 'ACTIVE',
        },
      }),
    );
  }

  async function findCurrentOpenRoot(performanceId: string, basis?: 'invoice' | 'collected') {
    const open =
      basis === 'collected'
        ? await openCollectedRoots(performanceId)
        : await openInvoiceRoots(performanceId);
    if (open.length === 1) return open[0]!;
    return wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findFirst({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          status: { in: ['EARNED', 'SETTLED'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
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

  it('R13-A-T1: partial refund correction then stale root + ACTIVE successor replacement rejects; net stays 80', async () => {
    const { performanceId, invoiceId } = await setupInvoiceFinalized('160.00');
    const root0 = (await openInvoiceRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '80.00');
    await accruals().reverseAccrual({
      accrualId: root0.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');

    const event1 = randomUUID();
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    await accruals().correctAndRepost({
      accrualId: root0.id,
      correctionEventId: event1,
      replacementInvoiceLineId: repl1,
      reason: 'R13-A-T1-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });

    const activeLine = await findActiveLine(performanceId);
    expect(activeLine!.id).toBe(repl1);
    const successorRoot = await findCurrentOpenRoot(performanceId, 'invoice');
    expect(successorRoot).toBeTruthy();
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');

    await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    const before = await snapshotPerf(performanceId);
    const event2 = randomUUID();
    await expect(
      accruals().correctAndRepost({
        accrualId: root0.id,
        correctionEventId: event2,
        replacementInvoiceLineId: activeLine!.id,
        reason: 'R13-A-T1-stale-attack',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/stale|ACTIVE|SUPERSEDED|successor|not the current|cannot branch/i);

    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    expect((await netAttributed(performanceId)).toFixed(2)).not.toBe('160.00');

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({
        test: 'R13-A-T1',
        root0Id: root0.id,
        successorRootId: successorRoot!.id,
        activeLineId: activeLine!.id,
        net: '80.00',
        snapshotEqual: true,
      }),
    );
  });

  it('R13-A-T2: full refund correction succeeds; stale second event rejects with snapshot equality', async () => {
    const { performanceId, invoiceId } = await setupInvoiceFinalized('160.00');
    const root0 = (await openInvoiceRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '160.00');
    await accruals().reverseAccrual({
      accrualId: root0.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');

    const event1 = randomUUID();
    const repl1 = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    await accruals().correctAndRepost({
      accrualId: root0.id,
      correctionEventId: event1,
      replacementInvoiceLineId: repl1,
      reason: 'R13-A-T2-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');

    const activeLine = await findActiveLine(performanceId);
    const before = await snapshotPerf(performanceId);
    await expect(
      accruals().correctAndRepost({
        accrualId: root0.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: activeLine!.id,
        reason: 'R13-A-T2-stale',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/stale|ACTIVE|SUPERSEDED|successor|not the current|cannot branch/i);

    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({ test: 'R13-A-T2', net: '0.00', staleRejected: true, snapshotEqual: true }),
    );
  });

  it('R13-A-T3: package COLLECTED_REVENUE stale-source attempt rejects', async () => {
    const { performanceId, invoiceId, sessionId } = await setupPackageCollected();
    const root0 = (await openCollectedRoots(performanceId))[0]!;
    expect(new Prisma.Decimal(root0.attributedRevenueAmount).toFixed(2)).toBe('160.00');

    const repl1 = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: sessionId,
    });
    await accruals().correctAndRepost({
      accrualId: root0.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl1,
      reason: 'R13-A-T3-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });

    const activeLine = await findActiveLine(performanceId);
    expect(activeLine!.id).toBe(repl1);
    const before = await snapshotPerf(performanceId);
    await expect(
      accruals().correctAndRepost({
        accrualId: root0.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: activeLine!.id,
        reason: 'R13-A-T3-stale',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/stale|ACTIVE|SUPERSEDED|successor|not the current|cannot branch/i);

    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('160.00');

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({
        test: 'R13-A-T3',
        root0Id: root0.id,
        activeLineId: activeLine!.id,
        net: '160.00',
      }),
    );
  });

  it('R13-A-T5: valid same-event replay returns same IDs, no new rows/audits', async () => {
    const { performanceId, invoiceId } = await setupInvoiceFinalized('160.00');
    const root0 = (await openInvoiceRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '80.00');
    await accruals().reverseAccrual({
      accrualId: root0.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });

    const eventId = randomUUID();
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    const first = await accruals().correctAndRepost({
      accrualId: root0.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repl,
      reason: 'R13-A-T5',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carryIds1 = (
      first as { refundCarryForwards: Array<{ id: string }> }
    ).refundCarryForwards
      .map((c) => c.id)
      .sort();
    const repostLineId = (
      first as { repost: { accruals: Array<{ invoiceLineId: string | null }> } }
    ).repost.accruals[0]!.invoiceLineId!;

    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const auditsBefore = auditCalls.filter(
      (a) =>
        a.action === 'staff_commission.accrual.refund_carried' ||
        a.action === 'staff_commission.accrual.corrected',
    ).length;

    const second = await accruals().correctAndRepost({
      accrualId: root0.id,
      correctionEventId: eventId,
      replacementInvoiceLineId: repostLineId,
      reason: 'R13-A-T5-replay',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carryIds2 = (
      second as { refundCarryForwards: Array<{ id: string }> }
    ).refundCarryForwards
      .map((c) => c.id)
      .sort();
    expect(carryIds2).toEqual(carryIds1);

    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(countAfter).toBe(countBefore);
    expect(
      auditCalls.filter(
        (a) =>
          a.action === 'staff_commission.accrual.refund_carried' ||
          a.action === 'staff_commission.accrual.corrected',
      ).length,
    ).toBe(auditsBefore);

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({
        test: 'R13-A-T5',
        carryIds1,
        countBefore,
        countAfter,
        idempotent: true,
      }),
    );
  });

  it('R13-A-T6: sequential correction from current successor succeeds; stale source0 rejects', async () => {
    const { performanceId, invoiceId } = await setupInvoiceFinalized('160.00');
    const root0 = (await openInvoiceRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '80.00');
    await accruals().reverseAccrual({
      accrualId: root0.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });

    const repl1 = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    await accruals().correctAndRepost({
      accrualId: root0.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl1,
      reason: 'R13-A-T6-c1',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root1 = await findCurrentOpenRoot(performanceId, 'invoice');
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');

    const repl2 = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    await accruals().correctAndRepost({
      accrualId: root1!.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl2,
      reason: 'R13-A-T6-c2',
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');

    const activeLine = await findActiveLine(performanceId);
    await expect(
      accruals().correctAndRepost({
        accrualId: root0.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: activeLine!.id,
        reason: 'R13-A-T6-stale',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/stale|ACTIVE|SUPERSEDED|successor|not the current|cannot branch/i);

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({
        test: 'R13-A-T6',
        root0Id: root0.id,
        root1Id: root1!.id,
        net: '80.00',
        sequentialOk: true,
        staleRejected: true,
      }),
    );
  });

  it('R13-A-T7: concurrent different correctionEventIds — one ACTIVE line and one successor net', async () => {
    const { performanceId, invoiceId } = await setupInvoiceFinalized('160.00');
    const root0 = (await openInvoiceRoots(performanceId))[0]!;
    const replA = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    const replB = await createSameInvoiceReplacementLine(invoiceId, { amount: '160.00' });
    const eventA = randomUUID();
    const eventB = randomUUID();

    const releaseA = deferred<void>();
    const aReady = deferred<number>();
    let pidA = 0;
    const aTxn = wrapper.withPlatformBypass(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      pidA = Number(rows[0]!.pid);
      await accruals().correctAndRepost(
        {
          accrualId: root0.id,
          correctionEventId: eventA,
          replacementInvoiceLineId: replA,
          reason: 'R13-A-T7-A',
          actor: actorId,
          actorRoles: ['owner'],
        },
        tx,
      );
      aReady.resolve(pidA);
      await releaseA.promise;
    });
    await aReady.promise;

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    let pidB = 0;
    const bStarted = deferred<void>();
    const bPromise = (async () => {
      return wrapperB.withPlatformBypass(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        pidB = Number(rows[0]!.pid);
        bStarted.resolve();
        return accrualsB.correctAndRepost(
          {
            accrualId: root0.id,
            correctionEventId: eventB,
            replacementInvoiceLineId: replB,
            reason: 'R13-A-T7-B',
            actor: actorId,
            actorRoles: ['owner'],
          },
          tx,
        );
      });
    })();
    await bStarted.promise;

    let blockers: number[] = [];
    let blocked = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const rows = await raw.$queryRawUnsafe<Array<{ pid: number }>>(
        `SELECT unnest(pg_blocking_pids($1::int)) AS pid`,
        pidB,
      );
      blockers = rows.map((r) => Number(r.pid));
      if (blockers.includes(pidA)) {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(blocked).toBe(true);
    expect(blockers).toContain(pidA);

    releaseA.resolve();
    await aTxn;

    let bOutcome: 'ok' | 'err' = 'ok';
    let bErr: unknown = null;
    try {
      await bPromise;
    } catch (e) {
      bOutcome = 'err';
      bErr = e;
    }
    await clientB.$disconnect();

    expect(bOutcome).toBe('err');
    expect(String(bErr)).toMatch(/stale|ACTIVE|SUPERSEDED|successor|not the current|cannot branch/i);

    const activeLines = await wrapper.withPlatformBypass((c) =>
      c.invoiceLineItem.findMany({
        where: { tenantId, servicePerformanceId: performanceId, performanceBindingStatus: 'ACTIVE' },
      }),
    );
    expect(activeLines).toHaveLength(1);

    const openRoots = await openInvoiceRoots(performanceId);
    expect(openRoots.length).toBe(1);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('160.00');

    const successorReposts = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          reason: { startsWith: 'correction-repost:' },
        },
      }),
    );
    expect(successorReposts).toBe(1);

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({
        test: 'R13-A-T7',
        pidA,
        pidB,
        pg_blocking_pids: blockers,
        blocked,
        bOutcome,
        bErr: bErr ? String(bErr).slice(0, 160) : null,
        activeLineCount: activeLines.length,
        successorReposts,
        net: '160.00',
      }),
    );
  });

  it('R13-B-T1: impossible saturated -100/-60 planted refunds reject; snapshot equality', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundA = await createRefund(invoiceId, '700.00');
    const refundB = await createRefund(invoiceId, '400.00');
    await plantRefundEffects(root as AccrualRootRow, [
      { refundId: refundA, attributed: '-100.0000', commission: '-10.0000', reason: 'R13-B-T1-A' },
      { refundId: refundB, attributed: '-60.0000', commission: '-6.0000', reason: 'R13-B-T1-B' },
    ]);

    const before = await snapshotPerf(performanceId);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R13-B-T1',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not realizable|MULTIPLE_RESIDUALS/i);

    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({ test: 'R13-B-T1', rejected: true, snapshotEqual: true }),
    );
  });

  it('R13-B-T2: valid A-first plant -140/-20; correct carries; net 0', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundA = await createRefund(invoiceId, '700.00');
    const refundB = await createRefund(invoiceId, '400.00');
    await plantRefundEffects(root as AccrualRootRow, [
      { refundId: refundA, attributed: '-140.0000', commission: '-14.0000', reason: 'R13-B-T2-A' },
      { refundId: refundB, attributed: '-20.0000', commission: '-2.0000', reason: 'R13-B-T2-B' },
    ]);

    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R13-B-T2',
      actor: actorId,
      actorRoles: ['owner'],
    });

    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(0);

    // eslint-disable-next-line no-console
    console.log('R13_DIAG', JSON.stringify({ test: 'R13-B-T2', net: '0.00' }));
  });

  it('R13-B-T3: valid B-first plant -80/-80; correct carries; net 0', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundA = await createRefund(invoiceId, '700.00');
    const refundB = await createRefund(invoiceId, '400.00');
    await plantRefundEffects(root as AccrualRootRow, [
      { refundId: refundB, attributed: '-80.0000', commission: '-8.0000', reason: 'R13-B-T3-B' },
      { refundId: refundA, attributed: '-80.0000', commission: '-8.0000', reason: 'R13-B-T3-A' },
    ]);

    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await accruals().correctAndRepost({
      accrualId: root.id,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R13-B-T3',
      actor: actorId,
      actorRoles: ['owner'],
    });

    expect((await netAttributed(performanceId)).toFixed(2)).toBe('0.00');
    const open = await openCollectedRoots(performanceId);
    expect(open).toHaveLength(0);

    // eslint-disable-next-line no-console
    console.log('R13_DIAG', JSON.stringify({ test: 'R13-B-T3', net: '0.00' }));
  });

  it('R13-B-T4: unsaturated history with arbitrary partial row rejects', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundA = await createRefund(invoiceId, '700.00');
    await plantRefundEffects(root as AccrualRootRow, [
      { refundId: refundA, attributed: '-50.0000', commission: '-5.0000', reason: 'R13-B-T4-partial' },
    ]);

    const before = await snapshotPerf(performanceId);
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    await expect(
      accruals().correctAndRepost({
        accrualId: root.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R13-B-T4',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/not realizable|PARTIAL_BEFORE_EXHAUSTION/i);

    const after = await snapshotPerf(performanceId);
    expect(after).toEqual(before);

    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({ test: 'R13-B-T4', rejected: true, snapshotEqual: true }),
    );
  });
});
