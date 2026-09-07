import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityExceptionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { SCHEDULING_AUDIT_LOG, SchedulingAuditLog } from '../ports/scheduling-audit-log.port';

const EXCEPTION_TYPES = new Set<string>(Object.values(AvailabilityExceptionType));

export interface CreateAvailabilityExceptionInput {
  type: string;
  startsAt: string;
  endsAt: string;
  branchId?: string | null;
  providerId?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  actorId: string;
  actorRoles: string[];
}

@Injectable()
export class CreateAvailabilityExceptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(input: CreateAvailabilityExceptionInput) {
    const tenant = await this.tenantContext.resolve();
    if (!EXCEPTION_TYPES.has(input.type)) {
      throw new BadRequestException(`Invalid type: ${input.type}`);
    }
    const type = input.type as AvailabilityExceptionType;
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('startsAt and endsAt must be ISO datetimes');
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    if (type === AvailabilityExceptionType.PROVIDER_LEAVE && !input.providerId?.trim()) {
      throw new BadRequestException('providerId is required for PROVIDER_LEAVE');
    }
    if (type === AvailabilityExceptionType.RESOURCE_MAINTENANCE && !input.resourceId?.trim()) {
      throw new BadRequestException('resourceId is required for RESOURCE_MAINTENANCE');
    }
    if (type === AvailabilityExceptionType.BRANCH_HOLIDAY && !input.branchId?.trim()) {
      throw new BadRequestException('branchId is required for BRANCH_HOLIDAY');
    }

    const id = randomUUID();
    const row = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.availabilityException.create({
        data: {
          id,
          tenantId: tenant.tenantId,
          branchId: input.branchId?.trim() || null,
          type,
          providerId: input.providerId?.trim() || null,
          resourceId: input.resourceId?.trim() || null,
          startsAt,
          endsAt,
          reason: input.reason?.trim()?.slice(0, 500) || null,
          createdBy: input.actorId,
        },
      }),
    );

    await this.audit.record({
      tenantId: tenant.tenantId,
      action: 'availability_exception.created',
      resourceId: row.id,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      descriptionEn: `Created availability exception ${type}`,
      descriptionAr: `إنشاء استثناء توفر ${type}`,
      details: {
        type,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        branchId: row.branchId,
        providerId: row.providerId,
        resourceId: row.resourceId,
      },
    });

    return this.toDto(row);
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    type: AvailabilityExceptionType;
    providerId: string | null;
    resourceId: string | null;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      type: row.type,
      providerId: row.providerId,
      resourceId: row.resourceId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class ListAvailabilityExceptionsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(input: { from?: string; to?: string; branchId?: string }) {
    const tenant = await this.tenantContext.resolve();
    const from = input.from ? new Date(input.from) : null;
    const to = input.to ? new Date(input.to) : null;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('Invalid from');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('Invalid to');

    const rows = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.availabilityException.findMany({
        where: {
          tenantId: tenant.tenantId,
          deletedAt: null,
          ...(input.branchId ? { OR: [{ branchId: input.branchId }, { branchId: null }] } : {}),
          ...(from && to
            ? { startsAt: { lt: to }, endsAt: { gt: from } }
            : {}),
        },
        orderBy: { startsAt: 'asc' },
        take: 500,
      }),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        branchId: row.branchId,
        type: row.type,
        providerId: row.providerId,
        resourceId: row.resourceId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        reason: row.reason,
      })),
    };
  }
}

@Injectable()
export class SoftDeleteAvailabilityExceptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(id: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.availabilityException.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
      }),
    );
    if (!existing) throw new NotFoundException('Availability exception not found');

    await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.availabilityException.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    );

    await this.audit.record({
      tenantId: tenant.tenantId,
      action: 'availability_exception.soft_deleted',
      resourceId: id,
      actorId,
      actorRoles,
      descriptionEn: `Soft-deleted availability exception ${existing.type}`,
      descriptionAr: `حذف ناعم لاستثناء التوفر ${existing.type}`,
      details: { type: existing.type },
    });

    return { ok: true, id };
  }
}
