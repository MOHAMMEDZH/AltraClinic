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
      providerId: 'provider-1',
      recurrenceSeriesId: SERIES,
      start: SLOT_A.start,
      end: SLOT_A.end,
      status: 'confirmed',
      resourceId: null,
    },
    {
      id: future.id,
      providerId: 'provider-1',
      recurrenceSeriesId: SERIES,
      start: SLOT_B.start,
      end: SLOT_B.end,
      status: 'confirmed',
      resourceId: null,
    },
  ];

  const appointmentUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];

  const repo = {
    findById: jest.fn(async (id: string) => {
      if (id === anchor.id) return anchor;
      if (id === future.id) return future;
      return null;
    }),
    list: jest.fn(async () => ({ items: listItems, total: listItems.length })),
    listSeriesFutureMembers: jest.fn(async () => listItems),
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

  const concurrency = {
    withBookingTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        appointment: {
          findFirst: jest.fn(async ({ where }: { where: { id: string } }) => ({
            id: where.id,
            providerId: 'provider-1',
            clinicalServiceId: null,
            branchId: 'branch-1',
            resourceId: null,
            status: 'CONFIRMED',
            commercialLockedAt: null,
            effectiveSnapshotRevisionId: null,
          })),
          findMany: jest.fn(async ({ where }: { where: { id?: { in?: string[] } } }) => {
            const ids = where.id?.in ?? [anchor.id, future.id];
            return ids.map((id) => ({
              id,
              providerId: 'provider-1',
              clinicalServiceId: null,
              branchId: 'branch-1',
              resourceId: null,
              status: 'CONFIRMED',
              commercialLockedAt: null,
              effectiveSnapshotRevisionId: 'snap-series-1',
              scheduledStart: id === anchor.id ? new Date(SLOT_A.start) : new Date(SLOT_B.start),
              scheduledEnd: id === anchor.id ? new Date(SLOT_A.end) : new Date(SLOT_B.end),
            }));
          }),
          update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            appointmentUpdates.push({ id: where.id, data });
            return { id: where.id };
          }),
          updateMany: jest.fn(async () => ({ count: 1 })),
        },
        appointmentResourceAllocation: {
          findMany: jest.fn(async () => []),
          deleteMany: jest.fn(async () => ({ count: 0 })),
          create: jest.fn(),
        },
      }),
    ),
    assertSlotAvailableUnderLock: jest.fn(async () => undefined),
    assertNoOverlaps: jest.fn(async () => undefined),
    acquireLocks: jest.fn(async () => undefined),
    acquireSortedLockKeys: jest.fn(async () => undefined),
    buildGlobalLockKeys: jest.fn(({ providerIds, resourceIds, tenantId }: {
      tenantId: string;
      providerIds: string[];
      resourceIds: string[];
    }) =>
      [...providerIds.map((p) => `booking:provider:${tenantId}:${p}`),
        ...resourceIds.map((r) => `booking:resource:${tenantId}:${r}`)].sort(),
    ),
    lockAppointmentsForUpdate: jest.fn(async (_client: unknown, params: { appointmentIds: string[] }) =>
      params.appointmentIds.map((id) => ({
        id,
        providerId: 'provider-1',
        clinicalServiceId: null,
        branchId: 'branch-1',
        resourceId: null,
        status: 'CONFIRMED',
        commercialLockedAt: null,
        effectiveSnapshotRevisionId: 'snap-series-1',
        scheduledStart: id === anchor.id ? new Date(SLOT_A.start) : new Date(SLOT_B.start),
        scheduledEnd: id === anchor.id ? new Date(SLOT_A.end) : new Date(SLOT_B.end),
      })),
    ),
    listAllocatedResourceIds: jest.fn(async () => []),
    replaceResourceAllocations: jest.fn(async () => undefined),
  };

  const eligibility = {
    assertEligible: jest.fn(async () => undefined),
    assertClinicalServiceAccessible: jest.fn(async () => undefined),
  };
  const resources = {
    assertRequirementsSatisfied: jest.fn(async () => undefined),
    assertAllocatedResourcesOwned: jest.fn(async () => undefined),
  };
  const snapshots = {
    isConfirmedOrBeyond: jest.fn((s: string) => String(s).toUpperCase().includes('CONFIRM') || s === 'confirmed'),
    isCommercialLocked: jest.fn((p: { status: string; commercialLockedAt?: Date | null }) =>
      Boolean(p.commercialLockedAt) ||
      String(p.status).toUpperCase().includes('CONFIRM') ||
      p.status === 'confirmed',
    ),
    shouldSetCommercialLock: jest.fn((p: { nextStatus: string }) =>
      String(p.nextStatus).toUpperCase().includes('CONFIRM') || p.nextStatus === 'confirmed',
    ),
    appendResolvedCommercialRevision: jest.fn(),
  };
  const commercial = { resolveCanonical: jest.fn() };
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        appointment: {
          findFirst: jest.fn(async () => ({
            id: anchor.id,
            tenantId: 'tenant-1',
            clinicalServiceId: null,
            status: 'CONFIRMED',
            branchId: 'branch-1',
            effectiveSnapshotRevision: null,
          })),
        },
        appointmentResourceAllocation: {
          findMany: jest.fn(async () => []),
        },
      }),
    ),
  };

  const auditLog = {
    record: jest.fn(),
    recordInTransaction: jest.fn(),
  };

  const handler = new UpdateAppointmentHandler(
    repo as never,
    tenantContext as never,
    eventPublisher as never,
    concurrency as never,
    eligibility as never,
    resources as never,
    snapshots as never,
    commercial as never,
    prisma as never,
    auditLog as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    appointmentUpdates.length = 0;
    anchor.reschedule(SLOT_A);
    future.reschedule(SLOT_B);
    concurrency.assertSlotAvailableUnderLock.mockResolvedValue(undefined);
  });

  it('shifts future series visits when rescheduling with seriesScope future', async () => {
    await handler.execute(
      anchor.id,
      {
        start: '2026-06-15T11:00:00.000Z',
        end: '2026-06-15T11:30:00.000Z',
        seriesScope: 'future',
      },
      'actor-1',
    );

    expect(concurrency.withBookingTransaction).toHaveBeenCalled();
    expect(concurrency.acquireSortedLockKeys).toHaveBeenCalled();
    expect(concurrency.assertNoOverlaps).toHaveBeenCalled();
    expect(appointmentUpdates.length).toBeGreaterThanOrEqual(2);
  });

  it('cancels future series visits when requested', async () => {
    await handler.execute(
      anchor.id,
      {
        action: 'cancel',
        seriesScope: 'future',
        cancellationReason: 'Patient travel',
      },
      'actor-1',
    );

    expect(concurrency.acquireLocks).toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  it('throws when series reschedule conflicts', async () => {
    concurrency.assertNoOverlaps.mockRejectedValueOnce(new ConflictException('Slot not available'));

    await expect(
      handler.execute(
        anchor.id,
        {
          start: '2026-06-15T11:00:00.000Z',
          end: '2026-06-15T11:30:00.000Z',
          seriesScope: 'future',
        },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB01-AUTH-01 — missing authenticatedActorId rejected', async () => {
    await expect(handler.execute(anchor.id, { notes: 'x' }, '')).rejects.toBeInstanceOf(
      require('@nestjs/common').BadRequestException,
    );
  });

  it('WB01-AUTH-02 — authenticated actor required (no client actorId path)', async () => {
    expect((handler.execute as Function).length).toBeGreaterThanOrEqual(3);
    const fs = require('fs');
    const path = require('path');
    const dtoSrc = fs.readFileSync(
      path.join(__dirname, '../application/dto/appointment.dto.ts'),
      'utf8',
    );
    const updateSection = dtoSrc.split('export class UpdateAppointmentDTO')[1]?.split('export class')[0] ?? '';
    expect(updateSection).not.toMatch(/allowPostConfirmCorrection/);
    expect(updateSection).not.toMatch(/\bactorId\b/);
  });

  it('WB01-COM-01 — post-CONFIRMED clinicalServiceId change rejected on generic update', async () => {
    prisma.withPlatformBypass.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        appointment: {
          findFirst: jest.fn(async () => ({
            id: anchor.id,
            tenantId: 'tenant-1',
            clinicalServiceId: 'svc-1',
            status: 'CONFIRMED',
            branchId: 'branch-1',
            effectiveSnapshotRevision: {
              id: 'snap-1',
              clinicalServiceId: 'svc-1',
              quantity: 1,
              pricingUnit: 'PER_VISIT',
              currency: 'SYP',
              commercialReason: null,
            },
          })),
        },
        appointmentResourceAllocation: { findMany: jest.fn(async () => []) },
      }),
    );
    await expect(
      handler.execute(anchor.id, { clinicalServiceId: 'svc-2', changeReason: 'x' }, 'actor-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB01-COM-02 — post-CONFIRMED quantity/pricingUnit/currency change rejected on generic update', async () => {
    prisma.withPlatformBypass.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        appointment: {
          findFirst: jest.fn(async () => ({
            id: anchor.id,
            tenantId: 'tenant-1',
            clinicalServiceId: 'svc-1',
            status: 'CONFIRMED',
            branchId: 'branch-1',
            effectiveSnapshotRevision: {
              id: 'snap-1',
              clinicalServiceId: 'svc-1',
              quantity: 1,
              pricingUnit: 'PER_VISIT',
              currency: 'SYP',
              commercialReason: null,
            },
          })),
        },
        appointmentResourceAllocation: { findMany: jest.fn(async () => []) },
      }),
    );
    await expect(
      handler.execute(
        anchor.id,
        { quantity: 3, pricingUnit: 'PER_UNIT', currency: 'USD', changeReason: 'x' },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('WB02-ELIG-01 — service change with same provider rechecks eligibility', async () => {
    const pending = new Appointment(
      anchor.id,
      'tenant-1',
      'branch-1',
      'patient-1',
      'provider-1',
      SLOT_A,
      AppointmentStatus.Pending,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      SERIES,
    );
    repo.findById.mockResolvedValueOnce(pending);
    prisma.withPlatformBypass.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        appointment: {
          findFirst: jest.fn(async () => ({
            id: anchor.id,
            tenantId: 'tenant-1',
            clinicalServiceId: 'svc-1',
            status: 'PENDING',
            branchId: 'branch-1',
            effectiveSnapshotRevision: {
              id: 'snap-1',
              clinicalServiceId: 'svc-1',
              quantity: 1,
              pricingUnit: 'PER_VISIT',
              currency: 'SYP',
              commercialReason: null,
            },
          })),
        },
        appointmentResourceAllocation: {
          findMany: jest.fn(async () => []),
        },
      }),
    );
    commercial.resolveCanonical.mockResolvedValue({
      clinicalServiceId: 'svc-2',
      stableKey: 'k',
      displayNameAr: 'a',
      displayNameEn: 'e',
      tenantServiceConfigurationId: null,
      priceVersionId: null,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 10,
      taxPercent: 0,
      quantity: 1,
      commercialReason: null,
    });
    snapshots.appendResolvedCommercialRevision.mockResolvedValue({ id: 'snap-2', revisionNumber: 2 });
    await expect(
      handler.execute(anchor.id, { clinicalServiceId: 'svc-2', changeReason: 'swap' }, 'actor-1'),
    ).resolves.toBeTruthy();
    expect(eligibility.assertEligible).toHaveBeenCalledWith(
      expect.objectContaining({
        providerUserId: 'provider-1',
        clinicalServiceId: 'svc-2',
      }),
    );
  });

  it('WB03-CANCEL-01 — cancel participates in lock primitive', async () => {
    await handler.execute(
      anchor.id,
      { action: 'cancel', cancellationReason: 'no-show' },
      'actor-1',
    );
    expect(concurrency.withBookingTransaction).toHaveBeenCalled();
    expect(concurrency.acquireSortedLockKeys).toHaveBeenCalled();
  });
});

describe('DeleteAppointmentHandler soft-delete lock', () => {
  it('WB03-DELETE-01 — soft delete participates in lock primitive', async () => {
    const { DeleteAppointmentHandler } = require('../application/handlers/appointment.handlers');
    const concurrency = {
      withBookingTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) =>
        fn({
          appointment: {
            updateMany: jest.fn(async () => ({ count: 1 })),
          },
        }),
      ),
      acquireLocks: jest.fn(async () => undefined),
      listAllocatedResourceIds: jest.fn(async () => ['res-1']),
    };
    const repo = {
      findById: jest.fn(async () =>
        peer('appt-del', '2026-06-15T09:00:00.000Z', '2026-06-15T09:30:00.000Z'),
      ),
    };
    const tenantContext = { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1' }) };
    const handler = new DeleteAppointmentHandler(repo as never, tenantContext as never, concurrency as never);
    await handler.execute('appt-del');
    expect(concurrency.withBookingTransaction).toHaveBeenCalled();
    expect(concurrency.acquireLocks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ providerId: 'provider-1', resourceIds: expect.arrayContaining(['res-1']) }),
    );
  });
});
