import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AppointmentRepository } from '../../../scheduling/domain/appointment.repository.interface';
import { CreateAppointmentHandler } from '../../../scheduling/application/handlers/create-appointment.handler';
import { UpdateAppointmentHandler } from '../../../scheduling/application/handlers/appointment.handlers';
import {
  GetAvailabilityHandler,
  ListProvidersHandler,
} from '../../../scheduling/application/handlers/scheduling-support.handlers';
import { CreateAppointmentCommand } from '../../../scheduling/application/commands/create-appointment.command';
import { GetAppointmentHandler } from '../../../scheduling/application/handlers/get-appointment.handler';
import { GetAppointmentQuery } from '../../../scheduling/application/queries/get-appointment.query';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { PORTAL_AUDIT_LOG } from '../../../../infrastructure/provider.tokens';
import { PortalAuditLog } from '../ports/portal-audit-log.port';
import { PatientPortalActivityEmitter } from '../services/patient-portal-activity.emitter';
import { PatientPortalObservabilityContracts } from '../patient-portal-observability.contracts';
import { parsePatientPortalBranchFilter } from '../patient-portal-branch-context';
import { PortalSchedulingIdempotencyService } from '../services/portal-scheduling-idempotency.service';
import {
  PortalAppointmentDto,
  toPortalAppointmentDto,
  toPortalAppointmentList,
} from '../portal-scheduling.mapper';
import { mapSchedulingErrorToPortal } from '../portal-scheduling-error.mapper';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';
import { buildPatientPortalSafeError } from '../../api/patient-portal-safe-errors';
import { AppointmentStatus } from '../../../scheduling/domain/appointment-status.enum';
import { PatientPortalActingContextService } from '../services/patient-portal-acting-context.service';

const PRODUCER_MODULE_ID = 'patient-portal.appointments';

interface PortalPatientContext {
  patientId: string;
  branchId: string | null;
  portalAccountId: string;
  userId: string;
}

export interface PortalSchedulingActor {
  userId: string;
  roles: string[];
  correlationId?: string | null;
  idempotencyKey?: string | null;
  actingContextHeader?: string | null;
  subjectPatientIdHeader?: string | null;
}

@Injectable()
export class PortalSchedulingContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, tenantId: string): Promise<PortalPatientContext> {
    if (!userId?.trim()) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }

    const account = await this.prisma.portalAccount.findFirst({
      where: { tenantId, userId: userId.trim(), status: 'ACTIVE' },
    });
    if (!account) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.INVALID_SESSION),
      );
    }

    return {
      patientId: account.patientId,
      branchId: account.branchId,
      portalAccountId: account.id,
      userId: account.userId ?? userId,
    };
  }
}

@Injectable()
export class ListMyAppointmentsHandler {
  private readonly logger = new Logger(ListMyAppointmentsHandler.name);

  constructor(
    private readonly ctx: PortalSchedulingContextService,
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
    private readonly observability: PatientPortalObservabilityContracts,
    private readonly actingContext: PatientPortalActingContextService,
  ) {}

  async execute(
    actor: PortalSchedulingActor,
    query: {
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
      branchId?: string;
      scope?: 'upcoming' | 'past' | 'all';
      actingContextHeader?: string | null;
      subjectPatientIdHeader?: string | null;
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    const acting = await this.actingContext.resolve({
      actorUserId: actor.userId,
      actorRoles: actor.roles,
      actingContextHeader: query.actingContextHeader,
      subjectPatientIdHeader: query.subjectPatientIdHeader,
      requiredScope:
        query.actingContextHeader?.toLowerCase() === 'caregiver' ? 'appointments' : undefined,
      correlationId: actor.correlationId,
    });

    // Caregiver path is read-only list; self path uses portal account branch prefs optionally.
    const portal =
      acting.mode === 'self'
        ? await this.ctx.resolve(actor.userId, tenant.tenantId)
        : null;

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);
    const branchFilter = parsePatientPortalBranchFilter(query.branchId);

    const nowIso = new Date().toISOString();
    let from = query.from;
    let to = query.to;
    if (query.scope === 'upcoming' && !from) {
      from = nowIso;
    }
    if (query.scope === 'past' && !to) {
      to = nowIso;
    }

    try {
      const result = await this.repo.list({
        tenantId: tenant.tenantId,
        branchId: branchFilter.branchId ?? undefined,
        patientId: acting.subjectPatientId,
        from,
        to,
        limit,
        offset,
      });

      this.logger.log(
        this.observability.createFoundationLogFields({
          event:
            acting.mode === 'caregiver'
              ? 'appointments.list.delegated'
              : 'appointments.list',
          tenantId: tenant.tenantId,
          correlationId: actor.correlationId,
        }),
      );

      return {
        items: toPortalAppointmentList(result.items),
        total: result.total,
        limit,
        offset,
        actingContext: acting.mode,
        subjectPatientId: acting.subjectPatientId,
        // suppress unused when caregiver
        accountBranchId: portal?.branchId ?? null,
      };
    } catch (error) {
      mapSchedulingErrorToPortal(error, actor.correlationId);
    }
  }
}

