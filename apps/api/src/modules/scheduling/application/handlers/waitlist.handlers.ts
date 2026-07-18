import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

@Injectable()
export class ListWaitlistHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(status?: string) {
    const tenant = await this.tenantContext.resolve();
    const prismaStatus =
      status === 'scheduled'
        ? WaitlistStatus.SCHEDULED
        : status === 'cancelled'
          ? WaitlistStatus.CANCELLED
          : WaitlistStatus.OPEN;

    const rows = await this.prisma.appointmentWaitlist.findMany({
      where: {
        tenantId: tenant.tenantId,
        deletedAt: null,
        status: status ? prismaStatus : { not: WaitlistStatus.CANCELLED },
        ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
      },
      include: {
        patient: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        patientId: row.patientId,
        patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
        patientPhone: row.patient.phone,
        providerId: row.providerId,
        preferredDate: row.preferredDate?.toISOString() ?? null,
        durationMin: row.durationMin,
        notes: row.notes,
        status: row.status.toLowerCase(),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}

@Injectable()
export class CreateWaitlistHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(input: {
    patientId: string;
    providerId?: string | null;
    preferredDate?: string | null;
    durationMin?: number;
    notes?: string | null;
  }) {
    if (!input.patientId?.trim()) {
      throw new BadRequestException('patientId is required');
    }

    const tenant = await this.tenantContext.resolve();
    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, tenantId: tenant.tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const row = await this.prisma.appointmentWaitlist.create({
      data: {
        tenantId: tenant.tenantId,
        branchId: tenant.branchId,
        patientId: input.patientId,
        providerId: input.providerId ?? null,
        preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
        durationMin: input.durationMin ?? 30,
        notes: input.notes?.trim() || null,
        status: WaitlistStatus.OPEN,
      },
    });

    return { id: row.id };
  }
}

@Injectable()
export class CancelWaitlistHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    const result = await this.prisma.appointmentWaitlist.updateMany({
      where: { id, tenantId: tenant.tenantId, deletedAt: null },
      data: { status: WaitlistStatus.CANCELLED, updatedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Waitlist entry not found');
    return { id, status: 'cancelled' };
  }
}
