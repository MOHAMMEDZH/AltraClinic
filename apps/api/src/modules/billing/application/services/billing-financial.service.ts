import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { INVOICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { Inject } from '@nestjs/common';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';

@Injectable()
export class BillingFinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepo: InvoiceRepository,
  ) {}

  private async tenantId(): Promise<string> {
    const ctx = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!ctx?.tenantId) throw new BadRequestException('tenant context could not be resolved');
    return ctx.tenantId;
  }

  async nextInvoiceNumber(prefix = 'INV'): Promise<string> {
    const tenantId = await this.tenantId();
    const seq = await this.prisma.tenantBillingSequence.upsert({
      where: { tenantId_prefix: { tenantId, prefix } },
      create: { id: randomUUID(), tenantId, prefix, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `${prefix}-${String(seq.lastNumber).padStart(6, '0')}`;
  }

  async nextReceiptNumber(): Promise<string> {
    const tenantId = await this.tenantId();
    const prefix = 'RCP';
    const seq = await this.prisma.tenantBillingSequence.upsert({
      where: { tenantId_prefix: { tenantId, prefix } },
      create: { id: randomUUID(), tenantId, prefix, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `${prefix}-${String(seq.lastNumber).padStart(6, '0')}`;
  }

  async nextCreditNoteNumber(): Promise<string> {
    const tenantId = await this.tenantId();
    const prefix = 'CN';
    const seq = await this.prisma.tenantBillingSequence.upsert({
      where: { tenantId_prefix: { tenantId, prefix } },
      create: { id: randomUUID(), tenantId, prefix, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `${prefix}-${String(seq.lastNumber).padStart(6, '0')}`;
  }

  async createPaymentReceipt(input: {
    invoiceId: string;
    amount: number;
    currency: string;
    paymentId?: string | null;
    issuedBy: string;
  }): Promise<string> {
    const tenantId = await this.tenantId();
    const receiptNumber = await this.nextReceiptNumber();
    await this.prisma.paymentReceipt.create({
      data: {
        id: randomUUID(),
        tenantId,
        invoiceId: input.invoiceId,
        paymentId: input.paymentId ?? null,
        receiptNumber,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        issuedBy: input.issuedBy,
      },
    });
    return receiptNumber;
  }

  async applyInsuranceAllocation(input: {
    invoiceId: string;
    insuranceProvider: string;
    insurancePolicyNumber?: string | null;
    insuranceAmount: number;
    patientResponsibility: number;
    insuranceClaimStatus?: string | null;
  }) {
    const tenantId = await this.tenantId();
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: input.invoiceId, tenantId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (input.insuranceAmount < 0 || input.patientResponsibility < 0) {
      throw new BadRequestException('Insurance amounts must be non-negative');
    }
    const total = invoice.amountTotal.toNumber();
    if (input.insuranceAmount + input.patientResponsibility > total + 0.01) {
      throw new BadRequestException('Insurance + patient responsibility exceeds invoice total');
    }
    await this.prisma.invoice.update({
      where: { id: input.invoiceId },
      data: {
        insuranceProvider: input.insuranceProvider.trim(),
        insurancePolicyNumber: input.insurancePolicyNumber?.trim() || null,
        insuranceAmount: new Prisma.Decimal(input.insuranceAmount),
        patientResponsibility: new Prisma.Decimal(input.patientResponsibility),
        insuranceClaimStatus: input.insuranceClaimStatus?.trim() || 'pending',
        updatedAt: new Date(),
      },
    });
    return { invoiceId: input.invoiceId, insuranceClaimStatus: input.insuranceClaimStatus ?? 'pending' };
  }

  async listInvoiceReceipts(invoiceId: string) {
    const tenantId = await this.tenantId();
    const rows = await this.prisma.paymentReceipt.findMany({
      where: { tenantId, invoiceId },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map((r) => ({
      receiptNumber: r.receiptNumber,
      amount: r.amount.toNumber(),
      currency: r.currency,
      issuedAt: r.issuedAt.toISOString(),
      paymentId: r.paymentId,
    }));
  }

  async listInvoicesPaginated(params: {
    branchId?: string | null;
    patientId?: string | null;
    status?: string | null;
    search?: string | null;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = await this.tenantId();
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const statusMap: Record<string, string> = {
      draft: 'DRAFT',
      issued: 'ISSUED',
      partial_paid: 'PARTIAL_PAID',
      paid: 'PAID',
      overdue: 'OVERDUE',
      cancelled: 'CANCELLED',
      written_off: 'WRITTEN_OFF',
    };

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      deletedAt: null,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.patientId ? { patientId: params.patientId } : {}),
      ...(params.status && params.status !== 'all' ? { status: statusMap[params.status] as never } : {}),
      ...(params.search?.trim()
        ? {
            invoiceNumber: { contains: params.search.trim(), mode: 'insensitive' },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.mapInvoiceRow(row)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private mapInvoiceRow(row: Prisma.InvoiceGetPayload<{ include: { lineItems: true } }>) {
    const total = row.amountTotal.toNumber();
    const paid = row.amountPaid.toNumber();
    return {
      invoiceId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      patientId: row.patientId,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate.toISOString(),
      dueDate: row.dueDate?.toISOString() ?? null,
      currency: row.currency,
      status: row.status.toLowerCase(),
      amountSubtotal: row.amountSubtotal.toNumber(),
      amountDiscount: row.amountDiscount.toNumber(),
      amountTax: row.amountTax.toNumber(),
      amountTotal: total,
      amountPaid: paid,
      amountDue: Math.max(0, total - paid),
      insuranceProvider: row.insuranceProvider,
      insurancePolicyNumber: row.insurancePolicyNumber,
      insuranceAmount: row.insuranceAmount.toNumber(),
      patientResponsibility: row.patientResponsibility.toNumber(),
      insuranceClaimStatus: row.insuranceClaimStatus,
      notes: row.notes,
      lineItems: row.lineItems.map((li) => ({
        itemId: li.id,
        description: li.description,
        quantity: li.quantity.toNumber(),
        unitPrice: li.unitPrice.toNumber(),
        lineTotal: li.lineTotal.toNumber(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async recordRefund(input: {
    invoiceId: string;
    paymentId?: string | null;
    amount: number;
    reason: string;
    refundMethod: string;
    refundReference?: string | null;
    refundDate?: string | null;
    approvedBy: string;
    notes?: string | null;
  }) {
    const tenantId = await this.tenantId();
    if (input.amount <= 0) throw new BadRequestException('Refund amount must be positive');

    const invoice = await this.invoiceRepo.findById(input.invoiceId, tenantId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.amountPaid <= 0) throw new BadRequestException('No payments to refund');

    const maxRefund = invoice.amountPaid;
    if (input.amount > maxRefund) throw new BadRequestException('Refund exceeds paid amount');

    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceRefund.create({
        data: {
          id: randomUUID(),
          tenantId,
          invoiceId: input.invoiceId,
          paymentId: input.paymentId ?? null,
          amount: new Prisma.Decimal(input.amount),
          reason: input.reason,
          refundMethod: input.refundMethod,
          refundReference: input.refundReference ?? null,
          refundDate: input.refundDate ? new Date(input.refundDate) : new Date(),
          approvedBy: input.approvedBy,
          notes: input.notes ?? null,
        },
      });

      const newPaid = Math.max(0, invoice.amountPaid - input.amount);
      let newStatus = invoice.status.status;
      if (newPaid <= 0) newStatus = 'issued';
      else if (newPaid < invoice.amountTotal) newStatus = 'partial_paid';
      else newStatus = 'paid';

      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountPaid: new Prisma.Decimal(newPaid),
          status: newStatus.toUpperCase() as never,
          updatedAt: new Date(),
        },
      });
    });

    return { invoiceId: input.invoiceId, refundedAmount: input.amount };
  }

  async createCreditNote(input: {
    invoiceId: string;
    amount: number;
    reason: string;
    issuedBy: string;
    notes?: string | null;
    issue?: boolean;
  }) {
    const tenantId = await this.tenantId();
    if (input.amount <= 0) throw new BadRequestException('Credit note amount must be positive');

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: input.invoiceId, tenantId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const creditNoteNumber = await this.nextCreditNoteNumber();
    const cn = await this.prisma.creditNote.create({
      data: {
        id: randomUUID(),
        tenantId,
        invoiceId: input.invoiceId,
        creditNoteNumber,
        amount: new Prisma.Decimal(input.amount),
        reason: input.reason,
        notes: input.notes ?? null,
        status: input.issue ? 'ISSUED' : 'DRAFT',
        issuedAt: input.issue ? new Date() : null,
        issuedBy: input.issue ? input.issuedBy : null,
      },
    });

    if (input.issue) {
      const newTotal = Math.max(0, invoice.amountTotal.toNumber() - input.amount);
      const newPaid = Math.min(invoice.amountPaid.toNumber(), newTotal);
      await this.prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountTotal: new Prisma.Decimal(newTotal),
          amountPaid: new Prisma.Decimal(newPaid),
          status: newTotal <= newPaid ? 'PAID' : newPaid > 0 ? 'PARTIAL_PAID' : 'ISSUED',
          updatedAt: new Date(),
        },
      });
      await this.prisma.creditNote.update({
        where: { id: cn.id },
        data: { status: 'APPLIED', appliedAt: new Date() },
      });
    }

    return {
      creditNoteId: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      status: input.issue ? 'applied' : 'issued',
      amount: input.amount,
    };
  }

  async writeOffInvoice(input: {
    invoiceId: string;
    amount: number;
    reason: string;
    approvedBy: string;
    writeOffDate?: string | null;
    notes?: string | null;
  }) {
    const tenantId = await this.tenantId();
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: input.invoiceId, tenantId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const due = Math.max(0, invoice.amountTotal.toNumber() - invoice.amountPaid.toNumber());
    if (input.amount <= 0 || input.amount > due) {
      throw new BadRequestException('Write-off amount must be positive and not exceed amount due');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceWriteOff.create({
        data: {
          id: randomUUID(),
          tenantId,
          invoiceId: input.invoiceId,
          amount: new Prisma.Decimal(input.amount),
          reason: input.reason,
          approvedBy: input.approvedBy,
          writeOffDate: input.writeOffDate ? new Date(input.writeOffDate) : new Date(),
          notes: input.notes ?? null,
        },
      });

      const newTotal = invoice.amountTotal.toNumber() - input.amount;
      const paid = invoice.amountPaid.toNumber();
      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountTotal: new Prisma.Decimal(Math.max(0, newTotal)),
          status: newTotal <= paid ? 'PAID' : paid > 0 ? 'PARTIAL_PAID' : input.amount >= due ? 'WRITTEN_OFF' : 'OVERDUE',
          updatedAt: new Date(),
        },
      });
    });

    return { invoiceId: input.invoiceId, writeOffAmount: input.amount };
  }

  async openCashSession(input: { branchId?: string | null; openingBalance: number; openedBy: string; notes?: string | null }) {
    const tenantId = await this.tenantId();
    const existing = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: 'OPEN', ...(input.branchId ? { branchId: input.branchId } : {}) },
    });
    if (existing) throw new BadRequestException('An open cash session already exists');

    const session = await this.prisma.cashSession.create({
      data: {
        id: randomUUID(),
        tenantId,
        branchId: input.branchId ?? null,
        openedBy: input.openedBy,
        openingBalance: new Prisma.Decimal(input.openingBalance),
        expectedCash: new Prisma.Decimal(input.openingBalance),
        notes: input.notes ?? null,
      },
    });

    return this.mapCashSession(session);
  }

  async closeCashSession(input: {
    sessionId: string;
    actualCash: number;
    closedBy: string;
    notes?: string | null;
  }) {
    const tenantId = await this.tenantId();
    const session = await this.prisma.cashSession.findFirst({
      where: { id: input.sessionId, tenantId, status: 'OPEN' },
    });
    if (!session) throw new NotFoundException('Open cash session not found');

    const cashPayments = await this.prisma.invoicePayment.aggregate({
      where: {
        tenantId,
        paymentMethod: 'cash',
        paymentDate: { gte: session.openedAt },
      },
      _sum: { amount: true },
    });

    const expected = session.openingBalance.toNumber() + Number(cashPayments._sum.amount ?? 0);
    const variance = input.actualCash - expected;

    const updated = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedBy: input.closedBy,
        actualCash: new Prisma.Decimal(input.actualCash),
        expectedCash: new Prisma.Decimal(expected),
        variance: new Prisma.Decimal(variance),
        closedAt: new Date(),
        notes: input.notes ?? session.notes,
      },
    });

    return this.mapCashSession(updated);
  }

  async getActiveCashSession(branchId?: string | null) {
    const tenantId = await this.tenantId();
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: 'OPEN', ...(branchId ? { branchId } : {}) },
      orderBy: { openedAt: 'desc' },
    });
    return session ? this.mapCashSession(session) : null;
  }

  async listCashSessions(limit = 20) {
    const tenantId = await this.tenantId();
    const rows = await this.prisma.cashSession.findMany({
      where: { tenantId },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
    return rows.map((s) => this.mapCashSession(s));
  }

  private mapCashSession(session: {
    id: string;
    branchId: string | null;
    openedBy: string;
    closedBy: string | null;
    status: string;
    openingBalance: Prisma.Decimal;
    expectedCash: Prisma.Decimal;
    actualCash: Prisma.Decimal | null;
    variance: Prisma.Decimal | null;
    openedAt: Date;
    closedAt: Date | null;
    notes: string | null;
  }) {
    return {
      sessionId: session.id,
      branchId: session.branchId,
      openedBy: session.openedBy,
      closedBy: session.closedBy,
      status: session.status.toLowerCase(),
      openingBalance: session.openingBalance.toNumber(),
      expectedCash: session.expectedCash.toNumber(),
      actualCash: session.actualCash?.toNumber() ?? null,
      variance: session.variance?.toNumber() ?? null,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
      notes: session.notes,
    };
  }

  async createPaymentPlan(input: {
    invoiceId: string;
    patientId: string;
    installmentCount: number;
    startDate: string;
    notes?: string | null;
  }) {
    const tenantId = await this.tenantId();
    if (input.installmentCount < 2 || input.installmentCount > 24) {
      throw new BadRequestException('Installment count must be between 2 and 24');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: input.invoiceId, tenantId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const due = Math.max(0, invoice.amountTotal.toNumber() - invoice.amountPaid.toNumber());
    if (due <= 0) throw new BadRequestException('Invoice has no remaining balance');

    const installmentAmount = due / input.installmentCount;
    const planId = randomUUID();
    const start = new Date(input.startDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentPlan.create({
        data: {
          id: planId,
          tenantId,
          invoiceId: input.invoiceId,
          patientId: input.patientId,
          totalAmount: new Prisma.Decimal(due),
          installmentCount: input.installmentCount,
          currency: invoice.currency,
          startDate: start,
          notes: input.notes ?? null,
        },
      });

      for (let i = 0; i < input.installmentCount; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i);
        const amount = i === input.installmentCount - 1
          ? due - installmentAmount * (input.installmentCount - 1)
          : installmentAmount;
        await tx.paymentPlanInstallment.create({
          data: {
            id: randomUUID(),
            tenantId,
            planId,
            sequence: i + 1,
            dueDate,
            amount: new Prisma.Decimal(amount),
          },
        });
      }
    });

    return { planId, installmentCount: input.installmentCount, totalAmount: due };
  }

  async listPaymentPlans(invoiceId?: string) {
    const tenantId = await this.tenantId();
    const rows = await this.prisma.paymentPlan.findMany({
      where: { tenantId, ...(invoiceId ? { invoiceId } : {}) },
      include: { installments: { orderBy: { sequence: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      planId: p.id,
      invoiceId: p.invoiceId,
      patientId: p.patientId,
      status: p.status.toLowerCase(),
      totalAmount: p.totalAmount.toNumber(),
      installmentCount: p.installmentCount,
      currency: p.currency,
      startDate: p.startDate.toISOString(),
      installments: p.installments.map((i) => ({
        installmentId: i.id,
        sequence: i.sequence,
        dueDate: i.dueDate.toISOString(),
        amount: i.amount.toNumber(),
        paidAmount: i.paidAmount.toNumber(),
        paidAt: i.paidAt?.toISOString() ?? null,
      })),
    }));
  }

  async listServicePrices(activeOnly = true) {
    const tenantId = await this.tenantId();
    const rows = await this.prisma.servicePrice.findMany({
      where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { serviceCode: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      serviceCode: r.serviceCode,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      unitPrice: r.unitPrice.toNumber(),
      currency: r.currency,
      taxPercent: r.taxPercent.toNumber(),
      isActive: r.isActive,
    }));
  }

  async upsertServicePrice(input: {
    serviceCode: string;
    nameEn: string;
    nameAr?: string | null;
    unitPrice: number;
    currency?: string;
    taxPercent?: number;
    isActive?: boolean;
  }) {
    const tenantId = await this.tenantId();
    const row = await this.prisma.servicePrice.upsert({
      where: { tenantId_serviceCode: { tenantId, serviceCode: input.serviceCode } },
      create: {
        id: randomUUID(),
        tenantId,
        serviceCode: input.serviceCode,
        nameEn: input.nameEn,
        nameAr: input.nameAr ?? null,
        unitPrice: new Prisma.Decimal(input.unitPrice),
        currency: input.currency ?? 'SYP',
        taxPercent: new Prisma.Decimal(input.taxPercent ?? 0),
        isActive: input.isActive ?? true,
      },
      update: {
        nameEn: input.nameEn,
        nameAr: input.nameAr ?? null,
        unitPrice: new Prisma.Decimal(input.unitPrice),
        currency: input.currency ?? 'SYP',
        taxPercent: new Prisma.Decimal(input.taxPercent ?? 0),
        isActive: input.isActive ?? true,
      },
    });
    return {
      id: row.id,
      serviceCode: row.serviceCode,
      nameEn: row.nameEn,
      unitPrice: row.unitPrice.toNumber(),
    };
  }

  async recordSplitPayments(input: {
    invoiceId: string;
    payments: Array<{ amount: number; paymentMethod: string; paymentReference?: string | null }>;
    recordedBy: string;
    paymentDate?: string | null;
  }) {
    const tenantId = await this.tenantId();
    const invoice = await this.invoiceRepo.findById(input.invoiceId, tenantId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const total = input.payments.reduce((s, p) => s + p.amount, 0);
    if (total <= 0) throw new BadRequestException('Total payment must be positive');

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    let firstPaymentId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      for (const p of input.payments) {
        const paymentId = randomUUID();
        if (!firstPaymentId) firstPaymentId = paymentId;
        await tx.invoicePayment.create({
          data: {
            id: paymentId,
            invoiceId: input.invoiceId,
            tenantId,
            amount: new Prisma.Decimal(p.amount),
            paymentMethod: p.paymentMethod,
            paymentReference: p.paymentReference ?? null,
            paymentDate,
            recordedBy: input.recordedBy,
          },
        });
        invoice.recordPayment({
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentReference: p.paymentReference ?? null,
          paymentDate,
        });
      }

      await this.invoiceRepo.save(invoice);
    });

    const receiptNumber = await this.createPaymentReceipt({
      invoiceId: input.invoiceId,
      amount: total,
      currency: invoice.currency,
      paymentId: firstPaymentId,
      issuedBy: input.recordedBy,
    });

    return {
      invoiceId: input.invoiceId,
      receiptNumber,
      totalPaid: total,
      status: invoice.status.status,
      amountDue: invoice.amountDue,
    };
  }

  async getReceipt(receiptNumber: string) {
    const tenantId = await this.tenantId();
    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: { tenantId, receiptNumber },
      include: { invoice: { include: { lineItems: true } } },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return {
      receiptNumber: receipt.receiptNumber,
      amount: receipt.amount.toNumber(),
      currency: receipt.currency,
      issuedAt: receipt.issuedAt.toISOString(),
      invoice: this.mapInvoiceRow(receipt.invoice),
    };
  }

  async listRefunds(invoiceId?: string) {
    const tenantId = await this.tenantId();
    const rows = await this.prisma.invoiceRefund.findMany({
      where: { tenantId, ...(invoiceId ? { invoiceId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      refundId: r.id,
      invoiceId: r.invoiceId,
      paymentId: r.paymentId,
      amount: r.amount.toNumber(),
      reason: r.reason,
      refundMethod: r.refundMethod,
      refundDate: r.refundDate.toISOString(),
      approvedBy: r.approvedBy,
    }));
  }

  async listCreditNotes(invoiceId?: string) {
    const tenantId = await this.tenantId();
    const rows = await this.prisma.creditNote.findMany({
      where: { tenantId, ...(invoiceId ? { invoiceId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      creditNoteId: r.id,
      creditNoteNumber: r.creditNoteNumber,
      invoiceId: r.invoiceId,
      status: r.status.toLowerCase(),
      amount: r.amount.toNumber(),
      reason: r.reason,
      issuedAt: r.issuedAt?.toISOString() ?? null,
    }));
  }

  async markOverdueInvoices() {
    const tenantId = await this.tenantId();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const result = await this.prisma.invoice.updateMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ISSUED', 'PARTIAL_PAID'] },
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE', updatedAt: new Date() },
    });
    return { markedCount: result.count };
  }
}
