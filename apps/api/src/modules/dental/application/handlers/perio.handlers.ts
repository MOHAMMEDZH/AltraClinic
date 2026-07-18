import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { CreatePeriodontalExamDTO, UpdatePeriodontalExamDTO } from '../dto/perio.dto';
import { PeriodontalService } from '../services/periodontal.service';

@Injectable()
export class ListPeriodontalExamsHandler {
  constructor(
    private readonly service: PeriodontalService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.listExams(tenant.tenantId, patientId);
  }
}

@Injectable()
export class GetPeriodontalExamHandler {
  constructor(
    private readonly service: PeriodontalService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(examId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.getExam(tenant.tenantId, examId);
  }
}

@Injectable()
export class CreatePeriodontalExamHandler {
  constructor(
    private readonly service: PeriodontalService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string, userId: string, body: CreatePeriodontalExamDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.createExam(tenant.tenantId, userId, patientId, body);
  }
}

@Injectable()
export class UpdatePeriodontalExamHandler {
  constructor(
    private readonly service: PeriodontalService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(examId: string, body: UpdatePeriodontalExamDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.updateExam(tenant.tenantId, examId, body);
  }
}

@Injectable()
export class PeriodontalProgressHandler {
  constructor(
    private readonly service: PeriodontalService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.getProgress(tenant.tenantId, patientId);
  }
}

@Injectable()
export class ComparePeriodontalExamsHandler {
  constructor(
    private readonly service: PeriodontalService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(baselineExamId: string, compareExamId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.compareExams(tenant.tenantId, baselineExamId, compareExamId);
  }
}
