import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus as PrismaAppointmentStatus,
  WaitlistOfferStatus,
  WaitlistStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { BookingConcurrencyService } from '../services/booking-concurrency.service';
import { SCHEDULING_AUDIT_LOG, SchedulingAuditLog } from '../ports/scheduling-audit-log.port';
import {
  canAcceptOffer,
  canRejectOffer,
  computeOfferExpiresAt,
  DEFAULT_WAITLIST_OFFER_TTL_MINUTES,
} from '../../domain/waitlist-offer.lifecycle';

function toDto(row: {
  id: string;
  tenantId: string;
  branchId: string | null;
  waitlistEntryId: string;
  sourceAppointmentId: string | null;
  providerId: string;
  resourceId: string | null;
  offeredStartsAt: Date;
  offeredEndsAt: Date;
  expiresAt: Date;
  status: WaitlistOfferStatus;
  appointmentId: string | null;
  acceptedAt: Date | null;
  expiredAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    waitlistEntryId: row.waitlistEntryId,
    sourceAppointmentId: row.sourceAppointmentId,
    providerId: row.providerId,
    resourceId: row.resourceId,
    offeredStartsAt: row.offeredStartsAt.toISOString(),
    offeredEndsAt: row.offeredEndsAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    status: row.status,
    appointmentId: row.appointmentId,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CreateWaitlistOfferHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(input: {
    waitlistEntryId: string;
    providerId: string;
    offeredStartsAt: string;
    offeredEndsAt: string;
    ttlMinutes?: number;
    resourceId?: string | null;
    sourceAppointmentId?: string | null;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    if (!input.waitlistEntryId?.trim()) {
      throw new BadRequestException('waitlistEntryId is required');
    }
    if (!input.providerId?.trim()) throw new BadRequestException('providerId is required');
    const start = new Date(input.offeredStartsAt);
    const end = new Date(input.offeredEndsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('offeredStartsAt/offeredEndsAt must be a valid range');
    }

    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const entry = await c.appointmentWaitlist.findFirst({
        where: {
          id: input.waitlistEntryId,
          tenantId: tenant.tenantId,
          status: WaitlistStatus.OPEN,
          deletedAt: null,
        },
      });
      if (!entry) throw new NotFoundException('Waitlist entry not found or not OPEN');

      const pending = await c.waitlistOffer.findFirst({
        where: {
          tenantId: tenant.tenantId,
          waitlistEntryId: entry.id,
          status: WaitlistOfferStatus.PENDING,
          deletedAt: null,
        },
      });
      if (pending) {
        throw new ConflictException('Waitlist entry already has a PENDING offer');
      }

      const now = new Date();
      const id = randomUUID();
      const expiresAt = computeOfferExpiresAt(now, input.ttlMinutes ?? DEFAULT_WAITLIST_OFFER_TTL_MINUTES);
      const row = await c.waitlistOffer.create({
        data: {
          id,
          tenantId: tenant.tenantId,
          branchId: entry.branchId ?? tenant.branchId ?? null,
          waitlistEntryId: entry.id,
          sourceAppointmentId: input.sourceAppointmentId?.trim() || null,
          providerId: input.providerId.trim(),
          resourceId: input.resourceId?.trim() || null,
          offeredStartsAt: start,
          offeredEndsAt: end,
          expiresAt,
          status: WaitlistOfferStatus.PENDING,
          createdBy: input.actorId,
        },
      });

      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'waitlist_offer.created',
        resourceId: row.id,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        descriptionEn: 'Created waitlist offer with TTL',
        descriptionAr: 'إنشاء عرض قائمة انتظار مع مهلة',
        details: {
          waitlistEntryId: entry.id,
          expiresAt: expiresAt.toISOString(),
          providerId: row.providerId,
        },
      });

      return toDto(row);
    });
  }
}

@Injectable()
export class ListWaitlistOffersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(input: { status?: string; waitlistEntryId?: string }) {
    const tenant = await this.tenantContext.resolve();
    const status =
      input.status && Object.values(WaitlistOfferStatus).includes(input.status as WaitlistOfferStatus)
        ? (input.status as WaitlistOfferStatus)
        : undefined;

