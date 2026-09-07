import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppointmentStatus } from '../../scheduling/domain/appointment-status.enum';
import { TimeSlotVO } from '../../scheduling/domain/timeslot.vo';
import { Appointment } from '../../scheduling/domain/appointment.entity';
import { PatientPortalAppointmentsEnabledGuard } from '../api/patient-portal-appointments.guard';
import { isPatientPortalAppointmentsEnabled } from '../config/patient-portal-config';
import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';
import { toPortalAppointmentDto } from '../application/portal-scheduling.mapper';
import { PortalSchedulingIdempotencyService } from '../application/services/portal-scheduling-idempotency.service';
import {
  BookMyAppointmentHandler,
  GetMyAppointmentHandler,
  ListMyAppointmentsHandler,
  PortalSchedulingContextService,
  UpdateMyAppointmentHandler,
} from '../application/handlers/portal-scheduling.handlers';
import { FakePortalAuditLog } from './support/fake-portal-audit-log';
import { PatientPortalActivityEmitter } from '../application/services/patient-portal-activity.emitter';
import { PatientPortalObservabilityContracts } from '../application/patient-portal-observability.contracts';

describe('Phase 46c — Patient Portal appointments facade', () => {
  const previous: Record<string, string | undefined> = {};
  const flagKeys = ['PATIENT_PORTAL_CENTER_ENABLED', 'PATIENT_PORTAL_APPOINTMENTS_ENABLED'];

  beforeEach(() => {
    for (const key of flagKeys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of flagKeys) {
      const prev = previous[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it('keeps appointments sub-flag OFF by default and fail-closed when center OFF', () => {
    expect(isPatientPortalAppointmentsEnabled()).toBe(false);
    process.env.PATIENT_PORTAL_APPOINTMENTS_ENABLED = 'true';
    expect(isPatientPortalAppointmentsEnabled()).toBe(false);
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'true';
    expect(isPatientPortalAppointmentsEnabled()).toBe(true);
  });

  it('AppointmentsEnabledGuard denies when sub-flag OFF', () => {
    const guard = new PatientPortalAppointmentsEnabledGuard();
    expect(() => guard.canActivate({} as never)).toThrow(ServiceUnavailableException);
    try {
      guard.canActivate({} as never);
    } catch (error) {
      const ex = error as ServiceUnavailableException;
      const body = ex.getResponse() as { code: string };
      expect(body.code).toBe(PATIENT_PORTAL_ERROR_CODES.APPOINTMENTS_DISABLED);
    }
  });

  it('maps Scheduling list items to patient-safe DTOs without PHI-heavy fields', () => {
    const dto = toPortalAppointmentDto({
      id: 'a1',
      branchId: 'b1',
      providerId: 'p1',
      start: '2026-07-20T10:00:00.000Z',
      end: '2026-07-20T10:30:00.000Z',
      status: 'confirmed',
      serviceType: 'consultation',
    });
    expect(dto).toEqual({
      id: 'a1',
      branchId: 'b1',
      providerId: 'p1',
      start: '2026-07-20T10:00:00.000Z',
      end: '2026-07-20T10:30:00.000Z',
      status: 'confirmed',
      serviceType: 'consultation',
    });
    expect(dto).not.toHaveProperty('patientName');
    expect(dto).not.toHaveProperty('notes');
  });

  it('idempotency replays identical requests and rejects payload mismatch', async () => {
    const store = new PortalSchedulingIdempotencyService();
    const fingerprint = store.fingerprint({ a: 1 });
    const first = await store.beginOrReplay({
      tenantId: 't1',
      patientId: 'p1',
      operation: 'book',
      idempotencyKey: 'k1',
      fingerprint,
    });
    expect(first.kind).toBe('proceed');
    if (first.kind !== 'proceed') return;
    await store.complete(first.rowId, fingerprint, { appointmentId: 'a1' }, first.ownerToken);

    const replay = await store.beginOrReplay({
      tenantId: 't1',
      patientId: 'p1',
      operation: 'book',
      idempotencyKey: 'k1',
      fingerprint,
    });
    expect(replay).toEqual({ kind: 'replay', result: { appointmentId: 'a1' } });

    await expect(
      store.beginOrReplay({
        tenantId: 't1',
        patientId: 'p1',
        operation: 'book',
        idempotencyKey: 'k1',
        fingerprint: store.fingerprint({ a: 2 }),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('handlers', () => {
    const tenant = { tenantId: 'tenant-1', branchId: 'branch-1' };
    const portal = {
      patientId: 'patient-1',
      branchId: 'branch-1',
      portalAccountId: 'portal-1',
      userId: 'user-1',
    };
    const actor = {
      userId: 'user-1',
      roles: ['patient'],
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
    };

    let ctx: { resolve: jest.Mock };
    let tenantContext: { resolve: jest.Mock };
    let repo: {
      list: jest.Mock;
      findById: jest.Mock;
    };
    let create: { execute: jest.Mock };
    let update: { execute: jest.Mock };
    let getAppointment: { execute: jest.Mock };
    let notifications: { produceInApp: jest.Mock };
    let audit: FakePortalAuditLog;
    let activity: PatientPortalActivityEmitter;
    let observability: PatientPortalObservabilityContracts;
    let idempotency: PortalSchedulingIdempotencyService;

    beforeEach(() => {
      ctx = { resolve: jest.fn().mockResolvedValue(portal) };
      tenantContext = { resolve: jest.fn().mockResolvedValue(tenant) };
      repo = {
        list: jest.fn(),
        findById: jest.fn(),
      };
      create = { execute: jest.fn() };
      update = { execute: jest.fn() };
      getAppointment = { execute: jest.fn() };
      notifications = { produceInApp: jest.fn().mockResolvedValue({ intentId: 'n1' }) };
      audit = new FakePortalAuditLog();
      observability = new PatientPortalObservabilityContracts();
      activity = new PatientPortalActivityEmitter(observability);
      idempotency = new PortalSchedulingIdempotencyService();
    });

    it('lists only the authenticated patient appointments and applies branch narrowing', async () => {
      repo.list.mockResolvedValue({
        items: [
          {
            id: 'a1',
            branchId: 'branch-1',
            providerId: 'p1',
            start: '2026-08-01T10:00:00.000Z',
            end: '2026-08-01T10:30:00.000Z',
            status: 'confirmed',
            serviceType: 'consultation',
            patientId: 'patient-1',
            patientName: 'Hidden',
            notes: 'secret',
            isEmergency: false,
            recurrenceSeriesId: null,
            resourceId: null,
            createdAt: new Date(),
            tenantId: 'tenant-1',
          },
        ],
        total: 1,
      });
      const actingContext = {
        resolve: jest.fn().mockResolvedValue({
          mode: 'self',
          actorUserId: 'user-1',
          actorRoles: ['patient'],
          subjectPatientId: 'patient-1',
          subjectPortalAccountId: 'portal-1',
          grantId: null,
          scopes: [],
        }),
      };
      const handler = new ListMyAppointmentsHandler(
        ctx as unknown as PortalSchedulingContextService,
        repo as never,
        tenantContext as never,
        observability,
        actingContext as never,
      );
      const result = await handler.execute(actor, { branchId: 'branch-1', scope: 'upcoming' });
      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          patientId: 'patient-1',
          branchId: 'branch-1',
        }),
      );
      expect(result.items[0]).not.toHaveProperty('patientName');
      expect(result.items[0]).not.toHaveProperty('notes');
    });

    it('denies appointment detail for another patient (IDOR)', async () => {
      const actingContext = {
        resolve: jest.fn().mockResolvedValue({
          mode: 'self',
          subjectPatientId: 'patient-1',
        }),
      };
      // force mismatch via acting subject vs detail patient
      actingContext.resolve.mockResolvedValue({
        mode: 'self',
        subjectPatientId: 'patient-1',
      });
      getAppointment.execute.mockResolvedValue({
        id: 'a2',
        patientId: 'other-patient',
        branchId: 'branch-1',
        providerId: 'p1',
        start: '2026-08-01T10:00:00.000Z',
        end: '2026-08-01T10:30:00.000Z',
        status: 'confirmed',
        serviceType: 'consultation',
      });
      const handler = new GetMyAppointmentHandler(
        ctx as unknown as PortalSchedulingContextService,
        getAppointment as never,
        tenantContext as never,
        observability,
        actingContext as never,
      );
      await expect(handler.execute(actor, 'a2')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('books through Scheduling CreateAppointmentHandler with portal patientId binding', async () => {
      create.execute.mockResolvedValue({
        appointmentId: 'appt-new',
        appointmentIds: ['appt-new'],
        seriesId: null,
      });
      const handler = new BookMyAppointmentHandler(
        ctx as unknown as PortalSchedulingContextService,
        create as never,
        tenantContext as never,
        idempotency,
        notifications as never,
        audit,
        activity,
        observability,
      );
      const result = await handler.execute(actor, {
        providerId: 'provider-1',
        start: '2026-08-01T10:00:00.000Z',
        end: '2026-08-01T10:30:00.000Z',
      });
      expect(create.execute).toHaveBeenCalled();
      const cmd = create.execute.mock.calls[0][0];
      expect(cmd.patientId).toBe('patient-1');
      expect(result).toEqual(
        expect.objectContaining({ appointmentId: 'appt-new', providerId: 'provider-1' }),
      );
      expect(audit.records).toHaveLength(1);
      expect(audit.records[0].action).toBe('patient_portal.appointment.booked');
      expect(notifications.produceInApp).toHaveBeenCalled();

      const replay = await handler.execute(actor, {
        providerId: 'provider-1',
        start: '2026-08-01T10:00:00.000Z',
        end: '2026-08-01T10:30:00.000Z',
      });
      expect(create.execute).toHaveBeenCalledTimes(1);
      expect(replay).toEqual(result);
    });

    it('requires idempotency key for booking', async () => {
      const handler = new BookMyAppointmentHandler(
        ctx as unknown as PortalSchedulingContextService,
        create as never,
        tenantContext as never,
        idempotency,
        notifications as never,
        audit,
        activity,
        observability,
      );
      await expect(
        handler.execute(
          { ...actor, idempotencyKey: null },
          {
            providerId: 'provider-1',
            start: '2026-08-01T10:00:00.000Z',
            end: '2026-08-01T10:30:00.000Z',
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps slot conflict to patient-safe SLOT_UNAVAILABLE', async () => {
      create.execute.mockRejectedValue(new ConflictException('Slot not available'));
      const handler = new BookMyAppointmentHandler(
        ctx as unknown as PortalSchedulingContextService,
        create as never,
        tenantContext as never,
        idempotency,
        notifications as never,
        audit,
        activity,
        observability,
      );
      try {
        await handler.execute(
          { ...actor, idempotencyKey: 'idem-conflict' },
          {
            providerId: 'provider-1',
            start: '2026-08-01T10:00:00.000Z',
            end: '2026-08-01T10:30:00.000Z',
          },
        );
        throw new Error('expected conflict');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toEqual(
          expect.objectContaining({
            code: PATIENT_PORTAL_ERROR_CODES.SLOT_UNAVAILABLE,
          }),
        );
      }
    });

    it('cancels owned appointment and rejects foreign ownership', async () => {
      const owned = new Appointment(
        'appt-1',
        'tenant-1',
        'branch-1',
        'patient-1',
        'provider-1',
        new TimeSlotVO('2026-08-01T10:00:00.000Z', '2026-08-01T10:30:00.000Z'),
        AppointmentStatus.Confirmed,
      );
      repo.findById.mockResolvedValue(owned);
      update.execute.mockResolvedValue({
        id: 'appt-1',
        branchId: 'branch-1',
        providerId: 'provider-1',
        start: owned.slot.start,
        end: owned.slot.end,
        status: 'cancelled',
        serviceType: 'consultation',
        cancellationReason: null,
        updatedAt: new Date().toISOString(),
      });
      const handler = new UpdateMyAppointmentHandler(
        ctx as unknown as PortalSchedulingContextService,
        repo as never,
        update as never,
        tenantContext as never,
        idempotency,
        notifications as never,
        audit,
        activity,
        observability,
      );
      const cancelled = (await handler.execute(
        { ...actor, idempotencyKey: 'cancel-1' },
        'appt-1',
        { action: 'cancel' },
      )) as { status: string };
      expect(cancelled.status).toBe('cancelled');
      expect(audit.records[0].action).toBe('patient_portal.appointment.cancelled');

      repo.findById.mockResolvedValue(
        new Appointment(
          'appt-x',
          'tenant-1',
          'branch-1',
          'other-patient',
          'provider-1',
          new TimeSlotVO('2026-08-01T10:00:00.000Z', '2026-08-01T10:30:00.000Z'),
        ),
      );
      await expect(
        handler.execute({ ...actor, idempotencyKey: 'cancel-2' }, 'appt-x', { action: 'cancel' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects reschedule of cancelled appointment', async () => {
      repo.findById.mockResolvedValue(
        new Appointment(
          'appt-1',
          'tenant-1',
          'branch-1',
          'patient-1',
          'provider-1',
          new TimeSlotVO('2026-08-01T10:00:00.000Z', '2026-08-01T10:30:00.000Z'),
          AppointmentStatus.Cancelled,
        ),
      );
      const handler = new UpdateMyAppointmentHandler(
        ctx as unknown as PortalSchedulingContextService,
        repo as never,
        update as never,
        tenantContext as never,
        idempotency,
        notifications as never,
        audit,
        activity,
        observability,
      );
      await expect(
        handler.execute({ ...actor, idempotencyKey: 're-1' }, 'appt-1', {
          start: '2026-08-02T10:00:00.000Z',
          end: '2026-08-02T10:30:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns not found when appointment missing', async () => {
      repo.findById.mockResolvedValue(null);
      const handler = new UpdateMyAppointmentHandler(
        ctx as unknown as PortalSchedulingContextService,
        repo as never,
        update as never,
        tenantContext as never,
        idempotency,
        notifications as never,
        audit,
        activity,
        observability,
      );
      await expect(
        handler.execute({ ...actor, idempotencyKey: 'x' }, 'missing', { action: 'cancel' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
