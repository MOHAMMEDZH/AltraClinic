import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EmrEncounterService } from '../services/emr-encounter.service';
import { EmrEventService } from '../services/emr-event.service';

@Injectable()
export class ListEncountersHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    q?: string;
    patientId?: string;
    clinicianId?: string;
    appointmentId?: string;
    from?: string;
    to?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    return this.emr.list({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      patientId: query.patientId,
      clinicianId: query.clinicianId,
      appointmentId: query.appointmentId,
      from: query.from,
      to: query.to,
      status: query.status,
      q: query.q,
      limit,
      offset,
    });
  }
}

@Injectable()
export class EmrMetricsHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.emr.getMetrics(tenant.tenantId, tenant.branchId ?? null);
  }
}

@Injectable()
export class UpdateEncounterHandler {
  constructor(
    private readonly emr: EmrEncounterService,
    private readonly events: EmrEventService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    id: string,
    input: {
      chiefComplaint?: string | null;
      clinicalNotes?: string | null;
      followUpDate?: string | null;
      diagnoses?: { code: string; description: string }[];
      medications?: {
        name: string;
        dose?: string | null;
        route?: string | null;
        frequency?: string | null;
      }[];
      observations?: { type: string; value: string; unit?: string }[];
      appointmentId?: string | null;
    },
    actorUserId?: string | null,
  ) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.emr.updateClinical(id, tenant.tenantId, input);
    if (!updated) throw new NotFoundException('Encounter not found');
    await this.events.record({
      tenantId: tenant.tenantId,
      encounterId: id,
      action: 'updated',
      actorUserId: actorUserId ?? null,
    });
    return updated;
  }
}