    const rows = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.waitlistOffer.findMany({
        where: {
          tenantId: tenant.tenantId,
          deletedAt: null,
          ...(status ? { status } : {}),
          ...(input.waitlistEntryId ? { waitlistEntryId: input.waitlistEntryId } : {}),
          ...(tenant.branchId
            ? { OR: [{ branchId: tenant.branchId }, { branchId: null }] }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );

    return { items: rows.map(toDto) };
  }
}

@Injectable()
export class ExpireWaitlistOffersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(input: { actorId: string; actorRoles: string[]; now?: Date }) {
    const tenant = await this.tenantContext.resolve();
    const now = input.now ?? new Date();

    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const due = await c.waitlistOffer.findMany({
        where: {
          tenantId: tenant.tenantId,
          status: WaitlistOfferStatus.PENDING,
          deletedAt: null,
          expiresAt: { lte: now },
        },
        take: 500,
      });

      let expired = 0;
      for (const offer of due) {
        const result = await c.waitlistOffer.updateMany({
          where: {
            id: offer.id,
            tenantId: tenant.tenantId,
            status: WaitlistOfferStatus.PENDING,
            deletedAt: null,
          },
          data: {
            status: WaitlistOfferStatus.EXPIRED,
            expiredAt: now,
            updatedAt: now,
          },
        });
        if (result.count === 1) {
          expired += 1;
          await this.audit.record({
            tenantId: tenant.tenantId,
            action: 'waitlist_offer.expired',
            resourceId: offer.id,
            actorId: input.actorId,
            actorRoles: input.actorRoles,
            descriptionEn: 'Waitlist offer TTL expired',
            descriptionAr: 'انتهت مهلة عرض قائمة الانتظار',
            details: { waitlistEntryId: offer.waitlistEntryId },
          });
        }
      }

      return { expired, at: now.toISOString() };
    });
  }
}

@Injectable()
export class RejectWaitlistOfferHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(offerId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const now = new Date();

    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const offer = await c.waitlistOffer.findFirst({
        where: { id: offerId, tenantId: tenant.tenantId, deletedAt: null },
      });
      if (!offer) throw new NotFoundException('Waitlist offer not found');
      if (!canRejectOffer(offer, now)) {
        throw new ConflictException('Offer cannot be rejected (expired or not PENDING)');
      }

      const result = await c.waitlistOffer.updateMany({
        where: {
          id: offer.id,
          tenantId: tenant.tenantId,
          status: WaitlistOfferStatus.PENDING,
        },
        data: {
          status: WaitlistOfferStatus.REJECTED,
          rejectedAt: now,
          updatedAt: now,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException('Offer reject lost race');
      }

      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'waitlist_offer.rejected',
        resourceId: offer.id,
        actorId,
        actorRoles,
        descriptionEn: 'Waitlist offer rejected',
        descriptionAr: 'رفض عرض قائمة الانتظار',
        details: { waitlistEntryId: offer.waitlistEntryId },
      });

      return { id: offer.id, status: WaitlistOfferStatus.REJECTED };
    });
  }
}

@Injectable()
export class AcceptWaitlistOfferHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly concurrency: BookingConcurrencyService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(offerId: string, actorId: string, actorRoles: string[]) {
    if (!actorId?.trim()) throw new BadRequestException('actorId is required');
    const tenant = await this.tenantContext.resolve();
    const now = new Date();
    const appointmentId = randomUUID();

    // Commit lazy TTL expiry outside the accept booking txn so failed accepts
    // cannot roll back explicit expire transitions.
    await this.prisma.withPlatformBypass(async (c) => {
      await c.waitlistOffer.updateMany({
        where: {
          tenantId: tenant.tenantId,
          status: WaitlistOfferStatus.PENDING,
          deletedAt: null,
          expiresAt: { lte: now },
        },
        data: {
          status: WaitlistOfferStatus.EXPIRED,
          expiredAt: now,
          updatedAt: now,
        },
      });
    });

