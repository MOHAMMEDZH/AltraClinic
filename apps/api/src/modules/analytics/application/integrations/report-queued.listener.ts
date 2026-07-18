import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { ReportQueuedEvent } from '../../domain/events/report-queued.event';
import { AnalyticsReportGenerationService } from '../services/analytics-report-generation.service';

@Injectable()
export class ReportQueuedListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly generation: AnalyticsReportGenerationService,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof ReportQueuedEvent) {
      await this.generation.generateFromEvent(event);
    }
  }
}
