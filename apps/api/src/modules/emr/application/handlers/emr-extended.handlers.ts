import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EmrEncounterService } from '../services/emr-encounter.service';
import { EmrEventService } from '../services/emr-event.service';
import { EmrProblemService } from '../services/emr-problem.service';
import type { ObservationRecord, SoapNotes } from '../../domain/emr.types';

@Injectable()
export class CompleteEncounterHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, actorUserId?: string) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.completeEncounter(id, tenant.tenantId, actorUserId ?? null);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'completed',
      actorUserId: actorUserId ?? null,
    });
    return updated;
  }
}

@Injectable()
export class SignEncounterHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, actorUserId: string) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.signEncounter(id, tenant.tenantId, actorUserId);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'signed',
      actorUserId,
    });
    return updated;
  }
}

@Injectable()
export class AppendVitalsHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, observations: ObservationRecord[], actorUserId?: string) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.appendVitals(id, tenant.tenantId, observations, actorUserId ?? null);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'vitals_recorded',
      actorUserId: actorUserId ?? null,
      metadata: { count: observations.length },
    });
    return updated;
  }
}

@Injectable()
export class GetEncounterAuditHandler {
  constructor(
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(encounterId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.events.listForEncounter(tenant.tenantId, encounterId);
  }
}

@Injectable()
export class EmrClinicalSearchHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(q: string, limit?: number) {
    const tenant = await this.tenantContext.resolve();
    return this.emr.clinicalSearch(tenant.tenantId, tenant.branchId ?? null, q, limit);
  }
}

@Injectable()
export class ListPatientProblemsHandler {
  constructor(
    private readonly problems: EmrProblemService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string, status?: string) {
    const tenant = await this.tenantContext.resolve();
    return this.problems.list(tenant.tenantId, patientId, status);
  }
}

@Injectable()
export class CreatePatientProblemHandler {
  constructor(
    private readonly problems: EmrProblemService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    patientId: string,
    input: { code?: string | null; codingSystem?: string | null; description: string; onsetDate?: string | null },
  ) {
    const tenant = await this.tenantContext.resolve();
    return this.problems.create(tenant.tenantId, patientId, input);
  }
}

@Injectable()
export class ResolvePatientProblemHandler {
  constructor(
    private readonly problems: EmrProblemService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(problemId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.problems.resolve(tenant.tenantId, problemId);
  }
}

@Injectable()
export class EmrDashboardHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.emr.getDashboard(tenant.tenantId, tenant.branchId ?? null);
  }
}

@Injectable()
export class UpdateSoapNotesHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, soap: SoapNotes, actorUserId?: string) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.updateSoapNotes(id, tenant.tenantId, soap);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'soap_updated',
      actorUserId: actorUserId ?? null,
    });
    return updated;
  }
}

@Injectable()
export class GetPrescriptionHistoryHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.emr.getPrescriptionHistory(tenant.tenantId, patientId);
  }
}
