import { Body, Controller, Delete, Get, Put, Query, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { DashboardOverviewService } from '../application/dashboard-overview.service';
import { parseDashboardRange } from '../application/dashboard-range';
import { resolveDashboardBranchFilter } from '../application/dashboard-branch-scope';
import { DashboardBranchesService } from '../application/dashboard-branches.service';
import { DashboardLayoutService } from '../application/dashboard-layout.service';

class SaveDashboardLayoutBody {
  profile!: string;
  hiddenWidgets!: string[];
  widgetOrder!: string[];
}

@Controller('dashboard')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('dashboard')
@RequireLicensedFeature('dashboard')
export class DashboardController {
  constructor(
    private readonly overviewService: DashboardOverviewService,
    private readonly branchesService: DashboardBranchesService,
    private readonly layoutService: DashboardLayoutService,
  ) {}

  @Get('branches')
  async branches(@CurrentUser() user: JwtClaimsVO) {
    const branches = await this.branchesService.listForTenant(user.tenantId);
    return { branches };
  }

  @Get('overview')
  async overview(
    @CurrentUser() user: JwtClaimsVO,
    @Query('branchId') branchId?: string,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.overviewService.getOverview(
      user.tenantId,
      resolveDashboardBranchFilter(user, branchId),
      parseDashboardRange(range),
      user.sub,
      from,
      to,
    );
  }

  @Get('layout')
  async getLayout(@CurrentUser() user: JwtClaimsVO, @Query('profile') profile: string) {
    if (!profile?.trim()) {
      return { layout: null };
    }
    const layout = await this.layoutService.getLayout(user.tenantId, user.sub, profile.trim());
    return { layout };
  }

  @Put('layout')
  async saveLayout(@CurrentUser() user: JwtClaimsVO, @Body() body: SaveDashboardLayoutBody) {
    const layout = await this.layoutService.saveLayout(
      user.tenantId,
      user.sub,
      body.profile,
      { hiddenWidgets: body.hiddenWidgets, widgetOrder: body.widgetOrder },
    );
    return { layout };
  }

  @Delete('layout')
  async clearLayout(@CurrentUser() user: JwtClaimsVO, @Query('profile') profile: string) {
    if (profile?.trim()) {
      await this.layoutService.clearLayout(user.tenantId, user.sub, profile.trim());
    }
    return { ok: true };
  }
}
