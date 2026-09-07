import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, RequirePermission } from '../../auth/api/guards/permission.guard';
import { ServicePerformanceService } from '../services/service-performance.service';
import { CorrectServicePerformanceDto, CreateServicePerformanceDto } from './service-performance.dto';

function actor(req: { user?: { userId?: string; sub?: string; roles?: string[] } }) {
  return {
    actorId: (req.user?.userId ?? req.user?.sub ?? '').trim(),
    actorRoles: req.user?.roles ?? [],
  };
}

@Controller('service-performances')
@UseGuards(PermissionGuard)
export class ServicePerformanceController {
  constructor(private readonly performances: ServicePerformanceService) {}

  @Post()
  @RequirePermission('api.service-performance', 'create')
  create(
    @Body() body: CreateServicePerformanceDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.performances.create({ ...body, actorId: a.actorId, actorRoles: a.actorRoles });
  }

  @Get(':id')
  @RequirePermission('api.service-performance', 'view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.performances.get(id);
  }

  @Post(':id/complete')
  @RequirePermission('api.service-performance', 'approve')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.performances.complete({ id, actorId: a.actorId, actorRoles: a.actorRoles });
  }

  @Post(':id/corrections')
  @RequirePermission('api.service-performance', 'manage')
  correct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CorrectServicePerformanceDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.performances.correct({
      id,
      reason: body.reason,
      participants: body.participants,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }
}
