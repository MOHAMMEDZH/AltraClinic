/**
 * Phase 48 Wave F Round 18 — canonical path parity + distinct-special PG (PostgreSQL).
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
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';

jest.setTimeout(300_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

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
  attributedRevenueAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
};

describeDb('Wave F Round 18 remediation (PostgreSQL)', () => {
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

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
  });
  afterAll(async () => {
    await raw?.$disconnect();
  });
  beforeEach(async () => {
    tenantId = randomUUID();
    actorId = randomUUID();
    performerId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();
    auditCalls.length = 0;
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF R18', slug: `wfr18-${tenantId.slice(0, 8)}` },
      });
      for (const u of [
        { id: actorId, first: 'A', last: 'Ctor' },
        { id: performerId, first: 'Perf', last: 'Ormer' },
      ]) {
        await c.user.create({
          data: {
            id: u.id,
            tenantId,
            email: `wfr18-${u.id.slice(0, 8)}@t.local`,
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
        data: { id: branchId, tenantId, name: `R18 B ${branchId.slice(0, 6)}` },
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
  });

  async function enableAndPublishPlan(userId: string, percentage: number) {
    await plans().setUserCommissionEligibility(userId, true, percentage, '2026-01-01', {
      actorId,
      actorRoles: ['owner'],
    });
    const draft = await plans().createDraftPlan({
      userId,
      percentage,
      effectiveFrom: '2026-01-01',
      calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
      earningTrigger: 'INVOICE_OR_CHARGE_FINALIZED',
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

  async function createInvoiceViaProductionPath(servicePerformanceId: string, amount = '10000.00') {
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId,
      patientId,
      invoiceNumber: `R18-${randomUUID().slice(0, 8)}`,
      invoiceDate: new Date('2026-09-01'),
      currency: 'SYP',
      notes: 'R18',
      lineItems: [
        {
          description: 'R18 clinical line',
          quantity: 1,
          unitPrice: Number(amount),
          discountPercent: 0,
          taxPercent: 0,
          servicePerformanceId,
          appointmentId,
          clinicalServiceId,
          courseSessionId: null,
        },
      ] as never,
    });
    invoice.issue();
    await raw.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await new PrismaInvoiceRepository(raw as never).save(invoice);
    return { invoiceId: invoice.invoiceId, lineId: invoice.lineItems[0]!.itemId };
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
          reason: 'R18 refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-02'),
          approvedBy: actorId,
        },
      });
    });
    return refundId;
  }

  async function openRoots(performanceId: string) {
    return wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          status: 'EARNED',
          reversalOfAccrualId: null,
        },
      }),
    ) as Promise<AccrualRootRow[]>;
  }

  async function refundEffects(rootId: string) {
    return wrapper.withPlatformBypass((c) =>
      c.commissionAccrual.findMany({
        where: { tenantId, reversalOfAccrualId: rootId, refundId: { not: null } },
        orderBy: { id: 'asc' },
      }),
    );
  }

  async function plantRefundEffects(
    root: AccrualRootRow,
    effects: Array<{ refundId: string; attributed: string; commission: string }>,
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
            reason: 'R18 planted',
            createdBy: actorId,
          },
        });
      });
    }
  }

  async function setup10000Root() {
    await enableAndPublishPlan(performerId, 0.01);
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, '10000.00');
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId))[0]!;
    expect(new Prisma.Decimal(root.commissionAmount).toFixed(2)).toBe('1.00');
    return { performanceId, invoiceId, root };
  }

  async function setupServiceNet10Pct() {
    await enableAndPublishPlan(performerId, 10);
    const performanceId = await createCompletedPerformance();
    const { invoiceId, lineId } = await createInvoiceViaProductionPath(performanceId, '100.00');
    await accruals().postFromServicePerformance({
      servicePerformanceId: performanceId,
      invoiceLineId: lineId,
      actor: actorId,
      actorRoles: ['owner'],
    });
    const root = (await openRoots(performanceId))[0]!;
    return { performanceId, invoiceId, root };
  }

  it('R18-A-T1 25 distinct specials via production reverseAccrual path', async () => {
    const { invoiceId, root } = await setup10000Root();
    const t0 = Date.now();
    for (let i = 0; i < 100; i++) {
      const rid = await createRefund(invoiceId, '50.00');
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    for (let i = 0; i < 25; i++) {
      const basis = (50 + i * 0.01).toFixed(2);
      const rid = await createRefund(invoiceId, basis);
      await accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rid,
        actor: actorId,
        actorRoles: ['owner'],
      });
    }
    const effects = await refundEffects(root.id);
    expect(effects.length).toBe(125);
    expect(Date.now() - t0).toBeLessThan(120_000);
  });

  it('R18-B-T1 invalid historical 9.99/10 + new refund rejects with zero side effects', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
    const rNew = await createRefund(invoiceId, '1.00');
    await plantRefundEffects(root, [
      { refundId: rA, attributed: '-33.34', commission: '-3.33' },
      { refundId: rB, attributed: '-33.33', commission: '-3.33' },
      { refundId: rC, attributed: '-33.33', commission: '-3.33' },
    ]);
    const beforeCount = (await refundEffects(root.id)).length;
    const beforeAudit = auditCalls.length;
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rNew,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/SATURATED_COMMISSION|not realizable|complete-set/i);
    expect((await refundEffects(root.id)).length).toBe(beforeCount);
    expect(auditCalls.length).toBe(beforeAudit);
  });

  it('R18-B-T2 valid new refund creation validates complete set before return', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rid = await createRefund(invoiceId, '10.00');
    const rev = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rid,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(rev).toBeTruthy();
    expect((await refundEffects(root.id)).length).toBe(1);
    const replay = await accruals().reverseAccrual({
      accrualId: root.id,
      refundId: rid,
      actor: actorId,
      actorRoles: ['owner'],
    });
    expect(replay.id).toBe(rev.id);
    expect((await refundEffects(root.id)).length).toBe(1);
  });

  it('R18-B-T3 replay on planted invalid set still fail-closed (parity with creation)', async () => {
    const { invoiceId, root } = await setupServiceNet10Pct();
    const rA = await createRefund(invoiceId, '33.34');
    const rB = await createRefund(invoiceId, '33.33');
    const rC = await createRefund(invoiceId, '33.33');
    await plantRefundEffects(root, [
      { refundId: rA, attributed: '-33.34', commission: '-3.33' },
      { refundId: rB, attributed: '-33.33', commission: '-3.33' },
      { refundId: rC, attributed: '-33.33', commission: '-3.33' },
    ]);
    await expect(
      accruals().reverseAccrual({
        accrualId: root.id,
        refundId: rB,
        actor: actorId,
        actorRoles: ['owner'],
      }),
    ).rejects.toThrow(/SATURATED_COMMISSION|not realizable|complete-set/i);
  });
});
