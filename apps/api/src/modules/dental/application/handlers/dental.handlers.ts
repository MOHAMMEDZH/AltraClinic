import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DentalEntryRepository } from '../../domain/dental-entry.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { DENTAL_RECORD_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { DentalOverviewService } from '../services/dental-overview.service';

@Injectable()
export class CreateDentalChartHandler {
  constructor(
    @Inject(DENTAL_RECORD_REPOSITORY) private readonly repo: DentalEntryRepository,
    private readonly overview: DentalOverviewService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const tenant = await this.tenantContext.resolve();
    const patient = await this.overview.assertPatientExists(tenant.tenantId, patientId);
    if (!patient) throw new NotFoundException('Patient not found');

    const existing = await this.repo.findByPatient(tenant.tenantId, patientId);
    if (existing) return existing.toJSON();

    const chart = this.overview.createEmptyChart(tenant.tenantId, patientId);
    await this.repo.save(chart);
    return chart.toJSON();
  }
}

@Injectable()
export class DentalMetricsHandler {
  constructor(
    private readonly overview: DentalOverviewService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.overview.getMetrics(tenant.tenantId);
  }
}

@Injectable()
export class DentalOverviewHandler {
  constructor(
    private readonly overview: DentalOverviewService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(limit?: number) {
    const tenant = await this.tenantContext.resolve();
    return this.overview.listOverview(tenant.tenantId, limit ?? 20);
  }
}

@Injectable()
export class UpdateDentalTeethHandler {
  constructor(
    @Inject(DENTAL_RECORD_REPOSITORY) private readonly repo: DentalEntryRepository,
    private readonly overview: DentalOverviewService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    patientId: string,
    teeth: { toothNumber: number; status: string; notes?: string | null; surfaces?: Record<string, string> }[],
  ) {
    const tenant = await this.tenantContext.resolve();
    if (!Array.isArray(teeth) || teeth.length === 0) {
      throw new BadRequestException('teeth updates are required');
    }

    const chart = await this.repo.findByPatient(tenant.tenantId, patientId);
    if (!chart) throw new NotFoundException('Dental chart not found');

    this.overview.updateTeeth(
      chart,
      teeth.map((t) => ({
        toothNumber: t.toothNumber,
        status: t.status as never,
        notes: t.notes,
        surfaces: t.surfaces,
      })),
    );
    await this.repo.save(chart);
    return chart.toJSON();
  }
}
