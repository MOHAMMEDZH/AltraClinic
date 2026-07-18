import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { BeautyExtendedService } from '../services/beauty-extended.service';

@Injectable()
export class BeautyPatientSummaryHandler {
  constructor(
    private readonly service: BeautyExtendedService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    return this.service.getPatientSummary(ctx.tenantId, patientId);
  }
}

@Injectable()
export class BeautyTimelineHandler {
  constructor(
    private readonly service: BeautyExtendedService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(patientId: string, limit?: number) {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    return this.service.getTimeline(ctx.tenantId, patientId, limit ?? 50);
  }
}

@Injectable()
export class UpdateBeautyAnnotationHandler {
  constructor(
    private readonly service: BeautyExtendedService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(
    annotationId: string,
    body: {
      zone?: string;
      treatment?: string;
      parameters?: Record<string, unknown>;
      notes?: string | null;
    },
  ) {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    return this.service.updateAnnotation(ctx.tenantId, annotationId, body);
  }
}

@Injectable()
export class DeleteBeautyAnnotationHandler {
  constructor(
    private readonly service: BeautyExtendedService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(annotationId: string) {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    return this.service.deleteAnnotation(ctx.tenantId, annotationId);
  }
}
