import { Injectable } from '@nestjs/common';
import { GetPatientQuery } from '../queries/get-patient.query';
import { PatientRepository } from '../../domain/patient.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { Inject } from '@nestjs/common';
import { PATIENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class GetPatientHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetPatientQuery) {
    const tenant = await this.tenantContext.resolve();
    const detail = await this.repo.findDetailById(query.id, tenant.tenantId);
    if (!detail) return null;
    return detail;
  }
}
