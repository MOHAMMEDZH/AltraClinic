import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, RequirePermission } from '../../auth/api/guards/permission.guard';
import { TreatmentPlanAppointmentLinkService } from '../services/treatment-plan-appointment-link.service';
import { CompletePlanItemFromAppointmentDto, LinkPlanItemAppointmentDto } from './wave-d.dto';

function actor(req: { user?: { userId?: string; sub?: string; roles?: string[] } }) {
  return {
    actorId: (req.user?.userId ?? req.user?.sub ?? '').trim(),
    actorRoles: req.user?.roles ?? [],
  };
}

@Controller('dental/treatment-plans')
@UseGuards(PermissionGuard)
export class TreatmentPlanLinksController {
  constructor(private readonly links: TreatmentPlanAppointmentLinkService) {}

  @Get(':planId/items/:itemId/appointments')
  @RequirePermission('api.treatment-plan-links', 'view')
  list(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.links.listForItem(planId, itemId);
  }

  @Post(':planId/items/:itemId/appointments')
  @RequirePermission('api.treatment-plan-links', 'create')
  link(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: LinkPlanItemAppointmentDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.links.link({
      planId,
      planItemId: itemId,
      appointmentId: body.appointmentId,
      linkRole: body.linkRole,
      sortOrder: body.sortOrder,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Delete(':planId/items/:itemId/appointments/:appointmentId')
  @RequirePermission('api.treatment-plan-links', 'delete')
  unlink(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.links.unlink({
      planId,
      planItemId: itemId,
      appointmentId,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post(':planId/items/:itemId/complete-from-appointment')
  @RequirePermission('api.treatment-plan-links', 'update')
  complete(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: CompletePlanItemFromAppointmentDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.links.completeFromAppointment({
      planId,
      planItemId: itemId,
      appointmentId: body.appointmentId,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }
}
