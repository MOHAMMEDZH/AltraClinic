import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateInvoiceHandler } from '../../../billing/application/handlers/create-invoice.handler';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

@Injectable()
export class CreateInvoiceFromAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepo: AppointmentRepository,
    private readonly createInvoiceHandler: CreateInvoiceHandler,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(appointmentId: string): Promise<{ invoiceId: string; appointmentId: string }> {
    const tenant = await this.tenantContext.resolve();
    const appt = await this.appointmentRepo.findDetailById(appointmentId, tenant.tenantId);
    if (!appt) throw new NotFoundException('Appointment not found');

    const serviceLabel = appt.serviceType?.trim() || 'consultation';
    const stamp = Date.now().toString().slice(-6);
    const invoiceNumber = `APT-${appointmentId.slice(0, 8).toUpperCase()}-${stamp}`;
    const invoiceDate = new Date().toISOString();

    const { invoiceId } = await this.createInvoiceHandler.execute({
      patientId: appt.patientId,
      invoiceNumber,
      invoiceDate,
      dueDate: null,
      branchId: appt.branchId,
      currency: 'SYP',
      notes: `Appointment ${appointmentId} — ${serviceLabel}`,
      lineItems: [
        {
          description: `Appointment — ${serviceLabel.replace(/_/g, ' ')}`,
          quantity: 1,
          unitPrice: 0,
          discountPercent: 0,
          taxPercent: 0,
        },
      ],
      requireActiveSubscription: false,
    });

    return { invoiceId, appointmentId };
  }
}
