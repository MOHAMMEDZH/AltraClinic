import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, RequirePermission } from '../../auth/api/guards/permission.guard';
import { DentalLabCaseService } from '../services/dental-lab-case.service';
import {
  AttachDentalLabCaseMediaDto,
  CreateDentalLabCaseDto,
  TransitionDentalLabCaseDto,
} from './wave-d.dto';

function actor(req: { user?: { userId?: string; sub?: string; roles?: string[] } }) {
  return {
    actorId: (req.user?.userId ?? req.user?.sub ?? '').trim(),
    actorRoles: req.user?.roles ?? [],
  };
}

@Controller('dental/lab-cases')
@UseGuards(PermissionGuard)
export class DentalLabCasesController {
  constructor(private readonly lab: DentalLabCaseService) {}

  @Get()
  @RequirePermission('api.dental-lab', 'view')
  list(@Query('patientId') patientId?: string, @Query('status') status?: string) {
    return this.lab.list({ patientId, status });
  }

  @Get(':id')
  @RequirePermission('api.dental-lab', 'view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.lab.get(id);
  }

  @Post()
  @RequirePermission('api.dental-lab', 'create')
  create(
    @Body() body: CreateDentalLabCaseDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.lab.create({ ...body, actorId: a.actorId, actorRoles: a.actorRoles });
  }

  @Post(':id/transition')
  @RequirePermission('api.dental-lab', 'update')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionDentalLabCaseDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.lab.transition({
      id,
      status: body.status,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post(':id/attachments')
  @RequirePermission('api.dental-lab', 'update')
  attach(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AttachDentalLabCaseMediaDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.lab.attachMedia({
      id,
      mediaAssetId: body.mediaAssetId,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }
}
