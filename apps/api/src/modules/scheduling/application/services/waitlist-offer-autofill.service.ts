import { Injectable, Logger } from '@nestjs/common';
import {
  AppointmentStatus as PrismaAppointmentStatus,
  WaitlistOfferStatus,
  WaitlistStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { AppointmentCancelledEvent } from '../../domain/events/appointment-cancelled.event';
import { isWaitlistAutoBookEnabled } from '../../domain/booking-feature-flags';
import {
  computeOfferExpiresAt,
  DEFAULT_WAITLIST_OFFER_TTL_MINUTES,
} from '../../domain/waitlist-offer.lifecycle';
import { BookingConcurrencyService } from './booking-concurrency.service';

const PRODUCER_MODULE_ID = 'scheduling.waitlist-offer-autofill';

/**
 * Wave G2 / P1-10 — cancel → offer(+TTL) / optional auto-book under policy.
 * Default: auto_book OFF → create PENDING offers + notify (no appointment).
 */
@Injectable()
export class WaitlistOfferAutofillService {
  private readonly logger = new Logger(WaitlistOfferAutofillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
    private readonly concurrency: BookingConcurrencyService,
  ) {}

  async handleCancelledAppointment(event: AppointmentCancelledEvent): Promise<{
    offersCreated: number;
    autoBookedAppointmentId: string | null;
  }> {
    const slotStart = new Date(event.start);
    const slotEnd = new Date(event.end);
    const durationMs = slotEnd.getTime() - slotStart.getTime();
    if (!(durationMs > 0) || !event.providerId) {
      return { offersCreated: 0, autoBookedAppointmentId: null };
    }

    const featuresRow = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: event.tenantId }, select: { features: true } }),
    );
    const features = (featuresRow?.features as Record<string, unknown> | null) ?? null;
    const autoBook = isWaitlistAutoBookEnabled(features);

    const candidates = await this.prisma.withTenantContext(event.tenantId, (c) =>
      c.appointmentWaitlist.findMany({
        where: {
          tenantId: event.tenantId,
          status: WaitlistStatus.OPEN,
          deletedAt: null,
          ...(event.branchId
            ? { OR: [{ branchId: event.branchId }, { branchId: null }] }
            : {}),
          OR: [{ providerId: event.providerId }, { providerId: null }],
        },
        take: 20,
        orderBy: { createdAt: 'asc' },
      }),
    );

    const eligible = candidates.filter((entry) => {
      if (entry.preferredDate) {
        const prefDay = new Date(entry.preferredDate).toISOString().slice(0, 10);
        const slotDay = slotStart.toISOString().slice(0, 10);
        if (prefDay !== slotDay) return false;
      }
      return entry.durationMin * 60_000 <= durationMs;
    });

    if (eligible.length === 0) {
      return { offersCreated: 0, autoBookedAppointmentId: null };
    }

    if (autoBook) {
      const first = eligible[0];
      const appointmentId = await this.autoBookFirst(event, first.id, slotStart, slotEnd);
      return { offersCreated: 0, autoBookedAppointmentId: appointmentId };
    }

    let offersCreated = 0;
    const now = new Date();
    const expiresAt = computeOfferExpiresAt(now, DEFAULT_WAITLIST_OFFER_TTL_MINUTES);

    for (const entry of eligible) {
      const existingPending = await this.prisma.withTenantContext(event.tenantId, (c) =>
        c.waitlistOffer.findFirst({
          where: {
            tenantId: event.tenantId,
            waitlistEntryId: entry.id,
            status: WaitlistOfferStatus.PENDING,
            deletedAt: null,
          },
        }),
      );
      if (existingPending) continue;

      const offerId = randomUUID();
      await this.prisma.withTenantContext(event.tenantId, (c) =>
        c.waitlistOffer.create({
          data: {
            id: offerId,
            tenantId: event.tenantId,
            branchId: entry.branchId ?? event.branchId ?? null,
            waitlistEntryId: entry.id,
            sourceAppointmentId: event.appointmentId,
            providerId: event.providerId!,
            resourceId: null,
            offeredStartsAt: slotStart,
            offeredEndsAt: slotEnd,
            expiresAt,
            status: WaitlistOfferStatus.PENDING,
            createdBy: null,
          },
        }),
      );

      const startLabel = slotStart.toISOString().slice(0, 16).replace('T', ' ');
      await this.producer.produceInApp({
        tenantId: event.tenantId,
        branchId: event.branchId,
        recipientId: entry.patientId,
        title: 'Waitlist slot offer',
        body: `A slot on ${startLabel} is offered to you until ${expiresAt.toISOString()}. Accept via reception/app before it expires.`,
        priority: 'high',
        idempotencyKey: `waitlist-offer:${event.appointmentId}:${entry.id}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
      offersCreated += 1;
    }

    if (offersCreated > 0) {
      this.logger.log(
        `Created ${offersCreated} waitlist offers for freed slot ${event.appointmentId}`,
      );
    }
    return { offersCreated, autoBookedAppointmentId: null };
  }

  private async autoBookFirst(
    event: AppointmentCancelledEvent,
    waitlistEntryId: string,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<string | null> {
    const appointmentId = randomUUID();
    try {
      await this.concurrency.withBookingTransaction(async (client) => {
        const entry = await client.appointmentWaitlist.findFirst({
          where: {
            id: waitlistEntryId,
            tenantId: event.tenantId,
            status: WaitlistStatus.OPEN,
            deletedAt: null,
          },
        });
        if (!entry) return;

        await this.concurrency.assertSlotAvailableUnderLock(client, {
          tenantId: event.tenantId,
          providerId: event.providerId!,
          resourceIds: [],
          start: slotStart,
          end: slotEnd,
        });

        await client.appointment.create({
          data: {
            id: appointmentId,
            tenantId: event.tenantId,
            branchId: entry.branchId ?? event.branchId ?? null,
            patientId: entry.patientId,
            providerId: event.providerId!,
            scheduledStart: slotStart,
            scheduledEnd: slotEnd,
            status: PrismaAppointmentStatus.PENDING,
            notes: entry.notes,
            snapshotWriteMode: 'LEGACY',
          },
        });

        await client.appointmentWaitlist.update({
          where: { id: entry.id },
          data: { status: WaitlistStatus.SCHEDULED, updatedAt: new Date() },
        });
      });
      this.logger.log(
        `Auto-booked waitlist ${waitlistEntryId} → appointment ${appointmentId} (waitlist.auto_book ON)`,
      );
      return appointmentId;
    } catch (err) {
      this.logger.warn(
        `waitlist.auto_book failed for ${waitlistEntryId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
