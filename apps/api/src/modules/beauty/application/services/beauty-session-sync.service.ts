import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { isTenantCanonicalWriteEnabled } from '../../../clinical-catalog/domain/feature-flag.helpers';
import { isBookingEligibilityEnforcementEnabled } from '../../../scheduling/domain/booking-feature-flags';
import { UpdateAppointmentHandler } from '../../../scheduling/application/handlers/appointment.handlers';
import { BookingConcurrencyService } from '../../../scheduling/application/services/booking-concurrency.service';
import { ProviderEligibilityService } from '../../../scheduling/application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../../../scheduling/application/services/service-resource-requirement.service';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../../../scheduling/application/ports/scheduling-audit-log.port';

type BeautySessionRow = {
  id: string;
  type?: string;
  status?: string;
  scheduledAt?: string;
  clinicianId?: string;
  appointmentId?: string | null;
  notes?: string;
  /** Authoritative clinical service identity — required when eligibility enforcement ON. */
  clinicalServiceId?: string | null;
  /** Optional SchedulingResource IDs for requirement satisfaction. */
  resourceId?: string | null;
  resourceIds?: string[] | null;
};

const SESSION_DURATION_MS = 60 * 60 * 1000;

function normalizeBeautyResourceIds(session: BeautySessionRow): string[] {
  const fromArray = Array.isArray(session.resourceIds)
    ? session.resourceIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
    : [];
  const single = session.resourceId?.trim() ? [session.resourceId.trim()] : [];
  return [...new Set([...fromArray.map((id) => id.trim()), ...single].filter(Boolean))];
}

