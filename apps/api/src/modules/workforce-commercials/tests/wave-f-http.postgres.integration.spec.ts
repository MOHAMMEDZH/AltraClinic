/**
 * Wave F production-path HTTP — real Nest controller + real services + Prisma wrapper.
 * Flow: eligibility → create plan → publish → complete performance → post → reverse → settle → owner-report.
 */
import 'reflect-metadata';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PermissionGuard } from '../../auth/api/guards/permission.guard';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { LicensedModuleGuard } from '../../subscription/api/guards/licensed-module.guard';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { WorkforceCommercialsController } from '../api/workforce-commercials.controller';
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import { InvoiceLinePerformanceAttributionService } from '../services/invoice-line-performance-attribution.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';
import { WAVE_F_AUDIT_LOG } from '../ports/wave-f-audit-log.port';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

@Injectable()
class TestClinicAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtClaimsVO;
    }>();
    const raw = req.headers['x-test-principal'];
    if (!raw) throw new UnauthorizedException('Authentication required.');
    const parsed = JSON.parse(raw) as { sub: string; tenantId: string | null; roles: string[] };
    req.user = {
      sub: parsed.sub,
      userId: parsed.sub,
      tenantId: parsed.tenantId,
      roles: parsed.roles,
      isPlatformSession: () => false,
    } as unknown as JwtClaimsVO;
    return true;
  }
}

