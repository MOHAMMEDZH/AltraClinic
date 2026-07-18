import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { DentalExtendedService } from '../services/dental-extended.service';
import {
  CreateDentalClinicalNoteDTO,
  CreateImplantRecordDTO,
  CreateOrthodonticCaseDTO,
  UpdateImplantRecordDTO,
  UpdateOdontogramModeDTO,
  UpdateOrthodonticCaseDTO,
} from '../dto/dental-extended.dto';
import { CreateInvoiceHandler } from '../../../billing/application/handlers/create-invoice.handler';
import { TreatmentPlanService } from '../services/treatment-plan.service';
import { randomUUID } from 'crypto';

@Injectable()
export class DentalPatientSummaryHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.getPatientSummary(tenant.tenantId, patientId);
  }
}

@Injectable()
export class DentalTimelineHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string, limit?: number) {
    const tenant = await this.tenantContext.resolve();
    return this.service.getTimeline(tenant.tenantId, patientId, limit ?? 50);
  }
}

@Injectable()
export class ListOrthodonticCasesHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.listOrthoCases(tenant.tenantId, patientId);
  }
}

@Injectable()
export class CreateOrthodonticCaseHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, body: CreateOrthodonticCaseDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.createOrthoCase(tenant.tenantId, userId, body);
  }
}

@Injectable()
export class UpdateOrthodonticCaseHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(caseId: string, body: UpdateOrthodonticCaseDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.updateOrthoCase(tenant.tenantId, caseId, body);
  }
}

@Injectable()
export class ListImplantRecordsHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.listImplants(tenant.tenantId, patientId);
  }
}

@Injectable()
export class CreateImplantRecordHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, body: CreateImplantRecordDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.createImplant(tenant.tenantId, userId, body);
  }
}

@Injectable()
export class UpdateImplantRecordHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(implantId: string, body: UpdateImplantRecordDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.updateImplant(tenant.tenantId, implantId, body);
  }
}

@Injectable()
export class ListDentalClinicalNotesHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.service.listNotes(tenant.tenantId, patientId);
  }
}

@Injectable()
export class CreateDentalClinicalNoteHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, body: CreateDentalClinicalNoteDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.createNote(tenant.tenantId, userId, body);
  }
}

@Injectable()
export class UpdateOdontogramModeHandler {
  constructor(
    private readonly service: DentalExtendedService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string, body: UpdateOdontogramModeDTO) {
    const tenant = await this.tenantContext.resolve();
    return this.service.updateChartMode(tenant.tenantId, patientId, body.mode);
  }
}

@Injectable()
export class CreateTreatmentPlanInvoiceHandler {
  constructor(
    private readonly planService: TreatmentPlanService,
    private readonly createInvoice: CreateInvoiceHandler,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string) {
    const tenant = await this.tenantContext.resolve();
    const plan = await this.planService.getById(tenant.tenantId, planId);

    const lineItems: { description: string; quantity: number; unitPrice: number }[] = [];
    for (const phase of plan.phases ?? []) {
      for (const item of phase.items ?? []) {
        if (item.status === 'cancelled') continue;
        const price = item.patientPortion ?? item.estimatedCost ?? 0;
        if (price <= 0) continue;
        lineItems.push({
          description: `${item.code} — ${item.description}`,
          quantity: 1,
          unitPrice: price,
        });
      }
    }

    if (lineItems.length === 0) {
      lineItems.push({
        description: plan.title,
        quantity: 1,
        unitPrice: plan.totalEstimatedCost ?? 0,
      });
    }

    const invoiceNumber = `TP-${planId.slice(0, 8).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
    const result = await this.createInvoice.execute({
      patientId: plan.patientId,
      invoiceNumber,
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: null,
      currency: plan.currency ?? 'USD',
      notes: `Generated from treatment plan: ${plan.title}`,
      lineItems,
      requireActiveSubscription: false,
    });

    return { ...result, planId, patientId: plan.patientId };
  }
}