@Injectable()
export class BeautySessionSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly updateAppointment: UpdateAppointmentHandler,
    private readonly concurrency: BookingConcurrencyService,
    private readonly eligibility: ProviderEligibilityService,
    private readonly resources: ServiceResourceRequirementService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  /**
   * Bidirectional scheduling sync: beauty sessions ↔ appointments.
   *
   * Wave B bounded compatibility (NOT Wave E redesign):
   * - catalog.canonical.write OFF → LEGACY appointment create via booking concurrency
   * - catalog.canonical.write ON → fail closed on create (no silent LEGACY)
   * - booking.eligibility.enforcement is independent of canonical-write
   * - provider/tenant + clinical-service ownership are independent of eligibility
   * - clinicalServiceId bookings enforce ServiceResourceRequirementService
   * - existing Appointment scheduling mutations ALWAYS go through UpdateAppointmentHandler
   */
  async syncSessions(
    tenantId: string,
    branchId: string | null,
    patientId: string,
    previousSessions: BeautySessionRow[],
    nextSessions: BeautySessionRow[],
    authenticatedActorId: string,
  ): Promise<BeautySessionRow[]> {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException(
        'authenticatedActorId is required for beauty session scheduling sync',
      );
    }
    const actorId = authenticatedActorId.trim();
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
            const desiredServiceType = `beauty:${session.type ?? 'treatment'}`;
            const serviceIdentityChanged =
              (existing.serviceType ?? null) !== desiredServiceType;
            if (rescheduled || serviceIdentityChanged) {
              await this.rescheduleViaSchedulingCommand(
                existing,
                start,
                end,
                session.clinicianId,
                desiredServiceType,
                session.notes ?? existing.notes,
                actorId,
              );
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
              actorId,
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
            actorId,
          );
        } else {
          copy.appointmentId = prev.appointmentId;
        }
      } else if (session.appointmentId || prev?.appointmentId) {
        const apptId = session.appointmentId ?? prev?.appointmentId;
        if (apptId && (session.status === 'cancelled' || session.status === 'completed')) {
          await this.updateAppointment.execute(
            apptId,
            {
              action: session.status === 'cancelled' ? 'cancel' : 'complete',
              cancellationReason:
                session.status === 'cancelled' ? 'Beauty session cancelled' : undefined,
            },
            actorId,
          );
        }
        copy.appointmentId = apptId ?? null;
      }

      synced.push(copy);
      prevById.delete(session.id);
    }

    for (const removed of prevById.values()) {
      if (removed.appointmentId) {
        const existing = await this.prisma.appointment.findFirst({
          where: {
            id: removed.appointmentId,
            tenantId,
            deletedAt: null,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          },
        });
        if (existing) {
          await this.updateAppointment.execute(
            existing.id,
            { action: 'cancel', cancellationReason: 'Beauty session removed' },
            actorId,
          );
        }
      }
    }

    return synced;
  }

  private async rescheduleViaSchedulingCommand(
    existing: {
      id: string;
      snapshotWriteMode: string;
      serviceType: string | null;
      clinicalServiceId: string | null;
      tenantId: string;
    },
    start: Date,
    end: Date,
    providerId: string,
    serviceType: string,
    notes: string | null,
    actorId: string,
  ): Promise<void> {
    const featuresJson = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: existing.tenantId }, select: { features: true } }),
    );
    const canonicalWriteOn = isTenantCanonicalWriteEnabled(
      (featuresJson?.features as Record<string, unknown> | null) ?? null,
    );

    const isCanonical =
      String(existing.snapshotWriteMode) === 'CANONICAL_REQUIRED' || canonicalWriteOn;

    if (isCanonical) {
      if (existing.serviceType != null && existing.serviceType !== serviceType) {
        throw new BadRequestException(
          'Beauty sync cannot mutate canonical appointment serviceType/commercial identity (Wave E required)',
        );
      }
      await this.updateAppointment.execute(
        existing.id,
        {
          start: start.toISOString(),
          end: end.toISOString(),
          providerId,
          notes: notes ?? undefined,
        },
        actorId,
      );
      return;
    }

    await this.updateAppointment.execute(
      existing.id,
      {
        start: start.toISOString(),
        end: end.toISOString(),
        providerId,
        serviceType,
        notes: notes ?? undefined,
      },
      actorId,
    );
  }

  private async createAppointment(
    tenantId: string,
    branchId: string | null,
    patientId: string,
    session: BeautySessionRow,
    start: Date,
    end: Date,
    serviceType: string,
    actorId: string,
  ): Promise<string> {
    const features = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: tenantId }, select: { features: true } }),
    );
    const featuresJson = (features?.features as Record<string, unknown> | null) ?? null;
    const canonicalWriteOn = isTenantCanonicalWriteEnabled(featuresJson);
    if (canonicalWriteOn) {
      throw new BadRequestException(
        'Beauty session sync cannot create appointments while catalog.canonical.write is ON (Wave E canonical booking required; no silent LEGACY bypass)',
      );
    }

    const eligibilityOn = isBookingEligibilityEnforcementEnabled(featuresJson);
    const clinicalServiceId = session.clinicalServiceId?.trim() || null;
    if (eligibilityOn && !clinicalServiceId) {
      throw new BadRequestException(
        'clinicalServiceId is required for Beauty appointment create when booking.eligibility.enforcement is ON',
      );
    }

    const providerId = session.clinicianId!;
    const resourceIds = normalizeBeautyResourceIds(session);
    const id = randomUUID();

    await this.concurrency.withBookingTransaction(async (client) => {
      // Tenant isolation independent of eligibility enforcement.
      await this.eligibility.assertProviderBelongsToTenant(tenantId, providerId, client);
      if (clinicalServiceId) {
        await this.eligibility.assertClinicalServiceAccessible(
          tenantId,
          clinicalServiceId,
          client,
        );
      }

      await this.concurrency.assertSlotAvailableUnderLock(client, {
        tenantId,
        providerId,
        resourceIds,
        start,
        end,
      });

      if (eligibilityOn && clinicalServiceId) {
        await this.eligibility.assertEligible({
          tenantId,
          providerUserId: providerId,
          clinicalServiceId,
          branchId,
          at: start,
          client,
        });
      }

      if (clinicalServiceId) {
        await this.resources.assertRequirementsSatisfied({
          tenantId,
          clinicalServiceId,
          branchId,
          allocatedResourceIds: resourceIds,
          client,
        });
      } else if (resourceIds.length > 0) {
        await this.resources.assertAllocatedResourcesOwned({
          tenantId,
          branchId,
          allocatedResourceIds: resourceIds,
          client,
        });
      }

      await client.appointment.create({
        data: {
          id,
          tenantId,
          branchId,
          patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: 'PENDING',
          serviceType,
          notes: session.notes ?? `Beauty session ${session.id}`,
          clinicalServiceId,
          resourceId: resourceIds[0] ?? null,
          snapshotWriteMode: 'LEGACY',
        },
      });

      await this.concurrency.replaceResourceAllocations(client, {
        tenantId,
        appointmentId: id,
        resourceIds,
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId,
        action: 'scheduling.beauty.legacy_create',
        resourceId: id,
        actorId,
        actorRoles: [],
        descriptionEn: 'Beauty LEGACY appointment created under booking concurrency',
        descriptionAr: 'تم إنشاء موعد تجميل LEGACY تحت قفل الحجز',
        details: {
          appointmentId: id,
          providerId,
          clinicalServiceId,
          beautySessionId: session.id,
          resourceIds: resourceIds.join(','),
        },
      });
    });

    return id;
  }
}
