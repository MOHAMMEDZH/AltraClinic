import { QueueTicket } from './queue-ticket.entity';

export interface QueueRepository {
  save(ticket: QueueTicket): Promise<void>;
  existsByAppointmentId(appointmentId: string, tenantId: string): Promise<boolean>;
  listWaiting(tenantId: string, branchId?: string | null): Promise<QueueTicket[]>;
}
