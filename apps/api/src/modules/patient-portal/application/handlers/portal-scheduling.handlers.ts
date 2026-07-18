import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AppointmentRepository } from '../../../scheduling/domain/appointment.repository.interface';
import { CreateAppointmentHandler } from '../../../scheduling/application/handlers/create-appointment.handler';
import { UpdateAppointmentHandler } from '../../../scheduling/application/handlers/appointment.handlers';
import { GetAvailabilityHandler } from '../../../scheduling/application/handlers/scheduling-support.handlers';
import { ListProvidersHandler } from '../../../scheduling/application/handlers/scheduling-support.handlers';
import { CreateAppointmentCommand } from '../../../scheduling/application/commands/create-appointment.command';

interface PortalPatientContext {
  patientId: string;
  branchId: string | null;
}

@Injectable()
export class PortalSchedulingContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, tenantId: string): Promise<PortalPatientContext> {
    if (!userId?.trim()) throw new ForbiddenException('Authentication required');

    const account = await this.prisma.portalAccount.findFirst({
      where: { tenantId, userId: userId.trim(), status: 'ACTIVE' },
    });
    if (!account) {
      throw new ForbiddenException('Active patient portal account required');
    }

    return { patientId: account.patientId, branchId: account.branchId };
  }
}

@Injectable()
export class ListMyAppointmentsHandler {
  constructor(
    private readonly ctx: PortalSchedulingContextService,
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, query: { from?: string; to?: string; limit?: number; offset?: number }) {
    const tenant = await this.tenantContext.resolve();
    const portal = await this.ctx.resolve(userId, tenant.tenantId);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    return this.repo.list({
      tenantId: tenant.tenantId,
      branchId: portal.branchId ?? tenant.branchId,
      patientId: portal.patientId,
      from: query.from,
      to: query.to,
      limit,
      offset,
    });
  }
}

@Injectable()
export class BookMyAppointmentHandler {
  constructor(
    private readonly ctx: PortalSchedulingContextService,
    private readonly create: CreateAppointmentHandler,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    userId: string,
    input: { providerId: string; start: string; end: string; notes?: string; serviceType?: string },
  ) {
    const tenant = await this.tenantContext.resolve();
    const portal = await this.ctx.resolve(userId, tenant.tenantId);

    if (!input.providerId?.trim()) throw new BadRequestException('providerId is required');
    if (!input.start || !input.end) throw new BadRequestException('start and end are required');

    return this.create.execute(
      new CreateAppointmentCommand(
        portal.patientId,
        input.providerId,
        input.start,
        input.end,
        input.notes,
        input.serviceType ?? 'consultation',
        false,
        undefined,
        undefined,
      ),
    );
  }
}

@Injectable()
export class UpdateMyAppointmentHandler {
  constructor(
    private readonly ctx: PortalSchedulingContextService,
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly update: UpdateAppointmentHandler,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    userId: string,
    appointmentId: string,
    input: {
      action?: 'cancel';
      start?: string;
      end?: string;
      cancellationReason?: string | null;
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    const portal = await this.ctx.resolve(userId, tenant.tenantId);

    const appt = await this.repo.findById(appointmentId, tenant.tenantId);
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.patientId !== portal.patientId) {
      throw new ForbiddenException('You may only manage your own appointments');
    }

    if (input.action === 'cancel') {
      return this.update.execute(appointmentId, {
        action: 'cancel',
        cancellationReason: input.cancellationReason,
      });
    }

    if (input.start && input.end) {
      return this.update.execute(appointmentId, { start: input.start, end: input.end });
    }

    throw new BadRequestException('Provide action cancel or start/end for reschedule');
  }
}

@Injectable()
export class GetMyAvailabilityHandler {
  constructor(
    private readonly availability: GetAvailabilityHandler,
    private readonly ctx: PortalSchedulingContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    userId: string,
    query: { providerId: string; date: string; durationMin?: number },
  ) {
    const tenant = await this.tenantContext.resolve();
    await this.ctx.resolve(userId, tenant.tenantId);
    return this.availability.execute({
      providerId: query.providerId,
      date: query.date,
      durationMin: query.durationMin,
    });
  }
}

@Injectable()
export class ListMyProvidersHandler {
  constructor(
    private readonly providers: ListProvidersHandler,
    private readonly ctx: PortalSchedulingContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const portal = await this.ctx.resolve(userId, tenant.tenantId);
    return this.providers.execute(portal.branchId ?? tenant.branchId ?? undefined);
  }
}
