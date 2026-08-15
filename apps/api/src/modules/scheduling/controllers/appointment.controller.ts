import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CreateAppointmentDTO, UpdateAppointmentDTO, ListAppointmentsQueryDTO } from '../application/dto/appointment.dto';
import { CreateAppointmentHandler } from '../application/handlers/create-appointment.handler';
import { GetAppointmentHandler } from '../application/handlers/get-appointment.handler';
import {
  ListAppointmentsHandler,
  UpdateAppointmentHandler,
  SchedulingMetricsHandler,
  SchedulingAnalyticsHandler,
  BulkRescheduleHandler,
  DeleteAppointmentHandler,
} from '../application/handlers/appointment.handlers';
import { BulkRescheduleDTO } from '../application/dto/appointment-template.dto';
import { CreateInvoiceFromAppointmentHandler } from '../application/handlers/create-invoice-from-appointment.handler';

@Controller('scheduling/appointments')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class AppointmentController {
  constructor(
    private readonly createHandler: CreateAppointmentHandler,
    private readonly listHandler: ListAppointmentsHandler,
    private readonly getHandler: GetAppointmentHandler,
    private readonly updateHandler: UpdateAppointmentHandler,
    private readonly metricsHandler: SchedulingMetricsHandler,
    private readonly analyticsHandler: SchedulingAnalyticsHandler,
    private readonly bulkRescheduleHandler: BulkRescheduleHandler,
    private readonly deleteHandler: DeleteAppointmentHandler,
    private readonly createInvoiceFromAppointmentHandler: CreateInvoiceFromAppointmentHandler,
  ) {}

  @Get()
  @RequirePermission('api.scheduling', 'view')
  async list(@Query() query: ListAppointmentsQueryDTO) {
    return this.listHandler.execute({
      q: query.q,
      providerId: query.providerId,
      patientId: query.patientId,
      branchId: query.branchId,
      status: query.status,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
  }

  @Get('metrics/summary')
  @RequirePermission('api.scheduling', 'view')
  async metrics(@Query('from') from: string, @Query('to') to: string) {
    if (!from || !to) {
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return this.metricsHandler.execute(start.toISOString(), end.toISOString());
    }
    return this.metricsHandler.execute(from, to);
  }

  @Get('metrics/analytics')
  @RequirePermission('api.scheduling', 'view')
  async analytics(@Query('from') from: string, @Query('to') to: string) {
    if (!from || !to) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return this.analyticsHandler.execute(start.toISOString(), end.toISOString());
    }
    return this.analyticsHandler.execute(from, to);
  }

  @Post()
  @RequirePermission('api.scheduling', 'create')
  async create(@Body() body: CreateAppointmentDTO, @CurrentUser() user: JwtClaimsVO) {
    const result = await this.createHandler.execute({
      patientId: body.patientId,
      providerId: body.providerId,
      start: body.start,
      end: body.end,
      notes: body.notes,
      serviceType: body.serviceType,
      isEmergency: body.isEmergency,
      recurrence: body.recurrence,
      resourceId: body.resourceId,
      clinicalServiceId: body.clinicalServiceId,
      quantity: body.quantity,
      pricingUnit: body.pricingUnit as never,
      currency: body.currency,
      commercialReason: body.commercialReason,
      resourceIds: body.resourceIds,
      actorId: user.sub,
    });
    return {
      id: result.appointmentId,
      appointmentIds: result.appointmentIds,
      seriesId: result.seriesId,
    };
  }

  @Patch('bulk/reschedule')
  @RequirePermission('api.scheduling', 'update')
  async bulkReschedule(@Body() body: BulkRescheduleDTO) {
    return this.bulkRescheduleHandler.execute(body);
  }

  @Get(':id')
  @RequirePermission('api.scheduling', 'view')
  async get(@Param('id') id: string) {
    const result = await this.getHandler.execute({ id });
    if (!result) throw new NotFoundException('Appointment not found');
    return result;
  }

  @Post(':id/invoice')
  @RequirePermission('api.billing', 'create')
  async createInvoice(@Param('id') id: string) {
    return this.createInvoiceFromAppointmentHandler.execute(id);
  }

  @Patch(':id')
  @RequirePermission('api.scheduling', 'update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAppointmentDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.updateHandler.execute(id, body, user.sub);
  }

  @Delete(':id')
  @RequirePermission('api.scheduling', 'delete')
  async remove(@Param('id') id: string) {
    return this.deleteHandler.execute(id);
  }
}
