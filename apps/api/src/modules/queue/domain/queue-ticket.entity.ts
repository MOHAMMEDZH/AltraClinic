import { randomUUID } from 'crypto';

export type QueueTicketStatus = 'waiting' | 'serving' | 'completed';

export class QueueTicket {
  public readonly queueTicketId: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly appointmentId: string;
  public readonly patientId: string;
  public readonly providerId: string;
  public readonly scheduledStart: string;
  public readonly scheduledEnd: string;
  public status: QueueTicketStatus;
  public readonly createdAt: string;
  public updatedAt: string;

  private constructor(params: {
    tenantId: string;
    branchId: string | null;
    appointmentId: string;
    patientId: string;
    providerId: string;
    scheduledStart: string;
    scheduledEnd: string;
  }) {
    this.queueTicketId = randomUUID();
    this.tenantId = params.tenantId;
    this.branchId = params.branchId;
    this.appointmentId = params.appointmentId;
    this.patientId = params.patientId;
    this.providerId = params.providerId;
    this.scheduledStart = params.scheduledStart;
    this.scheduledEnd = params.scheduledEnd;
    this.status = 'waiting';
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
  }

  static create(params: {
    tenantId: string;
    branchId: string | null;
    appointmentId: string;
    patientId: string;
    providerId: string;
    scheduledStart: string;
    scheduledEnd: string;
  }): QueueTicket {
    if (!params.tenantId?.trim()) throw new Error('tenantId is required');
    if (!params.appointmentId?.trim()) throw new Error('appointmentId is required');
    if (!params.patientId?.trim()) throw new Error('patientId is required');
    if (!params.providerId?.trim()) throw new Error('providerId is required');
    return new QueueTicket(params);
  }

  toJSON() {
    return {
      queueTicketId: this.queueTicketId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      appointmentId: this.appointmentId,
      patientId: this.patientId,
      providerId: this.providerId,
      scheduledStart: this.scheduledStart,
      scheduledEnd: this.scheduledEnd,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
