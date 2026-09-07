import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { AppointmentCancelledEvent } from '../../domain/events/appointment-cancelled.event';
import { WaitlistOfferAutofillService } from '../services/waitlist-offer-autofill.service';

/**
 * Wave G2 — cancel → offer/TTL (or policy auto-book). Replaces notify-only as primary fulfillment path.
 */
@Injectable()
export class AppointmentCancelledWaitlistListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly autofill: WaitlistOfferAutofillService,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (!(event instanceof AppointmentCancelledEvent)) return;
    await this.autofill.handleCancelledAppointment(event);
  }
}