describeDb('Wave F production-path HTTP (real services, PostgreSQL)', () => {
  let prisma: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let app: INestApplication;
  let baseUrl: string;
  let tenantId: string;
  let ownerId: string;
  let performerId: string;
  let patientId: string;
  let branchId: string;
  let clinicalServiceId: string;
  let appointmentId: string;
  const auditCalls: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    prisma = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(prisma);
    tenantId = randomUUID();
    ownerId = randomUUID();
    performerId = randomUUID();
    patientId = randomUUID();
    branchId = randomUUID();
    clinicalServiceId = randomUUID();
    appointmentId = randomUUID();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WF HTTP', slug: `wf-http-${tenantId.slice(0, 8)}` },
      });
      await c.user.create({
        data: {
          id: ownerId,
          tenantId,
          email: `wf-http-own-${ownerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'Own',
          lastName: 'Er',
          roles: { create: [{ role: 'OWNER' }] },
        },
      });
      await c.user.create({
        data: {
          id: performerId,
          tenantId,
          email: `wf-http-perf-${performerId.slice(0, 8)}@t.local`,
          passwordHash: 'x',
          firstName: 'Perf',
          lastName: 'Ormer',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Pat', lastName: 'Http' },
      });
      await c.branch.create({
        data: { id: branchId, tenantId, name: 'WF HTTP Branch' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.http-${clinicalServiceId.slice(0, 8)}`,
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
          providerId: ownerId,
          scheduledStart: new Date('2026-09-10T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-10T11:00:00.000Z'),
          status: 'CONFIRMED',
          clinicalServiceId,
        },
      });
    });

    const fakeAudit = {
      record: async (e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        auditCalls.push({ ...e, via: 'recordInTransaction' });
      },
    };

    const prismaForNest = {
      ...wrapper,
      userCustomRole: { findMany: async () => [] },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WorkforceCommercialsController],
      providers: [
        PermissionGuard,
        { provide: APP_GUARD, useClass: TestClinicAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: PrismaService, useValue: prismaForNest },
        {
          provide: TenantContextService,
          useFactory: () => ({
            resolve: async () => {
              const store = (globalThis as { __wfTenant?: string }).__wfTenant;
              if (!store) throw new UnauthorizedException('Tenant context missing.');
              return { tenantId: store, branchId: null, locale: 'en' };
            },
          }),
        },
        { provide: WAVE_F_AUDIT_LOG, useValue: fakeAudit },
        StaffCommissionPlanService,
        CommissionAccrualService,
        InvoiceLinePerformanceAttributionService,
        CommissionPackageAllocationService,
      ],
    })
      .overrideGuard(LicensedModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  function headers(roles: string[] = ['owner'], opts?: { sub?: string; tenant?: string }) {
    const tid = opts?.tenant ?? tenantId;
    (globalThis as { __wfTenant?: string }).__wfTenant = tid;
    return {
      'content-type': 'application/json',
      'x-test-principal': JSON.stringify({
        sub: opts?.sub ?? ownerId,
        tenantId: tid,
        roles,
      }),
    };
  }

  it('eligibility → plan → publish → performance → post → reverse → settle → owner-report', async () => {
    const elig = await fetch(
      `${baseUrl}/workforce-commercials/users/${performerId}/commission-eligibility`,
      {
        method: 'PATCH',
        headers: headers(['owner']),
        body: JSON.stringify({
          enabled: true,
          defaultPercent: 30,
          effectiveFrom: '2026-01-01',
        }),
      },
    );
    expect([200, 201]).toContain(elig.status);
    const eligBody = (await elig.json()) as { commissionEnabled: boolean };
    expect(eligBody.commissionEnabled).toBe(true);

    const createPlan = await fetch(`${baseUrl}/workforce-commercials/plans`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({
        userId: performerId,
        percentage: 30,
        calculationBasis: 'SERVICE_NET_AFTER_DISCOUNT',
        effectiveFrom: '2026-01-01',
      }),
    });
    expect([200, 201]).toContain(createPlan.status);
    const plan = (await createPlan.json()) as { id: string; status: string };
    expect(plan.status).toBe('DRAFT');

    const publish = await fetch(`${baseUrl}/workforce-commercials/plans/${plan.id}/publish`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(publish.status);
    const published = (await publish.json()) as { status: string };
    expect(published.status).toBe('ACTIVE');

    const performanceId = randomUUID();
    const invoiceId = randomUUID();
    const lineId = randomUUID();
    const performedAt = new Date('2026-09-10T10:30:00.000Z');
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId,
          appointmentId,
          patientId,
          clinicalServiceId,
          performedAt,
          status: 'DRAFT',
          createdBy: ownerId,
          participants: {
            create: {
              id: randomUUID(),
              tenantId,
              userId: performerId,
              role: 'PRIMARY',
              attributionShare: null,
              recordedBy: ownerId,
            },
          },
        },
      });
      await c.servicePerformance.update({
        where: { id: performanceId },
        data: { status: 'COMPLETED', completedAt: performedAt, completedBy: ownerId },
      });
      await c.invoice.create({
        data: {
          id: invoiceId,
          tenantId,
          branchId,
          patientId,
          invoiceNumber: `WFH-${invoiceId.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-10'),
          currency: 'SYP',
          status: 'ISSUED',
          amountSubtotal: '1000.00',
          amountDiscount: '0.00',
          amountTax: '0.00',
          amountTotal: '1000.00',
          lineItems: {
            create: {
              id: lineId,
              tenantId,
              description: 'HTTP path service',
              quantity: 1,
              unitPrice: '1000.00',
              subtotal: '1000.00',
              discountAmount: '0.00',
              taxAmount: '0.00',
              lineTotal: '1000.00',
              serviceCode: `http-${clinicalServiceId.slice(0, 8)}`,
              servicePerformanceId: performanceId,
            },
          },
        },
      });
    });

    const post = await fetch(`${baseUrl}/workforce-commercials/accruals/post`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        reason: 'http path post',
      }),
    });
    expect([200, 201]).toContain(post.status);
    const posted = (await post.json()) as {
      accruals: Array<{ id: string; status: string; commissionAmount: string }>;
    };
    expect(posted.accruals).toHaveLength(1);
    expect(posted.accruals[0]!.status).toBe('EARNED');
    const earnId = posted.accruals[0]!.id;
    expect(new Prisma.Decimal(posted.accruals[0]!.commissionAmount).toFixed(2)).toBe('300.00');

    const refundId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceRefund.create({
        data: {
          id: refundId,
          tenantId,
          invoiceId,
          amount: '1000.00',
          reason: 'http reverse refund',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-10'),
          approvedBy: ownerId,
        },
      });
    });

    const reverse = await fetch(`${baseUrl}/workforce-commercials/accruals/${earnId}/reverse`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({ refundId, reason: 'http reverse' }),
    });
    expect([200, 201]).toContain(reverse.status);
    const reversed = (await reverse.json()) as { status: string; reversalOfAccrualId: string };
    expect(reversed.status).toBe('REVERSED');
    expect(reversed.reversalOfAccrualId).toBe(earnId);

    // Separate earn for settle (cannot settle REVERSED / need EARNED row)
    const performance2 = randomUUID();
    const line2 = randomUUID();
    const invoice2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performance2,
          tenantId,
          branchId,
          patientId,
          clinicalServiceId,
          performedAt: new Date('2026-09-11T10:00:00.000Z'),
          status: 'DRAFT',
          createdBy: ownerId,
          participants: {
            create: {
              id: randomUUID(),
              tenantId,
              userId: performerId,
              role: 'PRIMARY',
              recordedBy: ownerId,
            },
          },
        },
      });
      await c.servicePerformance.update({
        where: { id: performance2 },
        data: {
          status: 'COMPLETED',
          completedAt: new Date('2026-09-11T10:00:00.000Z'),
          completedBy: ownerId,
        },
      });
      await c.invoice.create({
        data: {
          id: invoice2,
          tenantId,
          branchId,
          patientId,
          invoiceNumber: `WFH2-${invoice2.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-11'),
          currency: 'SYP',
          status: 'ISSUED',
          amountSubtotal: '200.00',
          amountDiscount: '0.00',
          amountTax: '0.00',
          amountTotal: '200.00',
          lineItems: {
            create: {
              id: line2,
              tenantId,
              description: 'settle path',
              quantity: 1,
              unitPrice: '200.00',
              subtotal: '200.00',
              discountAmount: '0.00',
              taxAmount: '0.00',
              lineTotal: '200.00',
              serviceCode: `http-${clinicalServiceId.slice(0, 8)}`,
              servicePerformanceId: performance2,
            },
          },
        },
      });
    });

    const post2 = await fetch(`${baseUrl}/workforce-commercials/accruals/post`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({ servicePerformanceId: performance2, invoiceLineId: line2 }),
    });
    expect([200, 201]).toContain(post2.status);
    const posted2 = (await post2.json()) as { accruals: Array<{ id: string }> };
    const settleId = posted2.accruals[0]!.id;

    const settle = await fetch(`${baseUrl}/workforce-commercials/accruals/${settleId}/settle`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({ settlementReference: 'HTTP-SETTLE-1' }),
    });
    expect([200, 201]).toContain(settle.status);
    const settled = (await settle.json()) as { status: string; settlementReference: string };
    expect(settled.status).toBe('SETTLED');
    expect(settled.settlementReference).toBe('HTTP-SETTLE-1');

    const report = await fetch(
      `${baseUrl}/workforce-commercials/owner-report?userId=${performerId}&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z`,
      { method: 'GET', headers: headers(['owner']) },
    );
    expect(report.status).toBe(200);
    const body = (await report.json()) as {
      byCurrency: Array<{
        currency: string;
        earned: string;
        settled: string;
        outstanding: string;
        reversed: string;
        net: string;
      }>;
      rowCount: number;
    };
    expect(body.rowCount).toBeGreaterThanOrEqual(3);
    const syp = body.byCurrency.find((c) => c.currency === 'SYP');
    expect(syp).toBeTruthy();
    expect(new Prisma.Decimal(syp!.settled).toFixed(2)).toBe('60.00');
    expect(auditCalls.some((c) => c.action === 'staff_commission.eligibility.enabled')).toBe(true);
    expect(auditCalls.some((c) => c.action === 'staff_commission.plan.published')).toBe(true);
    expect(auditCalls.some((c) => c.action === 'staff_commission.accrual.created')).toBe(true);
    expect(auditCalls.some((c) => c.action === 'staff_commission.accrual.reversed')).toBe(true);
    expect(auditCalls.some((c) => c.action === 'staff_commission.accrual.settled')).toBe(true);
  });

  it('HTTP collected payment + mismatch reject + multi reverse + multi-currency report', async () => {
    (globalThis as { __wfTenant?: string }).__wfTenant = tenantId;

    // COLLECTED_REVENUE plan
    await fetch(`${baseUrl}/workforce-commercials/users/${performerId}/commission-eligibility`, {
      method: 'PATCH',
      headers: headers(['owner']),
      body: JSON.stringify({ enabled: true, defaultPercent: 25, effectiveFrom: '2026-02-01' }),
    });
    const draft = await fetch(`${baseUrl}/workforce-commercials/plans`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({
        userId: performerId,
        percentage: 25,
        effectiveFrom: '2026-02-01',
        calculationBasis: 'COLLECTED_REVENUE',
        earningTrigger: 'PAYMENT_COLLECTED',
      }),
    });
    expect([200, 201]).toContain(draft.status);
    const draftBody = (await draft.json()) as { id: string };
    const pub = await fetch(`${baseUrl}/workforce-commercials/plans/${draftBody.id}/publish`, {
      method: 'POST',
      headers: headers(['owner']),
      body: '{}',
    });
    expect([200, 201]).toContain(pub.status);

    const performanceId = randomUUID();
    const invoiceId = randomUUID();
    const lineId = randomUUID();
    const paymentId = randomUUID();
    const code = `http-${clinicalServiceId.slice(0, 8)}`;
    await wrapper.withPlatformBypass(async (c) => {
      await c.servicePerformance.create({
        data: {
          id: performanceId,
          tenantId,
          branchId,
          patientId,
          clinicalServiceId,
          performedAt: new Date('2026-09-12T10:00:00.000Z'),
          status: 'DRAFT',
          createdBy: ownerId,
          participants: {
            create: {
              id: randomUUID(),
              tenantId,
              userId: performerId,
              role: 'PRIMARY',
              recordedBy: ownerId,
            },
          },
        },
      });
      await c.servicePerformance.update({
        where: { id: performanceId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date('2026-09-12T10:00:00.000Z'),
          completedBy: ownerId,
        },
      });
      await c.invoice.create({
        data: {
          id: invoiceId,
          tenantId,
          branchId,
          patientId,
          invoiceNumber: `WFHC-${invoiceId.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-12'),
          currency: 'USD',
          status: 'ISSUED',
          amountSubtotal: '400.00',
          amountDiscount: '0.00',
          amountTax: '0.00',
          amountTotal: '400.00',
          lineItems: {
            create: {
              id: lineId,
              tenantId,
              description: 'collected',
              quantity: 1,
              unitPrice: '400.00',
              subtotal: '400.00',
              discountAmount: '0.00',
              taxAmount: '0.00',
              lineTotal: '400.00',
              serviceCode: code,
              servicePerformanceId: performanceId,
            },
          },
        },
      });
      await c.invoicePayment.create({
        data: {
          id: paymentId,
          tenantId,
          invoiceId,
          amount: '400.00',
          paymentMethod: 'card',
          paymentDate: new Date('2026-09-12'),
          recordedBy: ownerId,
        },
      });
    });

    const collected = await fetch(`${baseUrl}/workforce-commercials/accruals/post-collected`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({
        servicePerformanceId: performanceId,
        invoiceLineId: lineId,
        paymentId,
      }),
    });
    expect([200, 201]).toContain(collected.status);
    const collectedBody = (await collected.json()) as {
      accruals: Array<{ id: string; commissionAmount: string }>;
    };
    expect(collectedBody.accruals).toHaveLength(1);
    expect(new Prisma.Decimal(collectedBody.accruals[0]!.commissionAmount).toFixed(2)).toBe('100.00');

    // mismatch reject
    const badPatient = randomUUID();
    const badInvoice = randomUUID();
    const badLine = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.patient.create({
        data: { id: badPatient, tenantId, firstName: 'Bad', lastName: 'Pat' },
      });
      await c.invoice.create({
        data: {
          id: badInvoice,
          tenantId,
          branchId,
          patientId: badPatient,
          invoiceNumber: `BAD-${badInvoice.slice(0, 8)}`,
          invoiceDate: new Date('2026-09-12'),
          currency: 'USD',
          status: 'ISSUED',
          amountSubtotal: '10.00',
          amountDiscount: '0.00',
          amountTax: '0.00',
          amountTotal: '10.00',
          lineItems: {
            create: {
              id: badLine,
              tenantId,
              description: 'mismatch',
              quantity: 1,
              unitPrice: '10.00',
              subtotal: '10.00',
              discountAmount: '0.00',
              taxAmount: '0.00',
              lineTotal: '10.00',
              serviceCode: code,
              servicePerformanceId: null,
            },
          },
        },
      });
    });
    const mismatch = await fetch(`${baseUrl}/workforce-commercials/accruals/post-collected`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({
        servicePerformanceId: performanceId,
        invoiceLineId: badLine,
        paymentId,
      }),
    });
    expect(mismatch.status).toBeGreaterThanOrEqual(400);

    // multi reverse
    const earnId = collectedBody.accruals[0]!.id;
    const refund1 = randomUUID();
    const refund2 = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.invoiceRefund.create({
        data: {
          id: refund1,
          tenantId,
          invoiceId,
          amount: '100.00',
          reason: 'partial1',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-13'),
          approvedBy: ownerId,
        },
      });
      await c.invoiceRefund.create({
        data: {
          id: refund2,
          tenantId,
          invoiceId,
          amount: '100.00',
          reason: 'partial2',
          refundMethod: 'cash',
          refundDate: new Date('2026-09-13'),
          approvedBy: ownerId,
        },
      });
    });
    const rev1 = await fetch(`${baseUrl}/workforce-commercials/accruals/${earnId}/reverse`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({ refundId: refund1 }),
    });
    expect([200, 201]).toContain(rev1.status);
    const rev2 = await fetch(`${baseUrl}/workforce-commercials/accruals/${earnId}/reverse`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({ refundId: refund2 }),
    });
    expect([200, 201]).toContain(rev2.status);

    const report = await fetch(
      `${baseUrl}/workforce-commercials/owner-report?userId=${performerId}&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z`,
      { method: 'GET', headers: headers(['owner']) },
    );
    expect(report.status).toBe(200);
    const body = (await report.json()) as {
      byCurrency: Array<{ currency: string; reversed: string }>;
    };
    expect(body.byCurrency.some((c) => c.currency === 'USD')).toBe(true);
    expect(body.byCurrency.every((c) => typeof c.reversed === 'string')).toBe(true);
  });
});