@Injectable()
export class GetMyAppointmentHandler {
  private readonly logger = new Logger(GetMyAppointmentHandler.name);

  constructor(
    private readonly ctx: PortalSchedulingContextService,
    private readonly getAppointment: GetAppointmentHandler,
    private readonly tenantContext: TenantContextService,
    private readonly observability: PatientPortalObservabilityContracts,
    private readonly actingContext: PatientPortalActingContextService,
  ) {}

  async execute(
    actor: PortalSchedulingActor,
    appointmentId: string,
    headers?: { actingContextHeader?: string | null; subjectPatientIdHeader?: string | null },
  ): Promise<PortalAppointmentDto> {
    const tenant = await this.tenantContext.resolve();
    const acting = await this.actingContext.resolve({
      actorUserId: actor.userId,
      actorRoles: actor.roles,
      actingContextHeader: headers?.actingContextHeader,
      subjectPatientIdHeader: headers?.subjectPatientIdHeader,
      requiredScope:
        headers?.actingContextHeader?.toLowerCase() === 'caregiver' ? 'appointments' : undefined,
      correlationId: actor.correlationId,
    });

    try {
      const detail = await this.getAppointment.execute(new GetAppointmentQuery(appointmentId));
      if (!detail) {
        throw new NotFoundException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.APPOINTMENT_NOT_FOUND),
        );
      }
      if (detail.patientId !== acting.subjectPatientId) {
        throw new ForbiddenException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.APPOINTMENT_ACCESS_DENIED),
        );
      }

      this.logger.log(
        this.observability.createFoundationLogFields({
          event:
            acting.mode === 'caregiver'
              ? 'appointments.detail.delegated'
              : 'appointments.detail',
          tenantId: tenant.tenantId,
          correlationId: actor.correlationId,
        }),
      );

      return toPortalAppointmentDto(detail);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      mapSchedulingErrorToPortal(error, actor.correlationId);
    }
  }
}

@Injectable()
export class BookMyAppointmentHandler {
  private readonly logger = new Logger(BookMyAppointmentHandler.name);

  constructor(
    private readonly ctx: PortalSchedulingContextService,
    private readonly create: CreateAppointmentHandler,
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: PortalSchedulingIdempotencyService,
    private readonly notifications: NotificationIntentProducerService,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly activity: PatientPortalActivityEmitter,
    private readonly observability: PatientPortalObservabilityContracts,
  ) {}

