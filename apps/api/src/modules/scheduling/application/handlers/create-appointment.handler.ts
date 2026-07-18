import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAppointmentCommand } from '../commands/create-appointment.command';
import { Appointment } from '../../domain/appointment.entity';
import { TimeSlotVO } from '../../domain/timeslot.vo';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { APPOINTMENT_REPOSITORY, EVENT_PUBLISHER, PATIENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AppointmentScheduledEvent } from '../../domain/events/appointment-scheduled.event';
import { PatientRepository } from '../../../patients/domain/patient.repository.interface';
import { generateEntityId } from '../../../../common/id-generator.util';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { AnalyticsAggregationService } from '../../../../infrastructure/redis/services/analytics-aggregation.service';
import { advanceRecurrenceDate } from '../../domain/recurrence.util';

@Injectable()
export class CreateAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
    private readonly analytics: AnalyticsAggregationService,
  ) {}

  async execute(cmd: CreateAppointmentCommand) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenant context could not be resolved');
    }
    if (!cmd.patientId?.trim()) {
      throw new BadRequestException('patientId is required');
    }
    if (!cmd.providerId?.trim()) {
      throw new BadRequestException('providerId is required');
    }

    const patient = await this.patientRepository.findById(cmd.patientId, tenantId);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const occurrenceCount = cmd.recurrence
      ? Math.min(Math.max(cmd.recurrence.occurrences, 2), 52)
      : 1;
    const seriesId = occurrenceCount > 1 ? generateEntityId('recurrence') : null;
    const createdIds: string[] = [];

    let slotStart = new Date(cmd.start);
    let slotEnd = new Date(cmd.end);
    const durationMs = slotEnd.getTime() - slotStart.getTime();

    for (let i = 0; i < occurrenceCount; i += 1) {
      await this.enforcement.enforceAppointmentLimit(tenantId);

      const startIso = slotStart.toISOString();
      const endIso = slotEnd.toISOString();
      const slot = new TimeSlotVO(startIso, endIso);
      const conflict = await this.repo.findByProviderAndSlot(cmd.providerId, slot, tenantId);
      if (conflict) {
        throw new ConflictException(
          occurrenceCount > 1
            ? `Slot not available for occurrence ${i + 1}`
            : 'Slot not available',
        );
      }
      if (cmd.resourceId) {
        const resourceConflict = await this.repo.findByResourceAndSlot(cmd.resourceId, slot, tenantId);
        if (resourceConflict) {
          throw new ConflictException(
            occurrenceCount > 1
              ? `Resource not available for occurrence ${i + 1}`
              : 'Resource not available',
          );
        }
      }

      const appt = new Appointment(
        generateEntityId('appointment'),
        tenantId,
        tenant.branchId ?? null,
        cmd.patientId,
        cmd.providerId,
        slot,
        undefined,
        undefined,
        cmd.notes ?? null,
        undefined,
        cmd.serviceType ?? null,
        cmd.isEmergency ?? false,
        seriesId,
        cmd.resourceId ?? null,
      );
      await this.repo.save(appt);
      createdIds.push(appt.id);
      await this.eventPublisher.publish(
        new AppointmentScheduledEvent(
          tenantId,
          tenant.branchId ?? null,
          appt.id,
          cmd.patientId,
          cmd.providerId,
          startIso,
          endIso,
        ),
      );
      this.analytics.incrementAppointments(tenantId).catch(() => undefined);

      if (cmd.recurrence && i < occurrenceCount - 1) {
        slotStart = advanceRecurrenceDate(slotStart, cmd.recurrence.frequency);
        slotEnd = new Date(slotStart.getTime() + durationMs);
      }
    }

    return {
      appointmentId: createdIds[0],
      appointmentIds: createdIds,
      seriesId,
    };
  }
}