    const result = await this.concurrency.withBookingTransaction(async (client) => {
      const locked = await client.$queryRaw<
        Array<{
          id: string;
          tenantId: string;
          waitlistEntryId: string;
          providerId: string;
          resourceId: string | null;
          branchId: string | null;
          offeredStartsAt: Date;
          offeredEndsAt: Date;
          expiresAt: Date;
          status: WaitlistOfferStatus;
          deletedAt: Date | null;
        }>
      >`
        SELECT id, "tenantId", "waitlistEntryId", "providerId", "resourceId", "branchId",
               "offeredStartsAt", "offeredEndsAt", "expiresAt", status, "deletedAt"
        FROM waitlist_offers
        WHERE id = ${offerId}::uuid
          AND "tenantId" = ${tenant.tenantId}::uuid
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;

      const offer = locked[0];
      if (!offer) throw new NotFoundException('Waitlist offer not found');
      if (!canAcceptOffer(offer, now)) {
        throw new ConflictException('Offer cannot be accepted (expired or not PENDING)');
      }

      const entry = await client.appointmentWaitlist.findFirst({
        where: {
          id: offer.waitlistEntryId,
          tenantId: tenant.tenantId,
          status: WaitlistStatus.OPEN,
          deletedAt: null,
        },
      });
      if (!entry) {
        throw new ConflictException('Waitlist entry is no longer OPEN');
      }

      const resourceIds = offer.resourceId ? [offer.resourceId] : [];
      await this.concurrency.assertSlotAvailableUnderLock(client, {
        tenantId: tenant.tenantId,
        providerId: offer.providerId,
        resourceIds,
        start: offer.offeredStartsAt,
        end: offer.offeredEndsAt,
      });

      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId: tenant.tenantId,
          branchId: offer.branchId ?? entry.branchId ?? tenant.branchId ?? null,
          patientId: entry.patientId,
          providerId: offer.providerId,
          scheduledStart: offer.offeredStartsAt,
          scheduledEnd: offer.offeredEndsAt,
          status: PrismaAppointmentStatus.PENDING,
          notes: entry.notes,
          resourceId: offer.resourceId,
          snapshotWriteMode: 'LEGACY',
        },
      });

      if (resourceIds.length > 0) {
        await this.concurrency.replaceResourceAllocations(client, {
          tenantId: tenant.tenantId,
          appointmentId,
          resourceIds,
        });
      }

      const accepted = await client.waitlistOffer.updateMany({
        where: {
          id: offer.id,
          tenantId: tenant.tenantId,
          status: WaitlistOfferStatus.PENDING,
        },
        data: {
          status: WaitlistOfferStatus.ACCEPTED,
          appointmentId,
          acceptedAt: now,
          updatedAt: now,
        },
      });
      if (accepted.count !== 1) {
        throw new ConflictException('Offer accept lost race');
      }

      await client.appointmentWaitlist.update({
        where: { id: entry.id },
        data: { status: WaitlistStatus.SCHEDULED, updatedAt: now },
      });

      // Sibling PENDING offers for the same slot lose.
      await client.waitlistOffer.updateMany({
        where: {
          tenantId: tenant.tenantId,
          status: WaitlistOfferStatus.PENDING,
          deletedAt: null,
          id: { not: offer.id },
          providerId: offer.providerId,
          offeredStartsAt: offer.offeredStartsAt,
          offeredEndsAt: offer.offeredEndsAt,
        },
        data: {
          status: WaitlistOfferStatus.EXPIRED,
          expiredAt: now,
          updatedAt: now,
        },
      });

      await this.audit.recordInTransaction(client, {
        tenantId: tenant.tenantId,
        action: 'waitlist_offer.accepted',
        resourceId: offer.id,
        actorId,
        actorRoles,
        descriptionEn: 'Waitlist offer accepted; appointment created',
        descriptionAr: 'قبول عرض قائمة الانتظار وإنشاء موعد',
        details: {
          waitlistEntryId: entry.id,
          appointmentId,
        },
      });

      return {
        offerId: offer.id,
        appointmentId,
        waitlistEntryId: entry.id,
        status: WaitlistOfferStatus.ACCEPTED,
      };
    });

    return result;
  }
}
