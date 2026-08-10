import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { OBSERVABILITY_PERMISSION_RESOURCE } from '../observability.constants';
import { isSystemMonitoringObservabilityEnabled } from '../config/observability-config';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import {
  ALERT_EVALUATOR,
  type AlertEvaluatorService,
} from '../application/ports/services';

/**
 * Phase 45e — alerts + incident visibility (OD-ALERTS / OD-INCIDENT).
 */
@Controller('observability/alerts')
@UseGuards(TenantScopedAccessGuard)
export class ObservabilityAlertsController {
  constructor(
    @Inject(ALERT_EVALUATOR) private readonly alerts: AlertEvaluatorService,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  @Get('rules')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async rules(@CurrentUser() user: JwtClaimsVO) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', rules: [] };
    }
    return {
      visible: true,
      phase: '45e',
      active: this.alerts.isActive?.() === true,
      rules: this.alerts.listRules?.() ?? [],
    };
  }

  @Post('evaluate')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'manage')
  async evaluate(@CurrentUser() user: JwtClaimsVO) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { ok: false, reason: 'license_or_flag_denied' };
    }
    return {
      ok: true,
      result: this.alerts.evaluateAll?.({ tenantId: user.tenantId }),
    };
  }

  @Get()
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async list(
    @CurrentUser() user: JwtClaimsVO,
    @Query('crossTenant') crossTenantRaw?: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', alerts: [] };
    }
    const includeOtherTenants = this.canCross(user, crossTenantRaw);
    const alerts =
      this.alerts.listAlerts?.({
        tenantId: includeOtherTenants ? undefined : user.tenantId,
        includeOtherTenants,
      }) ?? [];
    return {
      visible: true,
      crossTenant: includeOtherTenants,
      count: alerts.length,
      alerts,
    };
  }

  @Get('incidents')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async incidents(
    @CurrentUser() user: JwtClaimsVO,
    @Query('crossTenant') crossTenantRaw?: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', incidents: [] };
    }
    const includeOtherTenants = this.canCross(user, crossTenantRaw);
    const incidents =
      this.alerts.listIncidents?.({
        tenantId: includeOtherTenants ? undefined : user.tenantId,
        includeOtherTenants,
      }) ?? [];
    return {
      visible: true,
      crossTenant: includeOtherTenants,
      count: incidents.length,
      incidents,
    };
  }

  @Get('diagnostics')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async diagnostics(@CurrentUser() user: JwtClaimsVO) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied' };
    }
    return {
      visible: true,
      diagnostics: this.alerts.diagnostics?.(),
      contractVersion: this.alerts.contractVersion,
    };
  }

  @Get(':id')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async getOne(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied' };
    }
    const alert = this.alerts.getAlert?.(id);
    if (!alert) return { visible: false, reason: 'not_found' };
    if (alert.tenantId && alert.tenantId !== user.tenantId) {
      const canCross = rolesCanAccessResource(
        user.roles.map(String),
        OBSERVABILITY_PERMISSION_RESOURCE,
        'approve',
      );
      if (!canCross) return { visible: false, reason: 'forbidden' };
    }
    return { visible: true, alert };
  }

  @Post(':id/acknowledge')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'update')
  async acknowledge(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) return { ok: false, reason: 'license_or_flag_denied' };
    return this.alerts.acknowledge?.(id, user.sub) ?? { ok: false };
  }

  @Post(':id/silence')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'update')
  async silence(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: { untilIso?: string; minutes?: number },
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) return { ok: false, reason: 'license_or_flag_denied' };
    const until =
      body?.untilIso ??
      new Date(
        Date.now() + Math.max(1, Number(body?.minutes ?? 30)) * 60_000,
      ).toISOString();
    return this.alerts.silence?.(id, user.sub, until) ?? { ok: false };
  }

  @Post(':id/resolve')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'update')
  async resolve(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) return { ok: false, reason: 'license_or_flag_denied' };
    return this.alerts.resolve?.(id, user.sub) ?? { ok: false };
  }

  private canCross(user: JwtClaimsVO, crossTenantRaw?: string): boolean {
    const wantCross = crossTenantRaw === 'true' || crossTenantRaw === '1';
    if (!wantCross) return false;
    return rolesCanAccessResource(
      user.roles.map(String),
      OBSERVABILITY_PERMISSION_RESOURCE,
      'approve',
    );
  }

  private async assertLicensed(tenantId: string): Promise<boolean> {
    if (!isSystemMonitoringObservabilityEnabled()) return false;
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    return policy.allowObservability === true;
  }
}
