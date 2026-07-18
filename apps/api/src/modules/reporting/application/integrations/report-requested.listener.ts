import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { ReportRequestedEvent } from '../../domain/events/report-requested.event';
import { OperationalReportGenerationService } from '../services/operational-report-generation.service';

@Injectable()
export class ReportRequestedListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly generation: OperationalReportGenerationService,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof ReportRequestedEvent) {
      await this.generation.generateFromEvent(event);
    }
  }
}
