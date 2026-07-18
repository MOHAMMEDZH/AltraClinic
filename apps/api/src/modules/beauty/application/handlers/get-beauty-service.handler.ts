import { Injectable } from '@nestjs/common';
import { GetBeautyServiceQuery } from '../queries/get-beauty-service.query';
import { InMemoryBeautyServiceRepository } from '../../infrastructure/in-memory-beauty.repository';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

/**
 * @deprecated Legacy CQRS handler. Use {@link BeautyRecordService.getRecord} via `GET /beauty/record/:patientId` instead.
 */
@Injectable()
export class GetBeautyServiceHandler {
  constructor(private readonly repo: InMemoryBeautyServiceRepository, private readonly tenant: TenantContextService) {}

  async execute(query: GetBeautyServiceQuery) {
    const tenantCtx = await this.tenant.resolve();
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) return null;
    if (query.id) return await this.repo.findById(tenantId, query.id);
    if (query.patientId) return await this.repo.findByPatient(tenantId, query.patientId);
    return null;
  }
}
