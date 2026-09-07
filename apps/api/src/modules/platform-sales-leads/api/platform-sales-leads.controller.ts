import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { LeadAdminService } from '../application/lead-admin.service';
import { SALES_LEAD_PERMISSIONS } from '../platform-sales-leads.constants';
import {
  AddLeadNoteDto,
  AssignLeadOwnerDto,
  ChangeLeadStageDto,
  CreateSalesLeadDto,
  TerminalLeadDto,
  UpdateLeadDemoDto,
  UpdateSalesLeadDto,
} from './dto/sales-lead.dto';
import { SalesLeadError, SalesLeadValidationError } from '../domain/sales-lead.errors';

@Controller('platform/sales/leads')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformSalesLeadsController {
  constructor(
    private readonly leads: LeadAdminService,
    private readonly authz: PlatformAuthorizationService,
  ) {}

  private async perms(user: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authz.resolveEffectivePermissions(user.sub));
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof SalesLeadError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    });
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.view)
  list(
    @CurrentUser() user: JwtClaimsVO,
    @Query() q: { page?: string; pageSize?: string; stage?: string; source?: string; search?: string },
  ) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    return this.wrap(async () =>
      this.leads.list(user, await this.perms(user), {
        page,
        pageSize,
        stage: q.stage,
        source: q.source,
        search: q.search,
      }),
    );
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.manage)
  create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateSalesLeadDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () => {
      if (!idempotencyKey?.trim()) throw new SalesLeadValidationError('Idempotency-Key header is required.');
      return this.leads.create(user, await this.perms(user), body, idempotencyKey);
    });
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.view)
  detail(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.leads.getById(user, await this.perms(user), id));
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.manage)
  update(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: UpdateSalesLeadDto) {
    return this.wrap(async () => this.leads.update(user, await this.perms(user), id, body));
  }

  @Put(':id/owner')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.assign)
  assignOwner(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: AssignLeadOwnerDto,
  ) {
    return this.wrap(async () => this.leads.assignOwner(user, await this.perms(user), id, body));
  }

  @Post(':id/stage')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.manage)
  changeStage(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: ChangeLeadStageDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.leads.changeStage(user, await this.perms(user), id, body, idempotencyKey),
    );
  }

  @Get(':id/stage-history')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.view)
  stageHistory(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.leads.listStageHistory(user, await this.perms(user), id));
  }

  @Get(':id/ownership-history')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.view)
  ownershipHistory(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.leads.listOwnershipHistory(user, await this.perms(user), id));
  }

  @Post(':id/notes')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.manage)
  addNote(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string, @Body() body: AddLeadNoteDto) {
    return this.wrap(async () => this.leads.addNote(user, await this.perms(user), id, body));
  }

  @Get(':id/notes')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.view)
  listNotes(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.leads.listNotes(user, await this.perms(user), id));
  }

  @Put(':id/demo')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.manage)
  updateDemo(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: UpdateLeadDemoDto,
  ) {
    return this.wrap(async () => this.leads.updateDemo(user, await this.perms(user), id, body));
  }

  @Post(':id/won')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.manage)
  markWon(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: TerminalLeadDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.leads.markWon(user, await this.perms(user), id, body, idempotencyKey),
    );
  }

  @Post(':id/lost')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.manage)
  markLost(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: TerminalLeadDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.leads.markLost(user, await this.perms(user), id, body, idempotencyKey),
    );
  }

  @Get(':id/plan-fit')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_LEAD_PERMISSIONS.view)
  planFit(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.leads.getPlanFit(user, await this.perms(user), id));
  }
}
