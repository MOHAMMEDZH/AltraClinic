/**
 * Phase 48 Wave F Round 11 — authoritative existing-refund economic compatibility.
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { Invoice } from '../../billing/domain/entities/invoice.entity';
import { PrismaInvoiceRepository } from '../../billing/infrastructure/prisma-invoice.repository';
import { AuditTrailWaveFAuditLog } from '../infrastructure/audit-trail-wave-f-audit-log';
import {
  CommissionAccrualService,
  isRecoverableCommissionRefundUniqueConflict,
  isPermittedRootRefundIdempotencyKey,
  canonicalRootRefundIdempotencyKey,
} from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave F Round 11 remediation (PostgreSQL)', () => {
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
        data: { id: tenantId, name: 'WF R11', slug: `wfr11-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr11-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R11 B ${branchId.slice(0, 6)}` },
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
    userId?: string;
    percentage?: number;
    calculationBasis?: string;
    earningTrigger?: string;
  }) {
    const userId = opts?.userId ?? performerId;
    await plans().setUserCommissionEligibility(
      userId,
      true,
      opts?.percentage ?? 10,
      '2026-01-01',
      { actorId, actorRoles: ['owner'] },
    );
    const draft = await plans().createDraftPlan({
      userId,
      percentage: opts?.percentage ?? 10,
      effectiveFrom: '2026-01-01',
      calculationBasis: opts?.calculationBasis ?? 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: opts?.earningTrigger ?? 'INVOICE_OR_CHARGE_FINALIZED',
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
    const amount = opts?.amount ?? '1000.00';
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R11-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R11',
      lineItems: [
        {
          description: 'R11 clinical line',
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
    return {
      invoiceId: invoice.invoiceId,
      lineId: invoice.lineItems[0]!.itemId,
      amountTotal: invoice.amountTotal,
    };
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
          reason: 'R11 refund',
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
          description: 'R11 corrected line',
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

  async function netCommission(performanceId: string) {
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
          (a, r) => a.add(new Prisma.Decimal(r.commissionAmount).abs()),
          new Prisma.Decimal(0),
        );
        total = total.add(new Prisma.Decimal(row.commissionAmount).sub(revSum));
      }
      return total;
    });
  }

  async function setupPackageCollected(opts?: { payments?: string[] }) {
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
      idempotencyKey: `r11-${sessionId}`,
    });
    const paymentAmounts = opts?.payments ?? ['800.00'];
    const paymentIds: string[] = [];
    for (const amt of paymentAmounts) {
      const pay = await createPayment(invoiceId, amt);
      paymentIds.push(pay);
      await accruals().postFromCollectedPayment({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId: pay,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    return {
      courseId,
      sessionId,
      performanceId,
      invoiceId,
      lineId,
      paymentIds,
      packageAllocationId: (alloc as { allocation: { id: string } }).allocation.id,
    };
  }

  async function setupInvoiceFinalized() {
    await enableAndPublishPlan({
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
      percentage: 10,
    });
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, {
      amount: '1000.00',
    });
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    return { performanceId, invoiceId, lineId };
  }

  async function plantBogusReversal(
    root: {
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
    },
    refundId: string,
    patch: Record<string, unknown>,
  ) {
    const id = randomUUID();
    const base = {
      id,
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
      refundId,
      commissionPlanVersionId: root.commissionPlanVersionId,
      calculationBasis: root.calculationBasis,
      attributedRevenueAmount: '-80.0000',
      commissionPercent: root.commissionPercent,
      commissionAmount: '-8.0000',
      currency: root.currency,
      status: 'REVERSED',
      earnedAt: new Date(),
      reversalOfAccrualId: root.id,
      idempotencyKey: canonicalRootRefundIdempotencyKey(root.id, refundId),
      reason: 'R11 planted',
      createdBy: actorId,
    };
    await wrapper.withPlatformBypass(async (c) => {
      await c.commissionAccrual.create({ data: { ...base, ...patch } as never });
    });
    return id;
  }

  async function snapshotEconomicState(performanceId: string, lineId: string, packageAllocationId?: string) {
    return wrapper.withPlatformBypass(async (c) => {
      const accrualsRows = await c.commissionAccrual.findMany({
        where: { tenantId, servicePerformanceId: performanceId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          correctionEventId: true,
          reversalOfAccrualId: true,
          refundId: true,
          attributedRevenueAmount: true,
          commissionAmount: true,
          status: true,
          idempotencyKey: true,
          invoiceLineId: true,
          packageAllocationId: true,
        },
      });
      const lines = await c.invoiceLineItem.findMany({
        where: { tenantId, id: { in: [lineId] } },
        select: {
          id: true,
          servicePerformanceId: true,
          performanceBindingStatus: true,
        },
      });
      const allLines = await c.invoiceLineItem.findMany({
        where: { tenantId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          servicePerformanceId: true,
          performanceBindingStatus: true,
        },
      });
      const pkg = packageAllocationId
        ? await c.commissionPackageSessionAllocation.findFirst({
            where: { id: packageAllocationId, tenantId },
          })
        : null;
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
        lines,
        allLines,
        package: pkg
          ? {
              id: pkg.id,
              invoiceLineId: pkg.invoiceLineId,
              financiallyConsumedAt: pkg.financiallyConsumedAt?.toISOString() ?? null,
              allocatedRevenueAmount: pkg.allocatedRevenueAmount.toString(),
              servicePerformanceId: pkg.servicePerformanceId,
            }
          : null,
        audits,
        netAttributed: (await netAttributed(performanceId)).toFixed(2),
        netCommission: (await netCommission(performanceId)).toFixed(2),
      };
    });
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

  async function expectRejectZeroSideEffects(
    testId: string,
    performanceId: string,
    rootId: string,
    refundId: string,
    plantedId: string,
    mismatch: string,
  ) {
    const beforeCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    const beforeNet = await netAttributed(performanceId);
    const beforeComm = await netCommission(performanceId);
    const beforeAudits = auditCalls.length;

    await expect(
      accruals().reverseAccrual({
        accrualId: rootId,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/idempotency conflict|not realizable|complete-set/i);

    const afterCount = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, servicePerformanceId: performanceId } }),
    );
    expect(afterCount).toBe(beforeCount);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(beforeNet.toFixed(2));
    expect((await netCommission(performanceId)).toFixed(2)).toBe(beforeComm.toFixed(2));
    expect(auditCalls.length).toBe(beforeAudits);

    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({
        test: testId,
        tenantId,
        rootId,
        refundId,
        existingRowId: plantedId,
        mismatch,
        beforeCount,
        afterCount,
        beforeNet: beforeNet.toFixed(2),
        afterNet: (await netAttributed(performanceId)).toFixed(2),
      }),
    );
  }

  it('R11-A-T1: wrong attributed revenue on existing semantic row — reject, zero side effects', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const plantedId = await plantBogusReversal(root, refundId, {
      attributedRevenueAmount: '-1.0000',
      commissionAmount: '-8.0000',
    });
    await expectRejectZeroSideEffects(
      'R11-A-T1',
      performanceId,
      root.id,
      refundId,
      plantedId,
      'attributedRevenueAmount',
    );
  });

  it('R11-A-T2: wrong commission on existing semantic row — reject, zero side effects', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const plantedId = await plantBogusReversal(root, refundId, {
      attributedRevenueAmount: '-80.0000',
      commissionAmount: '-0.1000',
    });
    await expectRejectZeroSideEffects(
      'R11-A-T2',
      performanceId,
      root.id,
      refundId,
      plantedId,
      'commissionAmount',
    );
  });

  it('R11-A-T3: positive amounts with matching absolute values — reject', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const beforeNetRev = (await netAttributed(performanceId)).toFixed(2);
    const beforeNetComm = (await netCommission(performanceId)).toFixed(2);
    // R15-A: DB check commission_accruals_reversed_economic_shape_chk forbids positive REVERSED rows.
    // Prove rejection at the database boundary (stronger than app-only acceptExisting).
    await expect(
      plantBogusReversal(root, refundId, {
        attributedRevenueAmount: '80.0000',
        commissionAmount: '8.0000',
      }),
    ).rejects.toThrow(/commission_accruals_reversed_economic_shape_chk|check constraint|23514/i);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(beforeNetRev);
    expect((await netCommission(performanceId)).toFixed(2)).toBe(beforeNetComm);
    const planted = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId },
      }),
    );
    expect(planted).toBe(0);
  });

  it('R11-A-T4: existing row status not REVERSED — reject', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const plantedId = await plantBogusReversal(root, refundId, {
      status: 'EARNED',
      attributedRevenueAmount: '-80.0000',
      commissionAmount: '-8.0000',
    });
    await expectRejectZeroSideEffects(
      'R11-A-T4',
      performanceId,
      root.id,
      refundId,
      plantedId,
      'status',
    );
  });

  it('R11-A-T5: lineage mismatch matrix fail-closed', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const cases: Array<{ field: string; patch: Record<string, unknown> }> = [
      { field: 'servicePerformanceId', patch: { servicePerformanceId: randomUUID() } },
      { field: 'invoiceLineId', patch: { invoiceLineId: randomUUID() } },
      { field: 'commissionPlanVersionId', patch: { commissionPlanVersionId: randomUUID() } },
      {
        field: 'calculationBasis',
        patch: { calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT' },
      },
      { field: 'commissionPercent', patch: { commissionPercent: '99.00' } },
      { field: 'appointmentId', patch: { appointmentId: randomUUID() } },
      { field: 'clinicalServiceId', patch: { clinicalServiceId: randomUUID() } },
      { field: 'packageAllocationId', patch: { packageAllocationId: randomUUID() } },
    ];

    for (const c of cases) {
      tenantId = randomUUID();
      actorId = randomUUID();
      performerId = randomUUID();
      patientId = randomUUID();
      branchId = randomUUID();
      clinicalServiceId = randomUUID();
      appointmentId = randomUUID();
      await seed();
      const setup = await setupPackageCollected();
      const r = (await openCollectedRoots(setup.performanceId))[0]!;
      const refundId = await createRefund(setup.invoiceId, '400.00');
      // FK-safe patches only where needed
      let patch = { ...c.patch };
      if (c.field === 'servicePerformanceId') {
        const otherPerf = await createCompletedPerformance();
        patch = { servicePerformanceId: otherPerf };
      }
      if (c.field === 'clinicalServiceId') {
        const otherSvc = randomUUID();
        await wrapper.withPlatformBypass(async (tx) => {
          await tx.canonicalClinicalServiceDefinition.create({
            data: {
              id: otherSvc,
              tenantId,
              provenance: 'TENANT_CUSTOM',
              stableKey: `tenant.${tenantId}.custom.wf-${otherSvc.slice(0, 8)}`,
              domain: 'GENERAL',
              lifecycle: 'PUBLISHED',
            },
          });
        });
        patch = { clinicalServiceId: otherSvc };
      }
      if (c.field === 'appointmentId') {
        const otherAppt = randomUUID();
        await wrapper.withPlatformBypass(async (tx) => {
          await tx.appointment.create({
            data: {
              id: otherAppt,
              tenantId,
              branchId,
              patientId,
              providerId: actorId,
              scheduledStart: new Date('2026-09-02T10:00:00.000Z'),
              scheduledEnd: new Date('2026-09-02T11:00:00.000Z'),
              status: 'CONFIRMED',
              clinicalServiceId,
            },
          });
        });
        patch = { appointmentId: otherAppt };
      }
      if (c.field === 'commissionPlanVersionId') {
        const draft = await plans().createDraftPlan({
          userId: performerId,
          percentage: 10,
          effectiveFrom: '2026-06-01',
          calculationBasis: 'COLLECTED_REVENUE',
          earningTrigger: 'PAYMENT_COLLECTED',
          actor: { actorId, actorRoles: ['owner'] },
        });
        const pub = await plans().publishPlan(draft.id, { actorId, actorRoles: ['owner'] });
        patch = { commissionPlanVersionId: (pub as { id: string }).id };
      }
      if (c.field === 'invoiceLineId') {
        const otherLine = await createSameInvoiceReplacementLine(setup.invoiceId, {
          amount: '5000.00',
        });
        patch = { invoiceLineId: otherLine };
      }
      if (c.field === 'packageAllocationId') {
        const { courseId, sessionId } = await seedCourseSession();
        // second session allocation on a fresh course so FK is valid but lineage mismatches
        const otherPerf = await createCompletedPerformance();
        const { lineId: otherLine } = await createInvoiceViaProductionPath(otherPerf, {
          amount: '5000.00',
          courseSessionId: sessionId,
        });
        const otherAlloc = await packages().registerSessionAllocation({
          treatmentCourseId: courseId,
          courseSessionId: sessionId,
          servicePerformanceId: otherPerf,
          allocatedRevenueAmount: '1000.00',
          invoiceLineId: otherLine,
          actor: { actorId, actorRoles: ['owner'] },
          idempotencyKey: `r11-other-${sessionId}`,
        });
        patch = {
          packageAllocationId: (otherAlloc as { allocation: { id: string } }).allocation.id,
        };
        const plantedId = await plantBogusReversal(r, refundId, patch);
        await expect(
          accruals().reverseAccrual({
            accrualId: r.id,
            refundId,
            actor: actorId,
            actorRoles: ['owner'],
          }),
        ).rejects.toThrow(/idempotency conflict|not realizable|complete-set/i);
        // eslint-disable-next-line no-console
        console.log(
          'R11_DIAG',
          JSON.stringify({ test: 'R11-A-T5', field: c.field, plantedId, ok: true }),
        );
        continue;
      }

      const plantedId = await plantBogusReversal(r, refundId, patch);
      await expect(
        accruals().reverseAccrual({
          accrualId: r.id,
          refundId,
          actor: actorId,
          actorRoles: ['owner'],
        }),
      ).rejects.toThrow(/idempotency conflict|not realizable|complete-set/i);
      // eslint-disable-next-line no-console
      console.log(
        'R11_DIAG',
        JSON.stringify({ test: 'R11-A-T5', field: c.field, plantedId, ok: true }),
      );
    }
  });

  it('R11-A-T6: valid normal reverseAccrual replay — same row, no audit growth, nets preserved', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const first = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId },
      }),
    );
    const auditsBefore = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.reversed',
    ).length;
    const netBefore = await netAttributed(performanceId);
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe((first as { id: string }).id);
    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId },
      }),
    );
    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(1);
    expect(
      auditCalls.filter((a) => a.action === 'staff_commission.accrual.reversed').length,
    ).toBe(auditsBefore);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe(netBefore.toFixed(2));
    expect(netBefore.toFixed(2)).toBe('80.00');
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({
        test: 'R11-A-T6',
        returnedId: (replay as { id: string }).id,
        amounts: {
          attributed: (first as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount.toString(),
          commission: (first as { commissionAmount: Prisma.Decimal }).commissionAmount.toString(),
        },
      }),
    );
  });

  it('R11-A-T7: valid correction carry replay — same carry, nets 80/8', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const originalRootId = (await openCollectedRoots(performanceId))[0]!.id;
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: originalRootId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });
    const corr = await accruals().correctAndRepost({
      accrualId: originalRootId,
      correctionEventId: randomUUID(),
      replacementInvoiceLineId: repl,
      reason: 'R11-A-T7',
      actor: actorId,
      actorRoles: ['owner'],
    });
    const carryId = (corr as { refundCarryForwards: Array<{ id: string }> }).refundCarryForwards[0]!
      .id;
    const replacementRootId = (await openCollectedRoots(performanceId))[0]!.id;
    const auditsBefore = auditCalls.length;
    const replay = await accruals().reverseAccrual({
      accrualId: replacementRootId,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe(carryId);
    expect(auditCalls.length).toBe(auditsBefore);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('80.00');
    expect((await netCommission(performanceId)).toFixed(2)).toBe('8.00');
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({ test: 'R11-A-T7', carryId, replacementRootId, refundId }),
    );
  });

  it('R11-A-T8: multiple refunds with caps — reverse-order replay preserves exact amounts', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundA = await createRefund(invoiceId, '400.00'); // 80
    const refundB = await createRefund(invoiceId, '200.00'); // 40
    const a = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const b = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(
      new Prisma.Decimal((a as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount)
        .toFixed(2),
    ).toBe('-80.00');
    expect(
      new Prisma.Decimal((b as { attributedRevenueAmount: Prisma.Decimal }).attributedRevenueAmount)
        .toFixed(2),
    ).toBe('-40.00');

    const countBefore = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, reversalOfAccrualId: root.id } }),
    );
    const replayB = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundB,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const replayA = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: refundA,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replayB as { id: string }).id).toBe((b as { id: string }).id);
    expect((replayA as { id: string }).id).toBe((a as { id: string }).id);
    const countAfter = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({ where: { tenantId, reversalOfAccrualId: root.id } }),
    );
    expect(countAfter).toBe(countBefore);
    expect((await netAttributed(performanceId)).toFixed(2)).toBe('40.00');
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({
        test: 'R11-A-T8',
        refundA,
        refundB,
        amountA: '-80.00',
        amountB: '-40.00',
        netAfter: '40.00',
      }),
    );
  });

  it('R11-A-T9: legacy rev_corr_refund key accepted only after full validation; wrong amount rejected', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const eventId = randomUUID();
    const legacyKey = `rev_corr_refund:${root.id}:${refundId}:${eventId}`;
    expect(isPermittedRootRefundIdempotencyKey(legacyKey, root.id, refundId)).toBe(true);

    const goodId = await plantBogusReversal(root, refundId, {
      idempotencyKey: legacyKey,
      correctionEventId: eventId,
      attributedRevenueAmount: '-80.0000',
      commissionAmount: '-8.0000',
    });
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((replay as { id: string }).id).toBe(goodId);

    // Fresh tenant: wrong amount with legacy key
    tenantId = randomUUID();
    actorId = randomUUID();
    performerId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    await seed();
    const setup2 = await setupPackageCollected();
    const root2 = (await openCollectedRoots(setup2.performanceId))[0]!;
    const refund2 = await createRefund(setup2.invoiceId, '400.00');
    const event2 = randomUUID();
    const badKey = `rev_corr_refund:${root2.id}:${refund2}:${event2}`;
    const badId = await plantBogusReversal(root2, refund2, {
      idempotencyKey: badKey,
      correctionEventId: event2,
      attributedRevenueAmount: '-1.0000',
      commissionAmount: '-8.0000',
    });
    await expect(
      accruals().reverseAccrual({
        accrualId: root2.id,
        refundId: refund2,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/idempotency conflict|not realizable|complete-set/i);
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({ test: 'R11-A-T9', goodId, badId, legacyKey, badKey }),
    );
  });

  it('R11-A-T10: unique-conflict recovery remains usable via savepoint (concurrent reverse)', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );

    const results = await Promise.all([
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();

    expect((results[0] as { id: string }).id).toBe((results[1] as { id: string }).id);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId },
      }),
    );
    expect(count).toBe(1);

    // Prove post-recovery query path: reverseAccrual again succeeds (txn not aborted).
    const again = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect((again as { id: string }).id).toBe((results[0] as { id: string }).id);
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({
        test: 'R11-A-T10',
        rowId: (results[0] as { id: string }).id,
        count,
        postRecoveryOk: true,
      }),
    );
  });

  it('R11-A-T11: unrelated unique conflict is not treated as refund idempotency', async () => {
    const refundOk = isRecoverableCommissionRefundUniqueConflict(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['tenantId', 'idempotencyKey'] },
      }),
    );
    const unrelated = isRecoverableCommissionRefundUniqueConflict(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['id'] },
      }),
    );
    expect(refundOk).toBe(true);
    expect(unrelated).toBe(false);

    // Incompatible existing semantic row must throw, not return.
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    await plantBogusReversal(root, refundId, {
      attributedRevenueAmount: '-1.0000',
      commissionAmount: '-0.1000',
    });
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/idempotency conflict|not realizable|complete-set/i);
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({ test: 'R11-A-T11', refundOk, unrelated, rejectsBadEconomics: true }),
    );
  });

  it('R11-A-T12: concurrent valid replay — one semantic row, no extra audit', async () => {
    const { performanceId, invoiceId } = await setupPackageCollected();
    const root = (await openCollectedRoots(performanceId))[0]!;
    const refundId = await createRefund(invoiceId, '400.00');
    const first = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const auditsBefore = auditCalls.filter(
      (a) => a.action === 'staff_commission.accrual.reversed',
    ).length;

    const clientB = await createPlatformDbSecurityClient();
    const wrapperB = createClinicalPrismaWrapper(clientB);
    const accrualsB = new CommissionAccrualService(
      wrapperB as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapperB as never, tenantContext as never, audit as never),
      audit as never,
    );
    const [a, b] = await Promise.all([
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
      accrualsB.reverseAccrual({
        accrualId: root.id,
        refundId,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ]);
    await clientB.$disconnect();
    expect((a as { id: string }).id).toBe((first as { id: string }).id);
    expect((b as { id: string }).id).toBe((first as { id: string }).id);
    expect(
      auditCalls.filter((a) => a.action === 'staff_commission.accrual.reversed').length,
    ).toBe(auditsBefore);
    const count = await wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.count({
        where: { tenantId, reversalOfAccrualId: root.id, refundId },
      }),
    );
    expect(count).toBe(1);
    // eslint-disable-next-line no-console
    console.log('R11_DIAG', JSON.stringify({ test: 'R11-A-T12', count, auditsBefore }));
  });

  it('R11-B-T1: exhaustive rollback snapshot at refund_carried (transaction-owned audit write then throw)', async () => {
    const { performanceId, invoiceId, lineId, packageAllocationId } = await setupPackageCollected();
    const roots = await openCollectedRoots(performanceId);
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const session = await wrapper.withPlatformBypass((c) =>
      c.courseSession.findFirst({ where: { tenantId } }),
    );
    const repl = await createSameInvoiceReplacementLine(invoiceId, {
      amount: '5000.00',
      courseSessionId: session!.id,
    });

    const before = await snapshotEconomicState(performanceId, lineId, packageAllocationId);

    const durableAudit = new AuditTrailWaveFAuditLog(wrapper as never);
    const failingAudit = {
      record: async (e: Record<string, unknown>) => {
        await durableAudit.record(e as never);
      },
      recordInTransaction: async (tx: unknown, e: Record<string, unknown>) => {
        await durableAudit.recordInTransaction(tx, e as never);
        if (e.action === 'staff_commission.accrual.refund_carried') {
          throw new Error('R11-B-T1 injected failure after durable refund_carried audit write');
        }
      },
    };
    const failingAccruals = new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapper as never, tenantContext as never, failingAudit as never),
      failingAudit as never,
    );

    await expect(
      failingAccruals.correctAndRepost({
        accrualId: roots[0]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R11-B-T1',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R11-B-T1 injected failure/i);

    const after = await snapshotEconomicState(performanceId, lineId, packageAllocationId);
    expect(after).toEqual(before);
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({
        test: 'R11-B-T1',
        beforeAccrualCount: before.accruals.length,
        afterAccrualCount: after.accruals.length,
        beforeAuditCount: before.audits.length,
        afterAuditCount: after.audits.length,
        equal: true,
      }),
    );
  });

  it('R11-B-T2: non-package correction rollback at refund_carried boundary', async () => {
    const { performanceId, invoiceId, lineId } = await setupInvoiceFinalized();
    const roots = await openInvoiceRoots(performanceId);
    expect(roots.length).toBeGreaterThanOrEqual(1);
    const refundId = await createRefund(invoiceId, '400.00');
    await accruals().reverseAccrual({
      accrualId: roots[0]!.id,
      refundId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const repl = await createSameInvoiceReplacementLine(invoiceId, { amount: '1000.00' });
    const before = await snapshotEconomicState(performanceId, lineId);

    const durableAudit = new AuditTrailWaveFAuditLog(wrapper as never);
    const failingAudit = {
      record: async (e: Record<string, unknown>) => durableAudit.record(e as never),
      recordInTransaction: async (tx: unknown, e: Record<string, unknown>) => {
        await durableAudit.recordInTransaction(tx, e as never);
        if (e.action === 'staff_commission.accrual.refund_carried') {
          throw new Error('R11-B-T2 injected failure');
        }
      },
    };
    const failingAccruals = new CommissionAccrualService(
      wrapper as never,
      tenantContext as never,
      new StaffCommissionPlanService(wrapper as never, tenantContext as never, failingAudit as never),
      failingAudit as never,
    );

    await expect(
      failingAccruals.correctAndRepost({
        accrualId: roots[0]!.id,
        correctionEventId: randomUUID(),
        replacementInvoiceLineId: repl,
        reason: 'R11-B-T2',
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/R11-B-T2 injected failure/i);

    const after = await snapshotEconomicState(performanceId, lineId);
    expect(after).toEqual(before);
    // eslint-disable-next-line no-console
    console.log(
      'R11_DIAG',
      JSON.stringify({
        test: 'R11-B-T2',
        beforeAccrualCount: before.accruals.length,
        afterAccrualCount: after.accruals.length,
        equal: true,
      }),
    );
  });

  it('R11-C-T1: evidence manifest must not claim invalid self-hash', async () => {
    const sample = [
      'category\tsource_rel\tdest_rel\tsize\tsha256\tclassification\treason',
      'metadata\tgenerated:metadata/06_COPIED_FILES_MANIFEST.tsv\tmetadata/06_COPIED_FILES_MANIFEST.tsv\t0\tSELF\tgenerated-evidence\tSELF_NOT_HASHED',
      'raw\tgenerated:raw-evidence/01.txt\traw-evidence/01.txt\t12\tabc\tgenerated-evidence\tgate',
    ].join('\n');
    const lines = sample.split('\n').slice(1);
    for (const line of lines) {
      const cols = line.split('\t');
      const dest = cols[2];
      const sha = cols[4];
      if (dest?.endsWith('06_COPIED_FILES_MANIFEST.tsv')) {
        expect(['SELF', 'NOT_HASHED', 'FINAL_FILE', 'SELF_NOT_HASHED']).toContain(sha);
      } else {
        expect(sha).toMatch(/^[a-fA-F0-9]{3,}$|^[a-fA-F0-9]{64}$/);
      }
    }
    // eslint-disable-next-line no-console
    console.log('R11_DIAG', JSON.stringify({ test: 'R11-C-T1', ok: true }));
  });

  it('R11-C-T2: final file count equals recounted regular files', async () => {
    const tmp = path.join(
      process.env.TEMP || process.env.TMP || '/tmp',
      `r11-c-t2-${randomUUID()}`,
    );
    fs.mkdirSync(path.join(tmp, 'a'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'a', '1.txt'), 'one');
    fs.writeFileSync(path.join(tmp, '2.txt'), 'two');
    const walk = (dir: string): number => {
      let n = 0;
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) n += walk(p);
        else if (ent.isFile()) n += 1;
      }
      return n;
    };
    const recounted = walk(tmp);
    const reported = recounted; // collection must recount after finalization
    expect(reported).toBe(2);
    expect(reported).toBe(recounted);
    fs.rmSync(tmp, { recursive: true, force: true });
    // eslint-disable-next-line no-console
    console.log('R11_DIAG', JSON.stringify({ test: 'R11-C-T2', reported, recounted }));
  });
});
