import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { CreateBeautyServiceCommand } from '../commands/create-beauty-service.command';
import { InMemoryBeautyServiceRepository } from '../../infrastructure/in-memory-beauty.repository';
import { BeautyService } from '../../domain/entities/beauty-service.entity';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { BeautyServiceScheduledEvent } from '../../domain/events/beauty-service-scheduled.event';

/**
 * @deprecated Legacy CQRS handler. Use {@link BeautyRecordService.createRecord} via `POST /beauty/record` instead.
 */
@Injectable()
export class CreateBeautyServiceHandler {
  constructor(
    private readonly repo: InMemoryBeautyServiceRepository,
    private readonly tenant: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisherInterface,
  ) {}

  async execute(cmd: CreateBeautyServiceCommand): Promise<{ serviceId: string }> {
    if (!cmd.patientId || !cmd.clinicianId) throw new BadRequestException('patientId and clinicianId are required');

    const tenantCtx = (await this.tenant.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const scheduled = new Date(cmd.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) throw new BadRequestException('scheduledAt is not a valid ISO datetime');

    const svc = BeautyService.create({
      patientId: cmd.patientId,
      clinicianId: cmd.clinicianId,
      serviceType: cmd.serviceType,
      scheduledAt: scheduled,
      notesEn: cmd.notesEn ?? null,
      notesAr: cmd.notesAr ?? null,
    });

    await this.repo.save(tenantId, svc);
    const evt = new BeautyServiceScheduledEvent(tenantId, svc.serviceId, svc.patientId, svc.clinicianId, svc.serviceType, svc.scheduledAt.toISOString());
    await this.publisher.publish(evt);

    return { serviceId: svc.serviceId };
  }
}
