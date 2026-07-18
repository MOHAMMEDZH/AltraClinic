import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEncounterCommand } from '../commands/create-encounter.command';
import { EVENT_PUBLISHER, PATIENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EncounterCreatedEvent } from '../../domain/events/encounter-created.event';
import { PatientRepository } from '../../../patients/domain/patient.repository.interface';
import { EmrEncounterService } from '../services/emr-encounter.service';
import { EmrEventService } from '../services/emr-event.service';

@Injectable()
export class CreateEncounterHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(cmd: CreateEncounterCommand, actorUserId?: string | null) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenant context could not be resolved');
    }
    if (!cmd.patientId?.trim()) {
      throw new BadRequestException('patientId is required');
    }
    if (!cmd.clinicianId?.trim()) {
      throw new BadRequestException('clinicianId is required');
    }

    const patient = await this.patientRepository.findById(cmd.patientId, tenantId);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const detail = await this.emr.create(tenantId, tenant.branchId ?? null, {
      patientId: cmd.patientId,
      clinicianId: cmd.clinicianId,
      chiefComplaint: cmd.chiefComplaint,
      clinicalNotes: cmd.clinicalNotes,
      appointmentId: cmd.appointmentId,
      followUpDate: cmd.followUpDate,
      diagnoses: cmd.diagnoses ?? [],
      medications: (cmd.medications ?? []).map((m) => ({
        name: m.name,
        dose: m.dose ?? null,
        route: m.route ?? null,
        frequency: m.frequency ?? null,
      })),
      observations: cmd.observations ?? [],
    });

    await this.events.record({
      tenantId,
      encounterId: detail.id,
      action: 'created',
      actorUserId: actorUserId ?? cmd.clinicianId,
    });

    await this.eventPublisher.publish(
      new EncounterCreatedEvent(tenantId, tenant.branchId ?? null, detail.id, cmd.patientId, cmd.clinicianId),
    );

    return { encounterId: detail.id };
  }
}
