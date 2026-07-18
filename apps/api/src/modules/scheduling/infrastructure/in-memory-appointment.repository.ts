import { Injectable } from '@nestjs/common';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentRepository } from '../domain/appointment.repository.interface';
import { TimeSlotVO } from '../domain/timeslot.vo';
import type { AppointmentDetail, AppointmentListFilter, AppointmentListItem } from '../domain/scheduling.types';
import { AppointmentStatus } from '../domain/appointment-status.enum';

@Injectable()
export class InMemoryAppointmentRepository implements AppointmentRepository {
  private store = new Map<string, Appointment>();

  async save(appointment: Appointment): Promise<void> {
    this.store.set(appointment.id, appointment);
  }

  async findById(id: string, tenantId: string): Promise<Appointment | null> {
    const appointment = this.store.get(id);
    if (!appointment || appointment.tenantId !== tenantId) {
      return null;
    }
    return appointment;
  }

  async findDetailById(id: string, tenantId: string): Promise<AppointmentDetail | null> {
    const appt = await this.findById(id, tenantId);
    if (!appt) return null;
    return this.toListItem(appt);
  }

  async findByProviderAndSlot(
    providerId: string,
    slot: TimeSlotVO,
    tenantId: string,
    excludeId?: string,
  ): Promise<Appointment | null> {
    for (const a of this.store.values()) {
      if (a.tenantId !== tenantId) continue;
      if (excludeId && a.id === excludeId) continue;
      if (a.status === AppointmentStatus.Cancelled) continue;
      if (a.providerId === providerId && a.slot.overlaps(slot)) return a;
    }
    return null;
  }

  async findByResourceAndSlot(
    resourceId: string,
    slot: TimeSlotVO,
    tenantId: string,
    excludeId?: string,
  ): Promise<Appointment | null> {
    for (const a of this.store.values()) {
      if (a.tenantId !== tenantId) continue;
      if (excludeId && a.id === excludeId) continue;
      if (a.status === AppointmentStatus.Cancelled) continue;
      if (a.resourceId === resourceId && a.slot.overlaps(slot)) return a;
    }
    return null;
  }

  async list(filter: AppointmentListFilter): Promise<{ items: AppointmentListItem[]; total: number }> {
    let items = [...this.store.values()].filter((a) => a.tenantId === filter.tenantId);
    if (filter.providerId) items = items.filter((a) => a.providerId === filter.providerId);
    if (filter.patientId) items = items.filter((a) => a.patientId === filter.patientId);
    if (filter.branchId) items = items.filter((a) => a.branchId === filter.branchId);
    if (filter.status) {
      items = items.filter((a) => a.status === (filter.status as AppointmentStatus));
    }
    if (filter.from) {
      const from = new Date(filter.from).getTime();
      items = items.filter((a) => new Date(a.slot.start).getTime() >= from);
    }
    if (filter.to) {
      const to = new Date(filter.to).getTime();
      items = items.filter((a) => new Date(a.slot.start).getTime() <= to);
    }
    items.sort((a, b) => new Date(a.slot.start).getTime() - new Date(b.slot.start).getTime());
    const total = items.length;
    const page = items.slice(filter.offset, filter.offset + filter.limit);
    return { total, items: page.map((a) => this.toListItem(a)) };
  }

  async updateNotes(id: string, tenantId: string, notes: string | null): Promise<void> {
    const appt = await this.findById(id, tenantId);
    if (appt) {
      appt.notes = notes;
      await this.save(appt);
    }
  }

  private toListItem(appt: Appointment): AppointmentDetail {
    return {
      id: appt.id,
      tenantId: appt.tenantId,
      branchId: appt.branchId,
      patientId: appt.patientId,
      patientName: appt.patientId,
      providerId: appt.providerId,
      start: appt.slot.start,
      end: appt.slot.end,
      status: appt.status,
      notes: appt.notes,
      serviceType: appt.serviceType,
      isEmergency: appt.isEmergency,
      recurrenceSeriesId: appt.recurrenceSeriesId,
      resourceId: appt.resourceId,
      resourceName: null,
      createdAt: appt.createdAt,
      updatedAt: appt.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
