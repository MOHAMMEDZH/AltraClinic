import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import { PatientPortalPermissionGuard } from './patient-portal-permission.guard';
import { PortalDomainExceptionFilter } from './patient-portal-domain-exception.filter';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import {
  BookMyAppointmentHandler,
  GetMyAvailabilityHandler,
  ListMyAppointmentsHandler,
  ListMyProvidersHandler,
  UpdateMyAppointmentHandler,
} from '../application/handlers/portal-scheduling.handlers';

interface AuthenticatedRequest {
  user?: { id: string; roles: string[] };
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
@UseGuards(PatientPortalPermissionGuard)
@UseFilters(PortalDomainExceptionFilter)
@RequireLicensedModule('patientPortal')
export class PortalSchedulingController {
  constructor(
    private readonly listAppointments: ListMyAppointmentsHandler,
    private readonly bookAppointment: BookMyAppointmentHandler,
    private readonly updateAppointment: UpdateMyAppointmentHandler,
    private readonly listProviders: ListMyProvidersHandler,
    private readonly availability: GetMyAvailabilityHandler,
  ) {}

  private userId(request: AuthenticatedRequest): string {
    return request.user?.id ?? '';
  }

  @Get('appointments')
  @RequirePermission('api.patient_portal', 'view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listAppointments.execute(this.userId(request), {
      from,
      to,
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  @Post('appointments')
  @RequirePermission('api.patient_portal', 'create')
  async book(@Req() request: AuthenticatedRequest, @Body() body: BookMyAppointmentDto) {
    return this.bookAppointment.execute(this.userId(request), body);
  }

  @Patch('appointments/:appointmentId')
  @RequirePermission('api.patient_portal', 'update')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('appointmentId') appointmentId: string,
    @Body() body: UpdateMyAppointmentDto,
  ) {
    return this.updateAppointment.execute(this.userId(request), appointmentId, body);
  }

  @Get('providers')
  @RequirePermission('api.patient_portal', 'view')
  async providers(@Req() request: AuthenticatedRequest) {
    return this.listProviders.execute(this.userId(request));
  }

  @Get('availability')
  @RequirePermission('api.patient_portal', 'view')
  async getAvailability(
    @Req() request: AuthenticatedRequest,
    @Query('providerId') providerId: string,
    @Query('date') date: string,
    @Query('durationMin') durationMin?: string,
  ) {
    return this.availability.execute(this.userId(request), {
      providerId,
      date,
      durationMin: durationMin ? Number(durationMin) : undefined,
    });
  }
}
