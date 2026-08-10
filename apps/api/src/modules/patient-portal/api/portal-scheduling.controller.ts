import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { PatientPortalPermissionGuard } from './patient-portal-permission.guard';
import { PatientPortalCenterEnabledGuard } from './patient-portal-center.guard';
import { PatientPortalEnrollmentCompleteGuard } from './patient-portal-enrollment.guard';
import { PatientPortalAppointmentsEnabledGuard } from './patient-portal-appointments.guard';
import { PortalDomainExceptionFilter } from './patient-portal-domain-exception.filter';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import {
  BookMyAppointmentHandler,
  GetMyAppointmentHandler,
  GetMyAvailabilityHandler,
  ListMyAppointmentsHandler,
  ListMyProvidersHandler,
  PortalSchedulingActor,
  UpdateMyAppointmentHandler,
} from '../application/handlers/portal-scheduling.handlers';

interface AuthenticatedRequest {
  user?: JwtClaimsVO | { id?: string; sub?: string; roles?: string[] };
  headers?: Record<string, string | string[] | undefined>;
}

class BookMyAppointmentDto {
  providerId!: string;
  start!: string;
  end!: string;
  notes?: string;
  serviceType?: string;
}

class UpdateMyAppointmentDto {
  action?: 'cancel';
  start?: string;
  end?: string;
  cancellationReason?: string | null;
}

@Controller('patient-portal/me')
@UseGuards(
  PatientPortalCenterEnabledGuard,
  PatientPortalAppointmentsEnabledGuard,
  PatientPortalEnrollmentCompleteGuard,
  PatientPortalPermissionGuard,
)
@UseFilters(PortalDomainExceptionFilter)
@RequireLicensedModule('patientPortal')
export class PortalSchedulingController {
  constructor(
    private readonly listAppointments: ListMyAppointmentsHandler,
    private readonly getAppointment: GetMyAppointmentHandler,
    private readonly bookAppointment: BookMyAppointmentHandler,
    private readonly updateAppointment: UpdateMyAppointmentHandler,
    private readonly listProviders: ListMyProvidersHandler,
    private readonly availability: GetMyAvailabilityHandler,
  ) {}

  private actor(
    request: AuthenticatedRequest,
    idempotencyKey?: string | null,
  ): PortalSchedulingActor {
    const { id, roles } = requireAuthenticatedPrincipal(request);
    const correlationHeader = request.headers?.['x-correlation-id'];
    const correlationId = Array.isArray(correlationHeader)
      ? correlationHeader[0]
      : correlationHeader;
    const actingHeader = request.headers?.['x-portal-acting-context'];
    const subjectHeader = request.headers?.['x-portal-subject-patient-id'];
    return {
      userId: id,
      roles,
      correlationId: typeof correlationId === 'string' ? correlationId : null,
      idempotencyKey: idempotencyKey ?? null,
      actingContextHeader: Array.isArray(actingHeader)
        ? actingHeader[0]
        : typeof actingHeader === 'string'
          ? actingHeader
          : null,
      subjectPatientIdHeader: Array.isArray(subjectHeader)
        ? subjectHeader[0]
        : typeof subjectHeader === 'string'
          ? subjectHeader
          : null,
    };
  }

  @Get('appointments')
  @RequirePermission('api.patient_portal', 'view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('branchId') branchId?: string,
    @Query('scope') scope?: 'upcoming' | 'past' | 'all',
  ) {
    const actor = this.actor(request);
    return this.listAppointments.execute(actor, {
      from,
      to,
      limit: Number(limit),
      offset: Number(offset),
      branchId,
      scope,
      actingContextHeader: actor.actingContextHeader,
      subjectPatientIdHeader: actor.subjectPatientIdHeader,
    });
  }

  @Get('appointments/:appointmentId')
  @RequirePermission('api.patient_portal', 'view')
  async detail(
    @Req() request: AuthenticatedRequest,
    @Param('appointmentId') appointmentId: string,
  ) {
    const actor = this.actor(request);
    return this.getAppointment.execute(actor, appointmentId, {
      actingContextHeader: actor.actingContextHeader,
      subjectPatientIdHeader: actor.subjectPatientIdHeader,
    });
  }

  @Post('appointments')
  @RequirePermission('api.patient_portal', 'create')
  async book(
    @Req() request: AuthenticatedRequest,
    @Body() body: BookMyAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookAppointment.execute(this.actor(request, idempotencyKey), body);
  }

  @Patch('appointments/:appointmentId')
  @RequirePermission('api.patient_portal', 'update')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('appointmentId') appointmentId: string,
    @Body() body: UpdateMyAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.updateAppointment.execute(
      this.actor(request, idempotencyKey),
      appointmentId,
      body,
    );
  }

  @Get('providers')
  @RequirePermission('api.patient_portal', 'view')
  async providers(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.listProviders.execute(this.actor(request), branchId);
  }

  @Get('availability')
  @RequirePermission('api.patient_portal', 'view')
  async getAvailability(
    @Req() request: AuthenticatedRequest,
    @Query('providerId') providerId: string,
    @Query('date') date: string,
    @Query('durationMin') durationMin?: string,
  ) {
    return this.availability.execute(this.actor(request), {
      providerId,
      date,
      durationMin: durationMin ? Number(durationMin) : undefined,
    });
  }
}
