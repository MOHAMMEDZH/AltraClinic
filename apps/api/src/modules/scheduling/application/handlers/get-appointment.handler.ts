import { Inject, Injectable } from '@nestjs/common';
import { GetAppointmentQuery } from '../queries/get-appointment.query';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class GetAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetAppointmentQuery) {
    const tenant = await this.tenantContext.resolve();
    return this.repo.findDetailById(query.id, tenant.tenantId);
  }
}
