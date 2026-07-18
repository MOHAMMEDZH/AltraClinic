import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetEncounterQuery } from '../queries/get-encounter.query';
import { EmrEncounterService } from '../services/emr-encounter.service';
import { EMRRepository } from '../../domain/emr.repository.interface';
import { ENCOUNTER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

@Injectable()
export class GetEncounterHandler {
  constructor(
    @Inject(ENCOUNTER_REPOSITORY) private readonly repo: EMRRepository,
    private readonly emrService: EmrEncounterService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetEncounterQuery) {
    const tenant = await this.tenantContext.resolve();
    const detail = await this.emrService.findDetail(query.id, tenant.tenantId);
    if (!detail) {
      const legacy = await this.repo.findEncounterById(query.id, tenant.tenantId);
      if (!legacy) return null;
      return {
        id: legacy.id,
        patientId: legacy.patientId,
        clinicianId: legacy.clinicianId,
        diagnoses: legacy.diagnoses.map((d) => ({ code: d.code, description: d.description })),
        medications: legacy.medications.map((m) => ({
          name: m.name,
          dose: m.dose,
          route: m.route,
          frequency: m.frequency,
        })),
        observations: legacy.observations.map((o) => ({ type: o.type, value: o.value, unit: o.unit })),
        tenantId: legacy.tenantId,
        branchId: legacy.branchId,
        createdAt: legacy.createdAt,
      };
    }
    return detail;
  }
}
