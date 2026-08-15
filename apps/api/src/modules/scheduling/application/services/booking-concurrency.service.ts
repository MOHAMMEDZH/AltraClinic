import { ConflictException, Injectable } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export const SLOT_CONSUMING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

export type BookingLockDims = {
  tenantId: string;
  providerId: string;
  resourceIds: string[];
};

@Injectable()
export class BookingConcurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Deterministic lock keys: tenant+provider then tenant+each resource, sorted. */
  buildLockKeys(dims: BookingLockDims): string[] {
    const keys = [`booking:provider:${dims.tenantId}:${dims.providerId}`];
    const resources = [...new Set(dims.resourceIds.filter(Boolean))].sort();
    for (const resourceId of resources) {
      keys.push(`booking:resource:${dims.tenantId}:${resourceId}`);
    }
    return keys.sort();
  }

  async acquireLocks(client: Prisma.TransactionClient, dims: BookingLockDims): Promise<void> {
    await this.acquireSortedLockKeys(client, this.buildLockKeys(dims));
  }

  /** Acquire an arbitrary set of booking lock keys in one globally sorted pass. */
  async acquireSortedLockKeys(
    client: Prisma.TransactionClient,
    keys: string[],
  ): Promise<void> {
    const sorted = [...new Set(keys.filter(Boolean))].sort();
    for (const key of sorted) {
      await client.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, key);
    }
  }

  /** Build the full unique lock-key set for many providers + resources, globally sorted. */
  buildGlobalLockKeys(params: {
    tenantId: string;
    providerIds: string[];
    resourceIds: string[];
  }): string[] {
    const keys: string[] = [];
    for (const providerId of [...new Set(params.providerIds.filter(Boolean))]) {
      keys.push(`booking:provider:${params.tenantId}:${providerId}`);
    }
    for (const resourceId of [...new Set(params.resourceIds.filter(Boolean))]) {
      keys.push(`booking:resource:${params.tenantId}:${resourceId}`);
    }
    return [...new Set(keys)].sort();
  }

  /**
   * Stabilize appointment row identity: lock all affected Appointment rows in
   * deterministic id ASC order with FOR UPDATE (held through validation + writes).
   */
  async lockAppointmentsForUpdate(
    client: Prisma.TransactionClient,
    params: { tenantId: string; appointmentIds: string[] },
  ): Promise<
    Array<{
      id: string;
      providerId: string;
      clinicalServiceId: string | null;
      branchId: string | null;
      resourceId: string | null;
      status: string;
      effectiveSnapshotRevisionId: string | null;
      commercialLockedAt: Date | null;
      scheduledStart: Date;
      scheduledEnd: Date;
    }>
  > {
    const ids = [...new Set(params.appointmentIds.filter(Boolean))].sort();
    if (ids.length === 0) return [];
    const rows = await client.$queryRaw<
      Array<{
        id: string;
        providerId: string;
        clinicalServiceId: string | null;
        branchId: string | null;
        resourceId: string | null;
        status: string;
        effectiveSnapshotRevisionId: string | null;
        commercialLockedAt: Date | null;
        scheduledStart: Date;
        scheduledEnd: Date;
      }>
    >`
      SELECT
        id,
        "providerId",
        "clinicalServiceId",
        "branchId",
        "resourceId",
        status::text AS status,
        "effectiveSnapshotRevisionId",
        "commercialLockedAt",
        "scheduledStart",
        "scheduledEnd"
      FROM appointments
      WHERE "tenantId" = ${params.tenantId}::uuid
        AND id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        AND "deletedAt" IS NULL
      ORDER BY id ASC
      FOR UPDATE
    `;
    return rows;
  }

  async findProviderOverlap(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      providerId: string;
      start: Date;
      end: Date;
      excludeAppointmentId?: string;
      excludeAppointmentIds?: string[];
    },
  ) {
    const excludeIds = [
      ...new Set(
        [
          ...(params.excludeAppointmentIds ?? []),
          ...(params.excludeAppointmentId ? [params.excludeAppointmentId] : []),
        ].filter(Boolean),
      ),
    ];
    return client.appointment.findFirst({
      where: {
        tenantId: params.tenantId,
        providerId: params.providerId,
        deletedAt: null,
        status: { in: SLOT_CONSUMING_STATUSES },
        scheduledStart: { lt: params.end },
        scheduledEnd: { gt: params.start },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true },
    });
  }

  /**
   * Overlap via Appointment.resourceId (legacy primary) OR AppointmentResourceAllocation rows.
   */
  async findResourceOverlap(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      resourceId: string;
      start: Date;
      end: Date;
      excludeAppointmentId?: string;
      excludeAppointmentIds?: string[];
    },
  ) {
    const excludeIds = [
      ...new Set(
        [
          ...(params.excludeAppointmentIds ?? []),
          ...(params.excludeAppointmentId ? [params.excludeAppointmentId] : []),
        ].filter(Boolean),
      ),
    ];
    return client.appointment.findFirst({
      where: {
        tenantId: params.tenantId,
        deletedAt: null,
        status: { in: SLOT_CONSUMING_STATUSES },
        scheduledStart: { lt: params.end },
        scheduledEnd: { gt: params.start },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
        OR: [
          { resourceId: params.resourceId },
          {
            resourceAllocations: {
              some: { schedulingResourceId: params.resourceId, tenantId: params.tenantId },
            },
          },
        ],
      },
      select: { id: true },
    });
  }

  async listAllocatedResourceIds(
    client: Prisma.TransactionClient,
    appointmentId: string,
  ): Promise<string[]> {
    const rows = await client.appointmentResourceAllocation.findMany({
      where: { appointmentId },
      select: { schedulingResourceId: true },
    });
    return rows.map((r) => r.schedulingResourceId);
  }

  /** Replace multi-resource allocations inside the booking tx (delete+recreate). */
  async replaceResourceAllocations(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      appointmentId: string;
      resourceIds: string[];
    },
  ): Promise<void> {
    const unique = [...new Set(params.resourceIds.filter(Boolean))];
    await client.appointmentResourceAllocation.deleteMany({
      where: { appointmentId: params.appointmentId },
    });
    for (const schedulingResourceId of unique) {
      await client.appointmentResourceAllocation.create({
        data: {
          id: randomUUID(),
          tenantId: params.tenantId,
          appointmentId: params.appointmentId,
          schedulingResourceId,
        },
      });
    }
  }

  /**
   * Overlap re-check only (locks must already be held). Throws ConflictException on overlap.
   */
  async assertNoOverlaps(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      providerId: string;
      resourceIds: string[];
      start: Date;
      end: Date;
      excludeAppointmentId?: string;
      excludeAppointmentIds?: string[];
    },
  ): Promise<void> {
    const providerHit = await this.findProviderOverlap(client, params);
    if (providerHit) {
      throw new ConflictException('Slot not available');
    }
    for (const resourceId of [...new Set(params.resourceIds.filter(Boolean))]) {
      const resourceHit = await this.findResourceOverlap(client, {
        ...params,
        resourceId,
      });
      if (resourceHit) {
        throw new ConflictException('Resource not available');
      }
    }
  }

  /**
   * Acquire sorted locks then fresh overlap re-check. Throws ConflictException on overlap.
   */
  async assertSlotAvailableUnderLock(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      providerId: string;
      resourceIds: string[];
      start: Date;
      end: Date;
      excludeAppointmentId?: string;
      excludeAppointmentIds?: string[];
    },
  ): Promise<void> {
    await this.acquireLocks(client, {
      tenantId: params.tenantId,
      providerId: params.providerId,
      resourceIds: params.resourceIds,
    });
    await this.assertNoOverlaps(client, params);
  }

  withBookingTransaction<T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    // withPlatformBypass already opens an interactive transaction + RLS bypass.
    return this.prisma.withPlatformBypass((client) => fn(client as unknown as Prisma.TransactionClient));
  }
}
