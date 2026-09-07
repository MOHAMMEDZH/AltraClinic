import {

  Body,

  Controller,

  Get,

  Param,

  ParseUUIDPipe,

  Post,

  Put,

  Query,

  Req,

  UseGuards,

} from '@nestjs/common';

import { PermissionGuard, RequirePermission } from '../../auth/api/guards/permission.guard';

import { ClinicalFormTemplateService } from '../services/clinical-form-template.service';

import { ClinicalFormVersionService } from '../services/clinical-form-version.service';

import { PatientFormInstanceService } from '../services/patient-form-instance.service';

import { ClinicalServiceFormRequirementService } from '../services/clinical-service-form-requirement.service';

import {

  CreateClinicalFormTemplateDto,

  CreateClinicalFormVersionDto,

  CreatePatientFormInstanceDto,

  SignPatientFormInstanceDto,

  UpsertClinicalServiceFormRequirementDto,

  VoidPatientFormInstanceDto,

} from './clinical-forms.dto';



function actorId(req: { user?: { userId?: string; sub?: string } }): string {

  return (req.user?.userId ?? req.user?.sub ?? '').trim();

}



@Controller('clinical-forms')

@UseGuards(PermissionGuard)

export class ClinicalFormsController {

  constructor(

    private readonly templates: ClinicalFormTemplateService,

    private readonly versions: ClinicalFormVersionService,

    private readonly instances: PatientFormInstanceService,

    private readonly requirements: ClinicalServiceFormRequirementService,

  ) {}



  @Get('templates')

  @RequirePermission('api.clinical-forms', 'view')

  listTemplates(@Query('kind') kind?: string) {

    return this.templates.list(kind);

  }



  @Post('templates')

  @RequirePermission('api.clinical-forms', 'manage')

  createTemplate(

    @Body() body: CreateClinicalFormTemplateDto,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.templates.create({ ...body, actorId: actorId(req) });

  }



  @Get('templates/:id')

  @RequirePermission('api.clinical-forms', 'view')

  getTemplate(@Param('id', ParseUUIDPipe) id: string) {

    return this.templates.get(id);

  }



  @Post('templates/:id/activate')

  @RequirePermission('api.clinical-forms', 'manage')

  activateTemplate(

    @Param('id', ParseUUIDPipe) id: string,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.templates.activate(id, actorId(req));

  }



  @Post('templates/:templateId/versions')

  @RequirePermission('api.clinical-forms', 'manage')

  createVersion(

    @Param('templateId', ParseUUIDPipe) templateId: string,

    @Body() body: CreateClinicalFormVersionDto,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.versions.createDraft({

      templateId,

      contentEn: body.contentEn,

      contentAr: body.contentAr,

      actorId: actorId(req),

    });

  }



  @Post('versions/:id/publish')

  @RequirePermission('api.clinical-forms', 'manage')

  publishVersion(

    @Param('id', ParseUUIDPipe) id: string,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.versions.publish(id, actorId(req));

  }



  @Post('instances')

  @RequirePermission('api.clinical-forms', 'create')

  createInstance(

    @Body() body: CreatePatientFormInstanceDto,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.instances.createDraft({ ...body, actorId: actorId(req) });

  }



  @Post('instances/:id/sign')

  @RequirePermission('api.clinical-forms', 'approve')

  signInstance(

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: SignPatientFormInstanceDto,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.instances.sign({

      instanceId: id,

      actorId: actorId(req),

      signerPatientId: body.signerPatientId,

      method: body.method,

    });

  }



  @Post('instances/:id/void')

  @RequirePermission('api.clinical-forms', 'approve')

  voidInstance(

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: VoidPatientFormInstanceDto,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.instances.voidInstance({

      instanceId: id,

      actorId: actorId(req),

      reason: body.reason,

    });

  }



  @Get('requirements')

  @RequirePermission('api.clinical-forms', 'view')

  listRequirements(

    @Query('clinicalServiceId', new ParseUUIDPipe({ optional: true })) clinicalServiceId?: string,

  ) {

    return this.requirements.list(clinicalServiceId);

  }



  @Put('requirements')

  @RequirePermission('api.clinical-forms', 'manage')

  upsertRequirement(

    @Body() body: UpsertClinicalServiceFormRequirementDto,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.requirements.upsert({ ...body, actorId: actorId(req) });

  }



  @Post('requirements/:id/deactivate')

  @RequirePermission('api.clinical-forms', 'manage')

  deactivateRequirement(

    @Param('id', ParseUUIDPipe) id: string,

    @Req() req: { user?: { userId?: string; sub?: string } },

  ) {

    return this.requirements.deactivate(id, actorId(req));

  }

}