  async execute(
    actor: PortalSchedulingActor,
    input: {
      providerId: string;
      start: string;
      end: string;
      notes?: string;
      serviceType?: string;
      branchId?: string;
    },
  ) {
    if (actor.actingContextHeader?.toLowerCase() === 'caregiver') {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.BOOKING_NOT_PERMITTED),
      );
    }
    const tenant = await this.tenantContext.resolve();
    const portal = await this.ctx.resolve(actor.userId, tenant.tenantId);

    if (!input.providerId?.trim()) {
      throw new BadRequestException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.BOOKING_NOT_PERMITTED),
      );
    }
    if (!input.start || !input.end) {
      throw new BadRequestException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.BOOKING_NOT_PERMITTED),
      );
    }

    const idemKey = actor.idempotencyKey?.trim();
    if (!idemKey) {
      throw new BadRequestException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_REQUIRED),
      );
    }

    const fingerprintPayload = {
      providerId: input.providerId,
      start: input.start,
      end: input.end,
      serviceType: input.serviceType ?? 'consultation',
      patientId: portal.patientId,
    };
    const fingerprint = this.idempotency.fingerprint(fingerprintPayload);
    const gate = this.idempotency.beginOrReplay({
      tenantId: tenant.tenantId,
      patientId: portal.patientId,
      operation: 'book',
      idempotencyKey: idemKey,
      fingerprint,
    });
    if (gate.kind === 'replay') {
      return gate.result;
    }

    try {
      const created = await this.create.execute(
        new CreateAppointmentCommand(
          portal.patientId,
          input.providerId,
          input.start,
          input.end,
          input.notes,
          input.serviceType ?? 'consultation',
          false,
          undefined,
          undefined,
        ),
      );

      const safe = {
        appointmentId: created.appointmentId,
        start: input.start,
        end: input.end,
        providerId: input.providerId,
        status: 'pending',
      };

      this.idempotency.complete(gate.storageKey, fingerprint, safe);

      await this.emitSideEffects({
        tenantId: tenant.tenantId,
        branchId: portal.branchId ?? tenant.branchId ?? null,
        actor,
        portal,
        action: 'patient_portal.appointment.booked',
        activityEvent: 'appointment_booked',
        appointmentId: created.appointmentId,
        notificationTitle: 'Appointment booked',
        notificationBody: 'Your appointment booking was confirmed.',
        idempotencySuffix: `book:${created.appointmentId}`,
      });

      this.logger.log(
        this.observability.createFoundationLogFields({
          event: 'appointments.book.success',
          tenantId: tenant.tenantId,
          correlationId: actor.correlationId,
        }),
      );

      return safe;
    } catch (error) {
      this.logger.log(
        this.observability.createFoundationLogFields({
          event: 'appointments.book.conflict_or_error',
          tenantId: tenant.tenantId,
          correlationId: actor.correlationId,
        }),
      );
      mapSchedulingErrorToPortal(error, actor.correlationId);
    }
  }

  private async emitSideEffects(input: {
    tenantId: string;
    branchId: string | null;
    actor: PortalSchedulingActor;
    portal: PortalPatientContext;
    action: string;
    activityEvent: string;
    appointmentId: string;
    notificationTitle: string;
    notificationBody: string;
    idempotencySuffix: string;
  }): Promise<void> {
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: input.branchId,
      action: input.action,
      resourceId: input.appointmentId,
      actorId: input.actor.userId,
      actorRoles: input.actor.roles,
      locale: null,
      reason: null,
      details: {
        actorType: 'patient',
        actingContext: 'self',
        result: 'success',
      },
      correlationId: input.actor.correlationId ?? null,
    });

    this.activity.emit({
      event: input.activityEvent,
      tenantId: input.tenantId,
      correlationId: input.actor.correlationId,
    });

    try {
      await this.notifications.produceInApp({
        tenantId: input.tenantId,
        branchId: input.branchId,
        recipientId: input.portal.patientId,
        title: input.notificationTitle,
        body: input.notificationBody,
        priority: 'medium',
        idempotencyKey: `portal-appt:${input.tenantId}:${input.idempotencySuffix}`,
        producerModuleId: PRODUCER_MODULE_ID,
        correlationId: input.actor.correlationId ?? undefined,
        metadata: {
          appointmentId: input.appointmentId,
          event: input.activityEvent,
        },
      });
    } catch {
      // Notification failure must not alter Scheduling SoR state.
      this.logger.warn(
        this.observability.createFoundationLogFields({
          event: 'appointments.notification_intent_failed',
          tenantId: input.tenantId,
          correlationId: input.actor.correlationId,
        }),
      );
    }
  }
}

@Injectable()
export class UpdateMyAppointmentHandler {
  private readonly logger = new Logger(UpdateMyAppointmentHandler.name);

  constructor(
    private readonly ctx: PortalSchedulingContextService,
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly update: UpdateAppointmentHandler,
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: PortalSchedulingIdempotencyService,
    private readonly notifications: NotificationIntentProducerService,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    private readonly activity: PatientPortalActivityEmitter,
    private readonly observability: PatientPortalObservabilityContracts,
  ) {}

