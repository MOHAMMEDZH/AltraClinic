import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateInvoiceHandler } from '../../../billing/application/handlers/create-invoice.handler';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { isBillingInvoiceFromSnapshotEnabled } from '../../domain/booking-feature-flags';

@Injectable()
export class CreateInvoiceFromAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepo: AppointmentRepository,
    private readonly createInvoiceHandler: CreateInvoiceHandler,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(appointmentId: string): Promise<{ invoiceId: string; appointmentId: string }> {
    const tenant = await this.tenantContext.resolve();
    const appt = await this.appointmentRepo.findDetailById(appointmentId, tenant.tenantId);
    if (!appt) throw new NotFoundException('Appointment not found');

    const features = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: tenant.tenantId }, select: { features: true } }),
    );
    const snapshotBillingOn = isBillingInvoiceFromSnapshotEnabled(
      (features?.features as Record<string, unknown> | null) ?? null,
    );

    const row = await this.prisma.withPlatformBypass((c) =>
      c.appointment.findFirst({
        where: { id: appointmentId, tenantId: tenant.tenantId, deletedAt: null },
        include: { effectiveSnapshotRevision: true },
      }),
    );

    const serviceLabel = appt.serviceType?.trim() || 'consultation';
    const stamp = Date.now().toString().slice(-6);
    const invoiceNumber = `APT-${appointmentId.slice(0, 8).toUpperCase()}-${stamp}`;
    const invoiceDate = new Date().toISOString();

    let description = `Appointment — ${serviceLabel.replace(/_/g, ' ')}`;
    let quantity = 1;
    let unitPrice = 0;
    let taxPercent = 0;
    let currency = 'SYP';

    if (snapshotBillingOn) {
      const snap = row?.effectiveSnapshotRevision;
      if (!snap) {
        throw new BadRequestException(
          'Canonical appointment missing effective snapshot revision while billing.invoice.from.snapshot is ON',
        );
      }
      description = snap.displayNameEn || description;
      quantity = Number(snap.quantity);
      unitPrice = Number(snap.unitPrice);
      taxPercent = Number(snap.taxPercent ?? 0);
      currency = snap.currency;
      if (unitPrice === 0 && !snap.commercialReason) {
        throw new BadRequestException('Snapshot zero unitPrice missing commercialReason');
      }
    }
    // flag OFF = bounded Release 47 legacy path (serviceType label + zero unitPrice placeholder).
    // Do NOT opportunistically consume snapshot merely because one exists.

    const { invoiceId } = await this.createInvoiceHandler.execute({
      patientId: appt.patientId,
      invoiceNumber,
      invoiceDate,
      dueDate: null,
      branchId: appt.branchId,
      currency,
      notes: `Appointment ${appointmentId} — ${serviceLabel}`,
      lineItems: [
        {
          description,
          quantity,
          unitPrice,
          discountPercent: 0,
          taxPercent,
        },
      ],
      requireActiveSubscription: false,
    });

    return { invoiceId, appointmentId };
  }
}
