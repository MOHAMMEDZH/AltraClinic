import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

@Injectable()
export class ListAppointmentTemplatesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.appointmentTemplate.findMany({
      where: {
        tenantId: tenant.tenantId,
        deletedAt: null,
        ...(tenant.branchId ? { OR: [{ branchId: tenant.branchId }, { branchId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        serviceType: row.serviceType,
        durationMin: row.durationMin,
        providerId: row.providerId,
        notes: row.notes,
        isEmergency: row.isEmergency,
      })),
    };
  }
}

@Injectable()
export class CreateAppointmentTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(input: {
    name: string;
    serviceType?: string | null;
    durationMin?: number;
    providerId?: string | null;
    notes?: string | null;
    isEmergency?: boolean;
  }) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    const tenant = await this.tenantContext.resolve();

    const row = await this.prisma.appointmentTemplate.create({
      data: {
        tenantId: tenant.tenantId,
        branchId: tenant.branchId,
        name: input.name.trim(),
        serviceType: input.serviceType ?? null,
        durationMin: input.durationMin ?? 30,
        providerId: input.providerId ?? null,
        notes: input.notes?.trim() || null,
        isEmergency: input.isEmergency ?? false,
      },
    });

    return { id: row.id };
  }
}

@Injectable()
export class DeleteAppointmentTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    const result = await this.prisma.appointmentTemplate.updateMany({
      where: { id, tenantId: tenant.tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Template not found');
    return { id, deleted: true };
  }
}
