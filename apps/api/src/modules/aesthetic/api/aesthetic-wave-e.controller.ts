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
import { TreatmentCourseService } from '../services/treatment-course.service';
import { DeviceTreatmentRecordService } from '../services/device-treatment-record.service';
import { DermatologyEncounterService } from '../services/dermatology-encounter.service';
import { PrePostCareService } from '../services/pre-post-care.service';
import {
  AssertPrePostCareDto,
  AttachDermatologyPhotoDto,
  CorrectDeviceTreatmentDto,
  CreateDeviceTreatmentDto,
  CreatePrePostCareInstanceDto,
  CreateTreatmentCourseDto,
  LinkCourseSessionAppointmentDto,
  OpenDermatologyEncounterDto,
  TransitionCourseSessionDto,
  TransitionTreatmentCourseDto,
} from './wave-e.dto';

function actor(req: { user?: { userId?: string; sub?: string; roles?: string[] } }) {
  return {
    actorId: (req.user?.userId ?? req.user?.sub ?? '').trim(),
    actorRoles: req.user?.roles ?? [],
  };
}

@Controller('aesthetic')
@UseGuards(PermissionGuard)
export class AestheticWaveEController {
  constructor(
    private readonly courses: TreatmentCourseService,
    private readonly devices: DeviceTreatmentRecordService,
    private readonly derm: DermatologyEncounterService,
    private readonly prePost: PrePostCareService,
  ) {}

  @Post('treatment-courses')
  @RequirePermission('api.treatment-course', 'create')
  createCourse(
    @Body() body: CreateTreatmentCourseDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.courses.create({ ...body, actorId: a.actorId, actorRoles: a.actorRoles });
  }

  @Get('treatment-courses/:id')
  @RequirePermission('api.treatment-course', 'view')
  getCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.courses.get(id);
  }

  @Post('treatment-courses/:id/transition')
  @RequirePermission('api.treatment-course', 'update')
  transitionCourse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionTreatmentCourseDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.courses.transition({
      id,
      toStatus: body.toStatus,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('treatment-courses/:courseId/sessions/:sessionId/link-appointment')
  @RequirePermission('api.treatment-course', 'update')
  linkSession(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: LinkCourseSessionAppointmentDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.courses.linkSessionAppointment({
      courseId,
      sessionId,
      appointmentId: body.appointmentId,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('treatment-courses/:courseId/sessions/:sessionId/transition')
  @RequirePermission('api.treatment-course', 'update')
  transitionSession(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: TransitionCourseSessionDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.courses.transitionSession({
      courseId,
      sessionId,
      toStatus: body.toStatus,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('device-treatments')
  @RequirePermission('api.device-treatment', 'create')
  createDevice(
    @Body() body: CreateDeviceTreatmentDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.devices.create({ ...body, actorId: a.actorId, actorRoles: a.actorRoles });
  }

  @Get('device-treatments/:id')
  @RequirePermission('api.device-treatment', 'view')
  getDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.devices.get(id);
  }

  @Post('device-treatments/:id/corrections')
  @RequirePermission('api.device-treatment', 'manage')
  correctDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CorrectDeviceTreatmentDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.devices.correct({
      id,
      parameterPayload: body.parameterPayload,
      reason: body.reason,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('dermatology/encounters')
  @RequirePermission('api.dermatology-encounter', 'create')
  openDerm(
    @Body() body: OpenDermatologyEncounterDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.derm.openDermatologyEncounter({
      ...body,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Get('dermatology/encounters/:id')
  @RequirePermission('api.dermatology-encounter', 'view')
  getDerm(@Param('id', ParseUUIDPipe) id: string) {
    return this.derm.get(id);
  }

  @Post('dermatology/encounters/:id/photos')
  @RequirePermission('api.dermatology-encounter', 'update')
  attachDermPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AttachDermatologyPhotoDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.derm.attachDermatologyPhoto({
      encounterId: id,
      ...body,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Get('dermatology/no-dermatology-record')
  @RequirePermission('api.dermatology-encounter', 'view')
  noDermRecord() {
    return this.derm.assertNoDermatologyRecordModel();
  }

  @Get('pre-post-care/kinds')
  @RequirePermission('api.pre-post-care', 'view')
  prePostKinds() {
    return { kinds: this.prePost.listSupportedKinds() };
  }

  @Post('pre-post-care/instances')
  @RequirePermission('api.pre-post-care', 'create')
  createPrePostInstance(
    @Body() body: CreatePrePostCareInstanceDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.prePost.createInstance({ ...body, actorId: a.actorId, actorRoles: a.actorRoles });
  }

  @Post('pre-post-care/instances/:id/assert')
  @RequirePermission('api.pre-post-care', 'view')
  assertPrePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssertPrePostCareDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.prePost.assertInstanceKind({
      instanceId: id,
      expectedKind: body.expectedKind,
      actorId: a.actorId,
      actorRoles: a.actorRoles,
    });
  }
}
