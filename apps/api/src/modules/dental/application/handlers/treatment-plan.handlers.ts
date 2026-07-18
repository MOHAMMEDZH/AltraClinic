import { BadRequestException, Injectable } from '@nestjs/common';
import { TreatmentPlanItemStatus } from '@prisma/client';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TreatmentPlanService } from '../services/treatment-plan.service';
import {
  CreateTreatmentPlanDTO,
  RecordConsentDTO,
  UpdateItemStatusDTO,
  UpdateTreatmentPlanDTO,
} from '../dto/treatment-plan.dto';

function mapItemStatus(status?: string): TreatmentPlanItemStatus | undefined {
  if (!status) return undefined;
  return status.toUpperCase().replace(/-/g, '_') as TreatmentPlanItemStatus;
}

function mapPhases(phases?: CreateTreatmentPlanDTO['phases']) {
  return phases?.map((p) => ({
    ...p,
    items: p.items?.map((i) => ({ ...i, status: mapItemStatus(i.status) })),
  }));
}

@Injectable()
export class ListTreatmentPlansHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: { patientId?: string; status?: string }) {
    const tenant = await this.tenantContext.resolve();
    return this.service.list(tenant.tenantId, query);
  }
}

@Injectable()
export class GetTreatmentPlanHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.getById(tenant.tenantId, planId);
  }
}

@Injectable()
export class CreateTreatmentPlanHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, body: CreateTreatmentPlanDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.create(tenant.tenantId, userId, {
      ...body,
      phases: mapPhases(body.phases),
    });
  }
}

@Injectable()
export class UpdateTreatmentPlanHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string, body: UpdateTreatmentPlanDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.update(tenant.tenantId, planId, {
      ...body,
      phases: mapPhases(body.phases),
    });
  }
}

@Injectable()
export class SubmitTreatmentPlanHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string, userId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.submitForApproval(tenant.tenantId, planId, userId);
  }
}

@Injectable()
export class ApproveTreatmentPlanHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string, userId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.approve(tenant.tenantId, planId, userId);
  }
}

@Injectable()
export class RecordTreatmentConsentHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string, userId: string, body: RecordConsentDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.recordConsent(tenant.tenantId, planId, userId, body);
  }
}

@Injectable()
export class UpdateTreatmentItemStatusHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string, itemId: string, userId: string, body: UpdateItemStatusDTO) {
    const tenant = await this.tenantContext.resolve();
    const status = mapItemStatus(body.status);
    if (!status) throw new BadRequestException('Invalid status');
    return this.service.updateItemStatus(tenant.tenantId, planId, itemId, status, userId);
  }
}

@Injectable()
export class TreatmentPlanAnalyticsHandler {
  constructor(
    private readonly service: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.service.getAnalytics(tenant.tenantId);
  }
}
