import { Inject, Injectable } from '@nestjs/common';
import { GetDentalChartQuery } from '../queries/get-dental-chart.query';
import { DentalEntryRepository } from '../../domain/dental-entry.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { DENTAL_RECORD_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class GetDentalChartHandler {
  constructor(@Inject(DENTAL_RECORD_REPOSITORY) private readonly repo: DentalEntryRepository, private readonly tenantContext: TenantContextService) {}

  async execute(q: GetDentalChartQuery) {
    const tenant = await this.tenantContext.resolve();
    const chart = await this.repo.findByPatient(tenant.tenantId, q.patientId);
    return chart ? chart.toJSON() : null;
  }
}