  async execute(
    actor: PortalSchedulingActor,
    appointmentId: string,
    input: {
      action?: 'cancel';
      start?: string;
      end?: string;
      cancellationReason?: string | null;
    },
  ) {
    if (actor.actingContextHeader?.toLowerCase() === 'caregiver') {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.BOOKING_NOT_PERMITTED),
      );
    }
    const tenant = await this.tenantContext.resolve();
    const portal = await this.ctx.resolve(actor.userId, tenant.tenantId);

    const appt = await this.repo.findById(appointmentId, tenant.tenantId);
    if (!appt) {
      throw new NotFoundException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.APPOINTMENT_NOT_FOUND),
      );
    }
    if (appt.patientId !== portal.patientId) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.APPOINTMENT_ACCESS_DENIED),
      );
    }

    const idemKey = actor.idempotencyKey?.trim();
    if (!idemKey) {
      throw new BadRequestException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_REQUIRED),
      );
    }

    const operation = input.action === 'cancel' ? 'cancel' : 'reschedule';
    const fingerprint = this.idempotency.fingerprint({
      appointmentId,
      action: input.action ?? null,
      start: input.start ?? null,
      end: input.end ?? null,
      cancellationReason: input.cancellationReason ?? null,
    });
    const gate = this.idempotency.beginOrReplay({
      tenantId: tenant.tenantId,
      patientId: portal.patientId,
      operation,
      idempotencyKey: idemKey,
      fingerprint,
    });
    if (gate.kind === 'replay') {
      return gate.result;
    }

    if (input.action === 'cancel') {
      if (appt.status === AppointmentStatus.Cancelled) {
        const already = toPortalAppointmentDto({
          id: appt.id,
          branchId: appt.branchId,
          providerId: appt.providerId,
          start: appt.slot.start,
          end: appt.slot.end,
          status: appt.status,
          serviceType: appt.serviceType,
          cancellationReason: appt.cancellationReason,
        });
        this.idempotency.complete(gate.storageKey, fingerprint, already);
        return already;
      }
      if (
        appt.status === AppointmentStatus.Completed ||
        appt.status === AppointmentStatus.NoShow
      ) {
        throw new BadRequestException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.CANCEL_NOT_PERMITTED),
        );
      }

      try {
        const detail = await this.update.execute(appointmentId, {
          action: 'cancel',
          cancellationReason: input.cancellationReason,
        });
        const safe = toPortalAppointmentDto(detail);
        this.idempotency.complete(gate.storageKey, fingerprint, safe);
        await this.emitSideEffects({
          tenantId: tenant.tenantId,
          branchId: portal.branchId ?? tenant.branchId ?? null,
          actor,
          portal,
          action: 'patient_portal.appointment.cancelled',
          activityEvent: 'appointment_cancelled',
          appointmentId,
          notificationTitle: 'Appointment cancelled',
          notificationBody: 'Your appointment cancellation was confirmed.',
          idempotencySuffix: `cancel:${appointmentId}`,
        });
        this.logger.log(
          this.observability.createFoundationLogFields({
            event: 'appointments.cancel.success',
            tenantId: tenant.tenantId,
            correlationId: actor.correlationId,
          }),
        );
        return safe;
      } catch (error) {
        mapSchedulingErrorToPortal(error, actor.correlationId);
      }
    }

    if (input.start && input.end) {
      if (
        appt.status === AppointmentStatus.Cancelled ||
        appt.status === AppointmentStatus.Completed ||
        appt.status === AppointmentStatus.NoShow
      ) {
        throw new BadRequestException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.RESCHEDULE_NOT_PERMITTED),
        );
      }

      try {
        const detail = await this.update.execute(appointmentId, {
          start: input.start,
          end: input.end,
        });
        const safe = toPortalAppointmentDto(detail);
        this.idempotency.complete(gate.storageKey, fingerprint, safe);
        await this.emitSideEffects({
          tenantId: tenant.tenantId,
          branchId: portal.branchId ?? tenant.branchId ?? null,
          actor,
          portal,
          action: 'patient_portal.appointment.rescheduled',
          activityEvent: 'appointment_rescheduled',
          appointmentId,
          notificationTitle: 'Appointment rescheduled',
          notificationBody: 'Your appointment reschedule was confirmed.',
          idempotencySuffix: `reschedule:${appointmentId}:${input.start}`,
        });
        this.logger.log(
          this.observability.createFoundationLogFields({
            event: 'appointments.reschedule.success',
            tenantId: tenant.tenantId,
            correlationId: actor.correlationId,
          }),
        );
        return safe;
      } catch (error) {
        mapSchedulingErrorToPortal(error, actor.correlationId);
      }
    }

    throw new BadRequestException(
      buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.BOOKING_NOT_PERMITTED),
    );
  }

  private async emitSideEffects(input: {
    tenantId: string;
    branchId: string | null;
    actor: PortalSchedulingActor;
    portal: PortalPatientContext;
    action: string;
    activityEvent: string;
    appointmentId: string;
    notificationTitle: string;
    notificationBody: string;
    idempotencySuffix: string;
  }): Promise<void> {
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: input.branchId,
      action: input.action,
      resourceId: input.appointmentId,
      actorId: input.actor.userId,
      actorRoles: input.actor.roles,
      locale: null,
      reason: null,
      details: {
        actorType: 'patient',
        actingContext: 'self',
        result: 'success',
      },
      correlationId: input.actor.correlationId ?? null,
    });

    this.activity.emit({
      event: input.activityEvent,
      tenantId: input.tenantId,
      correlationId: input.actor.correlationId,
    });

    try {
      await this.notifications.produceInApp({
        tenantId: input.tenantId,
        branchId: input.branchId,
        recipientId: input.portal.patientId,
        title: input.notificationTitle,
        body: input.notificationBody,
        priority: 'medium',
        idempotencyKey: `portal-appt:${input.tenantId}:${input.idempotencySuffix}`,
        producerModuleId: PRODUCER_MODULE_ID,
        correlationId: input.actor.correlationId ?? undefined,
        metadata: {
          appointmentId: input.appointmentId,
          event: input.activityEvent,
        },
      });
    } catch {
      this.logger.warn(
        this.observability.createFoundationLogFields({
          event: 'appointments.notification_intent_failed',
          tenantId: input.tenantId,
          correlationId: input.actor.correlationId,
        }),
      );
    }
  }
}

