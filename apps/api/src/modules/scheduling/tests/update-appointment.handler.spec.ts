import { ConflictException } from '@nestjs/common';
import { UpdateAppointmentHandler } from '../application/handlers/appointment.handlers';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';

const SERIES = 'series-1';
const SLOT_A = new TimeSlotVO('2026-06-15T09:00:00.000Z', '2026-06-15T09:30:00.000Z');
const SLOT_B = new TimeSlotVO('2026-06-22T09:00:00.000Z', '2026-06-22T09:30:00.000Z');

function peer(id: string, start: string, end: string): Appointment {
  return new Appointment(
    id,
    'tenant-1',
    'branch-1',
    'patient-1',
    'provider-1',
    new TimeSlotVO(start, end),
    AppointmentStatus.Confirmed,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    SERIES,
  );
}

describe('UpdateAppointmentHandler series scope', () => {
  const tenantContext = { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1' }) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const anchor = peer('appt-a', SLOT_A.start, SLOT_A.end);
  const future = peer('appt-b', SLOT_B.start, SLOT_B.end);

  const listItems = [
    {
      id: anchor.id,
      recurrenceSeriesId: SERIES,
      start: SLOT_A.start,
      end: SLOT_A.end,
      status: 'confirmed',
    },
    {
      id: future.id,
      recurrenceSeriesId: SERIES,
      start: SLOT_B.start,
      end: SLOT_B.end,
      status: 'confirmed',
    },
  ];

  const repo = {
    findById: jest.fn(async (id: string) => {
      if (id === anchor.id) return anchor;
      if (id === future.id) return future;
      return null;
    }),
    list: jest.fn(async () => ({ items: listItems, total: listItems.length })),
    findByProviderAndSlot: jest.fn(async () => null),
    save: jest.fn(async (appt: Appointment) => appt),
    findDetailById: jest.fn(async (id: string) => ({
      id,
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId: 'patient-1',
      patientName: 'Test Patient',
      providerId: 'provider-1',
      start: SLOT_A.start,
      end: SLOT_A.end,
      status: 'confirmed',
      notes: null,
      serviceType: null,
      isEmergency: false,
      recurrenceSeriesId: SERIES,
      resourceId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };

  const handler = new UpdateAppointmentHandler(
    repo as any,
    tenantContext as any,
    eventPublisher as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    anchor.reschedule(SLOT_A);
    future.reschedule(SLOT_B);
  });

  it('shifts future series visits when rescheduling with seriesScope future', async () => {
    await handler.execute(anchor.id, {
      start: '2026-06-15T11:00:00.000Z',
      end: '2026-06-15T11:30:00.000Z',
      seriesScope: 'future',
    });

    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(future.slot.start).toBe('2026-06-22T11:00:00.000Z');
  });

  it('cancels future series visits when requested', async () => {
    await handler.execute(anchor.id, {
      action: 'cancel',
      seriesScope: 'future',
      cancellationReason: 'Patient travel',
    });

    expect(future.status).toBe(AppointmentStatus.Cancelled);
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  it('throws when series reschedule conflicts', async () => {
    repo.findByProviderAndSlot.mockResolvedValueOnce({ id: 'other' } as any);

    await expect(
      handler.execute(anchor.id, {
        start: '2026-06-15T11:00:00.000Z',
        end: '2026-06-15T11:30:00.000Z',
        seriesScope: 'future',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
