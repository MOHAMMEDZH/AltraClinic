import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EmrLabService } from '../services/emr-lab.service';
import { EmrNoteTemplateService } from '../services/emr-note-template.service';
import { EmrTreatmentPlanService } from '../services/emr-treatment-plan.service';
import { EmrBillingService } from '../services/emr-billing.service';
import { EmrDrugInteractionService } from '../services/emr-drug-interaction.service';
import { TreatmentPlanService } from '../../../dental/application/services/treatment-plan.service';
import { TreatmentPlanItemStatus } from '@prisma/client';
import { EmrEncounterService } from '../services/emr-encounter.service';
import { EmrEventService } from '../services/emr-event.service';
import type { SoapNotes, StructuredClinicalNote } from '../../domain/emr.types';

@Injectable()
export class ListLabResultsHandler {
  constructor(
    private readonly labs: EmrLabService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string, encounterId?: string) {
    const tenant = await this.tenantContext.resolve();
    return this.labs.listForPatient(tenant.tenantId, patientId, encounterId);
  }
}

@Injectable()
export class CreateLabResultHandler {
  constructor(
    private readonly labs: EmrLabService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    patientId: string,
    input: {
      encounterId?: string | null;
      testName: string;
      value: string;
      unit?: string | null;
      referenceRange?: string | null;
      status?: string | null;
      resultedAt: string;
      notes?: string | null;
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    return this.labs.create(tenant.tenantId, { ...input, patientId });
  }
}

@Injectable()
export class ListNoteTemplatesHandler {
  constructor(
    private readonly templates: EmrNoteTemplateService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(activeOnly = true) {
    const tenant = await this.tenantContext.resolve();
    return activeOnly
      ? this.templates.list(tenant.tenantId)
      : this.templates.listAll(tenant.tenantId);
  }
}

@Injectable()
export class CreateNoteTemplateHandler {
  constructor(
    private readonly templates: EmrNoteTemplateService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(input: {
    name: string;
    noteType: string;
    soapNotes?: SoapNotes;
    body?: string | null;
    sortOrder?: number;
  }) {
    const tenant = await this.tenantContext.resolve();
    return this.templates.create(tenant.tenantId, input);
  }
}

@Injectable()
export class UpdateNoteTemplateHandler {
  constructor(
    private readonly templates: EmrNoteTemplateService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    id: string,
    input: {
      name?: string;
      noteType?: string;
      soapNotes?: SoapNotes;
      body?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    return this.templates.update(tenant.tenantId, id, input);
  }
}

@Injectable()
export class DeleteNoteTemplateHandler {
  constructor(
    private readonly templates: EmrNoteTemplateService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    await this.templates.remove(tenant.tenantId, id);
    return { ok: true };
  }
}

@Injectable()
export class ListPatientTreatmentPlansHandler {
  constructor(
    private readonly plans: EmrTreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.plans.listForPatient(tenant.tenantId, patientId);
  }
}

@Injectable()
export class GetEncounterBillingHandler {
  constructor(
    private readonly billing: EmrBillingService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(encounterId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.billing.getEncounterBilling(tenant.tenantId, encounterId);
  }
}

@Injectable()
export class UpdateStructuredNotesHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, notes: StructuredClinicalNote[], actorUserId?: string) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.updateStructuredNotes(id, tenant.tenantId, notes);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'structured_notes_updated',
      actorUserId: actorUserId ?? null,
      metadata: { count: notes.length },
    });
    return updated;
  }
}

@Injectable()
export class RecordMedicationRefillHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, medicationIndex: number, actorUserId?: string) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.recordMedicationRefill(id, tenant.tenantId, medicationIndex);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'medication_refill',
      actorUserId: actorUserId ?? null,
      metadata: { medicationIndex },
    });
    return updated;
  }
}

@Injectable()
export class CheckDrugInteractionsHandler {
  constructor(private readonly drugs: EmrDrugInteractionService) {}

  async execute(medications: string[], allergies: string[] = []) {
    return this.drugs.check(medications, allergies);
  }
}

@Injectable()
export class CoSignEncounterHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, actorUserId: string) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.coSignEncounter(id, tenant.tenantId, actorUserId);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'co_signed',
      actorUserId,
    });
    return updated;
  }
}

@Injectable()
export class CreateEmrTreatmentPlanHandler {
  constructor(
    private readonly plans: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    userId: string,
    input: {
      patientId: string;
      title: string;
      clinicalNotes?: string | null;
      items?: Array<{ code: string; description: string; estimatedCost?: number }>;
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    return this.plans.create(tenant.tenantId, userId, {
      patientId: input.patientId,
      title: input.title,
      clinicalNotes: input.clinicalNotes,
      phases: [
        {
          name: 'Care plan',
          sortOrder: 0,
          visitNumber: 1,
          items: (input.items ?? []).map((item) => ({
            code: item.code,
            description: item.description,
            estimatedCost: item.estimatedCost ?? 0,
            estimatedMinutes: 30,
          })),
        },
      ],
    });
  }
}

@Injectable()
export class UpdateEmrTreatmentPlanHandler {
  constructor(
    private readonly plans: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    planId: string,
    input: {
      title?: string;
      clinicalNotes?: string | null;
      items?: Array<{ id?: string; code: string; description: string; estimatedCost?: number; status?: string }>;
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.plans.getById(tenant.tenantId, planId);
    const phase = existing.phases?.[0];
    return this.plans.update(tenant.tenantId, planId, {
      title: input.title,
      clinicalNotes: input.clinicalNotes,
      phases: phase
        ? [
            {
              id: phase.id,
              name: phase.name,
              sortOrder: phase.sortOrder,
              items: (input.items ?? []).map((item) => ({
                id: item.id,
                code: item.code,
                description: item.description,
                estimatedCost: item.estimatedCost ?? 0,
                estimatedMinutes: 30,
                status: item.status
                  ? (item.status.toUpperCase().replace(/-/g, '_') as TreatmentPlanItemStatus)
                  : undefined,
              })),
            },
          ]
        : undefined,
    });
  }
}

@Injectable()
export class UpdateEmrTreatmentItemStatusHandler {
  constructor(
    private readonly plans: TreatmentPlanService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(planId: string, itemId: string, userId: string, status: string) {
    const tenant = await this.tenantContext.resolve();
    return this.plans.updateItemStatus(
      tenant.tenantId,
      planId,
      itemId,
      userId,
      status.toUpperCase().replace(/-/g, '_') as TreatmentPlanItemStatus,
    );
  }
}