@Injectable()
export class GetMyAvailabilityHandler {
  private readonly logger = new Logger(GetMyAvailabilityHandler.name);

  constructor(
    private readonly availability: GetAvailabilityHandler,
    private readonly ctx: PortalSchedulingContextService,
    private readonly tenantContext: TenantContextService,
    private readonly observability: PatientPortalObservabilityContracts,
  ) {}

  async execute(
    actor: PortalSchedulingActor,
    query: { providerId: string; date: string; durationMin?: number },
  ) {
    const tenant = await this.tenantContext.resolve();
    await this.ctx.resolve(actor.userId, tenant.tenantId);

    if (!query.providerId?.trim() || !query.date?.trim()) {
      throw new BadRequestException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.BOOKING_NOT_PERMITTED),
      );
    }

    try {
      const result = await this.availability.execute({
        providerId: query.providerId,
        date: query.date,
        durationMin: query.durationMin,
      });

      this.logger.log(
        this.observability.createFoundationLogFields({
          event: 'appointments.availability',
          tenantId: tenant.tenantId,
          correlationId: actor.correlationId,
        }),
      );

      const slots = Array.isArray(result)
        ? result
        : Array.isArray((result as { slots?: unknown })?.slots)
          ? (result as { slots: Array<{ start: string; end: string }> }).slots
          : [];

      return {
        slots: slots.map((s: { start: string; end: string }) => ({
          start: s.start,
          end: s.end,
        })),
      };
    } catch (error) {
      mapSchedulingErrorToPortal(error, actor.correlationId);
    }
  }
}

@Injectable()
export class ListMyProvidersHandler {
  constructor(
    private readonly providers: ListProvidersHandler,
    private readonly ctx: PortalSchedulingContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(actor: PortalSchedulingActor, branchId?: string) {
    const tenant = await this.tenantContext.resolve();
    const portal = await this.ctx.resolve(actor.userId, tenant.tenantId);
    const branchFilter = parsePatientPortalBranchFilter(branchId);
    // Narrow only — never use branch to broaden beyond tenant-scoped provider list.
    const effectiveBranch =
      branchFilter.branchId ?? portal.branchId ?? tenant.branchId ?? undefined;

    try {
      const result = await this.providers.execute(effectiveBranch);
      const items = Array.isArray(result)
        ? result
        : Array.isArray((result as { items?: unknown })?.items)
          ? (result as { items: Array<{ id: string; name: string }> }).items
          : [];
      return {
        items: items.map((p: { id: string; name: string }) => ({
          id: p.id,
          name: p.name,
        })),
      };
    } catch (error) {
      mapSchedulingErrorToPortal(error, actor.correlationId);
    }
  }
}
