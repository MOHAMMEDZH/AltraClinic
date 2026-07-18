import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTreatmentCommand } from '../commands/create-treatment.command';
import { DentalEntryRepository } from '../../domain/dental-entry.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, DENTAL_RECORD_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { DentalProcedure } from '../../domain/dental-procedure.entity';
import { DentalChartUpdatedEvent } from '../../domain/events/dental-chart-updated.event';

function genId() {
  return typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `dproc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable()
export class CreateTreatmentHandler {
  constructor(
    @Inject(DENTAL_RECORD_REPOSITORY) private readonly repo: DentalEntryRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(cmd: CreateTreatmentCommand) {
    const tenant = await this.tenantContext.resolve();
    if (!cmd.patientId) throw new BadRequestException('patientId is required');
    if (!Array.isArray(cmd.procedures) || cmd.procedures.length === 0) throw new BadRequestException('procedures are required');

    const chart = await this.repo.findByPatient(tenant.tenantId, cmd.patientId);
    if (!chart) throw new NotFoundException('Dental chart not found for patient');

    // validate procedures
    for (const p of cmd.procedures) {
      if (!p.code || !p.description) throw new BadRequestException('procedure code and description are required');
      if (!Array.isArray(p.toothNumbers) || p.toothNumbers.some((tn) => typeof tn !== 'number' || tn < 1 || tn > 32)) {
        throw new BadRequestException('toothNumbers must be numbers between 1 and 32');
      }
      const id = genId();
      const proc = new DentalProcedure(id, p.code, p.description, p.toothNumbers, new Date().toISOString(), cmd.providerId);
      chart.applyProcedure(proc);
    }

    await this.repo.save(chart);
    await this.eventPublisher.publish(new DentalChartUpdatedEvent(tenant.tenantId, cmd.patientId, chart.id, { procedures: cmd.procedures }));
    return { chartId: chart.id };
  }
}
