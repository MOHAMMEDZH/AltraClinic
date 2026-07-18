import { Injectable } from '@nestjs/common';
import { QueueRepository } from '../domain/queue.repository.interface';
import { QueueTicket } from '../domain/queue-ticket.entity';

@Injectable()
export class InMemoryQueueRepository implements QueueRepository {
  private readonly tickets: QueueTicket[] = [];

  async save(ticket: QueueTicket): Promise<void> {
    this.tickets.push(ticket);
  }

  async existsByAppointmentId(appointmentId: string, tenantId: string): Promise<boolean> {
    return this.tickets.some(
      (ticket) => ticket.appointmentId === appointmentId && ticket.tenantId === tenantId,
    );
  }

  async listWaiting(tenantId: string, branchId?: string | null): Promise<QueueTicket[]> {
    return this.tickets
      .filter((ticket) => ticket.tenantId === tenantId)
      .filter((ticket) => (branchId ? ticket.branchId === branchId : true))
      .filter((ticket) => ticket.status === 'waiting');
  }
}
