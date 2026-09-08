import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  CreateRecallRuleHandler,
  ListPatientRecallInstancesHandler,
  ListRecallRulesHandler,
  ScanRecallDueHandler,
  SoftDeleteRecallRuleHandler,
  TransitionPatientRecallHandler,
  UpdateRecallRuleHandler,
} from '../application/handlers/recall.handlers';

/**
 * Wave G3 / P1-13 / AR-17 — Recall SoR APIs.
 * Conceptual write owner outreach.admin → wired via api.scheduling manage/update
 * (no dedicated api.outreach stack in repo).
 */
@Controller('scheduling/recall')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class RecallController {
  constructor(
    private readonly createRule: CreateRecallRuleHandler,
    private readonly listRules: ListRecallRulesHandler,
    private readonly updateRule: UpdateRecallRuleHandler,
    private readonly softDeleteRule: SoftDeleteRecallRuleHandler,
    private readonly listInstances: ListPatientRecallInstancesHandler,
    private readonly transitions: TransitionPatientRecallHandler,
    private readonly dueScan: ScanRecallDueHandler,
  ) {}

  @Get('rules')
  @RequirePermission('api.scheduling', 'view')
  async rules(@Query('activeOnly') activeOnly?: string) {
    return this.listRules.execute(activeOnly === 'true' || activeOnly === '1');
  }

  @Post('rules')
  @RequirePermission('api.scheduling', 'manage')
  async create(
    @Body()
    body: {
      intervalDays: number;
      clinicalServiceId?: string | null;
      eligibilityExpr?: unknown;
      active?: boolean;
    },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.createRule.execute({
      ...body,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }

  @Patch('rules/:id')
  @RequirePermission('api.scheduling', 'manage')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      intervalDays?: number;
      clinicalServiceId?: string | null;
      eligibilityExpr?: unknown;
      active?: boolean;
    },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.updateRule.execute(id, {
      ...body,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }

  @Delete('rules/:id')
  @RequirePermission('api.scheduling', 'manage')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtClaimsVO) {
    return this.softDeleteRule.execute(id, user.sub, [...user.roles]);
  }

  @Get('instances')
  @RequirePermission('api.scheduling', 'view')
  async instances(
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('ruleId') ruleId?: string,
  ) {
    return this.listInstances.execute({ status, patientId, ruleId });
  }

  @Post('instances/:id/snooze')
  @RequirePermission('api.scheduling', 'update')
  async snooze(
    @Param('id') id: string,
    @Body() body: { snoozeUntil: string },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.transitions.snooze(id, body.snoozeUntil, user.sub, [...user.roles]);
  }

  @Post('instances/:id/book')
  @RequirePermission('api.scheduling', 'create')
  async book(
    @Param('id') id: string,
    @Body()
    body: {
      appointmentId?: string;
      start?: string;
      end?: string;
      providerId?: string;
    },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.transitions.book(id, {
      ...body,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }

  @Post('instances/:id/complete')
  @RequirePermission('api.scheduling', 'update')
  async complete(@Param('id') id: string, @CurrentUser() user: JwtClaimsVO) {
    return this.transitions.complete(id, user.sub, [...user.roles]);
  }

  @Post('instances/:id/opt-out')
  @RequirePermission('api.scheduling', 'update')
  async optOut(@Param('id') id: string, @CurrentUser() user: JwtClaimsVO) {
    return this.transitions.optOut(id, user.sub, [...user.roles]);
  }

  @Post('due-scan')
  @RequirePermission('api.scheduling', 'manage')
  async scanDue(
    @Body() body: { notify?: boolean } | undefined,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.dueScan.execute({
      actorId: user.sub,
      actorRoles: [...user.roles],
      notify: body?.notify === true,
    });
  }
}
