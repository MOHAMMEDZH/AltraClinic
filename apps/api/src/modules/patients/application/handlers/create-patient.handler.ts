import { Inject, Injectable } from '@nestjs/common';
import { CreatePatientCommand } from '../commands/create-patient.command';
import { Patient } from '../../domain/patient.entity';
import { PatientNameVO } from '../../domain/patient-name.vo';
import { AddressVO } from '../../domain/address.vo';
import { PatientRepository } from '../../domain/patient.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PATIENT_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PatientRegisteredEvent } from '../../domain/events/patient-registered.event';
import { generateEntityId } from '../../../../common/id-generator.util';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { AnalyticsAggregationService } from '../../../../infrastructure/redis/services/analytics-aggregation.service';

@Injectable()
export class CreatePatientHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
    private readonly analytics: AnalyticsAggregationService,
  ) {}

  async execute(cmd: CreatePatientCommand) {
    const tenant = await this.tenantContext.resolve();
    await this.enforcement.enforcePatientLimit(tenant.tenantId);

    const id = generateEntityId('patient');
    const name = new PatientNameVO(cmd.firstName, cmd.lastName);
    const addr =
      cmd.addressLine1 && cmd.city
        ? [new AddressVO(cmd.addressLine1, cmd.city, cmd.state ?? null, cmd.postalCode ?? null, cmd.country ?? null)]
        : [];

    const patient = new Patient(
      id,
      tenant.tenantId,
      tenant.branchId ?? null,
      name,
      cmd.dateOfBirth ?? null,
      cmd.gender ?? null,
      addr,
    );
    patient.firstNameAr = cmd.firstNameAr ?? null;
    patient.lastNameAr = cmd.lastNameAr ?? null;
    patient.phone = cmd.phone ?? null;
    patient.email = cmd.email?.toLowerCase() ?? null;
    patient.nationalId = cmd.nationalId ?? null;
    patient.bloodGroup = cmd.bloodGroup ?? null;
    patient.notes = cmd.notes ?? null;
    patient.profileData = cmd.profileData ?? {};

    await this.repo.save(patient);
    this.analytics.incrementNewPatients(tenant.tenantId).catch(() => undefined);
    await this.eventPublisher.publish(
      new PatientRegisteredEvent(
        tenant.tenantId,
        tenant.branchId ?? null,
        id,
        name.fullName,
        cmd.gender ?? null,
        cmd.dateOfBirth ?? null,
      ),
    );
    return { patientId: id };
  }
}
