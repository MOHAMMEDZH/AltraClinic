import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';

type BeautySessionRow = {
  id: string;
  type?: string;
  status?: string;
  scheduledAt?: string;
  clinicianId?: string;
  appointmentId?: string | null;
  notes?: string;
};

const SESSION_DURATION_MS = 60 * 60 * 1000;

@Injectable()
export class BeautySessionSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bidirectional scheduling sync: beauty sessions ↔ appointments.
   * Creates/updates/cancels appointments when sessions change in bodyMapState.
   */
  async syncSessions(
    tenantId: string,
    branchId: string | null,
    patientId: string,
    previousSessions: BeautySessionRow[],
    nextSessions: BeautySessionRow[],
  ): Promise<BeautySessionRow[]> {
    const prevById = new Map(previousSessions.map((s) => [s.id, s]));
    const synced: BeautySessionRow[] = [];

    for (const session of nextSessions) {
      const prev = prevById.get(session.id);
      const copy = { ...session };

      if (session.status === 'scheduled' && session.scheduledAt && session.clinicianId) {
        const start = new Date(session.scheduledAt);
        const end = new Date(start.getTime() + SESSION_DURATION_MS);
        const serviceType = `beauty:${session.type ?? 'treatment'}`;

        if (session.appointmentId) {
          const existing = await this.prisma.appointment.findFirst({
            where: { id: session.appointmentId, tenantId, deletedAt: null },
          });
          if (existing) {
            const rescheduled =
              prev?.scheduledAt !== session.scheduledAt || prev?.clinicianId !== session.clinicianId;
            if (rescheduled) {
              await this.prisma.appointment.update({
                where: { id: existing.id },
                data: {
                  scheduledStart: start,
                  scheduledEnd: end,
                  providerId: session.clinicianId,
                  serviceType,
                  notes: session.notes ?? existing.notes,
                },
              });
            }
            copy.appointmentId = existing.id;
          } else {
            copy.appointmentId = await this.createAppointment(
              tenantId,
              branchId,
              patientId,
              session,
              start,
              end,
              serviceType,
            );
          }
        } else if (!prev?.appointmentId) {
          copy.appointmentId = await this.createAppointment(
            tenantId,
            branchId,
            patientId,
            session,
            start,
            end,
            serviceType,
          );
        } else {
          copy.appointmentId = prev.appointmentId;
        }
      } else if (session.appointmentId || prev?.appointmentId) {
        const apptId = session.appointmentId ?? prev?.appointmentId;
        if (apptId && (session.status === 'cancelled' || session.status === 'completed')) {
          await this.prisma.appointment.updateMany({
            where: { id: apptId, tenantId, deletedAt: null },
            data: {
              status: session.status === 'cancelled' ? 'CANCELLED' : 'COMPLETED',
            },
          });
        }
        copy.appointmentId = apptId ?? null;
      }

      synced.push(copy);
      prevById.delete(session.id);
    }

    for (const removed of prevById.values()) {
      if (removed.appointmentId) {
        await this.prisma.appointment.updateMany({
          where: { id: removed.appointmentId, tenantId, deletedAt: null, status: 'SCHEDULED' },
          data: { status: 'CANCELLED', cancellationReason: 'Beauty session removed' },
        });
      }
    }

    return synced;
  }

  private async createAppointment(
    tenantId: string,
    branchId: string | null,
    patientId: string,
    session: BeautySessionRow,
    start: Date,
    end: Date,
    serviceType: string,
  ): Promise<string> {
    const id = randomUUID();
    await this.prisma.appointment.create({
      data: {
        id,
        tenantId,
        branchId,
        patientId,
        providerId: session.clinicianId!,
        scheduledStart: start,
        scheduledEnd: end,
        status: 'SCHEDULED',
        serviceType,
        notes: session.notes ?? `Beauty session ${session.id}`,
      },
    });
    return id;
  }
}
