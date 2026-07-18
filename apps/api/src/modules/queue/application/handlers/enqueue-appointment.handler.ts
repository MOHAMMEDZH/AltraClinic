import { Inject, Injectable } from '@nestjs/common';
import { QUEUE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { QueueRepository } from '../../domain/queue.repository.interface';
import { QueueTicket } from '../../domain/queue-ticket.entity';

@Injectable()
export class EnqueueAppointmentHandler {
  constructor(@Inject(QUEUE_REPOSITORY) private readonly repository: QueueRepository) {}

  async execute(command: {
    tenantId: string;
    branchId: string | null;
    appointmentId: string;
    patientId: string;
    providerId: string;
    start: string;
    end: string;
  }): Promise<{ queueTicketId: string } | null> {
    const exists = await this.repository.existsByAppointmentId(command.appointmentId, command.tenantId);
    if (exists) {
      return null;
    }

    const ticket = QueueTicket.create({
      tenantId: command.tenantId,
      branchId: command.branchId,
      appointmentId: command.appointmentId,
      patientId: command.patientId,
      providerId: command.providerId,
      scheduledStart: command.start,
      scheduledEnd: command.end,
    });

    await this.repository.save(ticket);
    return { queueTicketId: ticket.queueTicketId };
  }
}
