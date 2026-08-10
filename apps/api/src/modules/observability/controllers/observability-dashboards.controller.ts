import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { OBSERVABILITY_PERMISSION_RESOURCE } from '../observability.constants';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
} from '../config/observability-config';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { DashboardRegistryService } from '../application/dashboards/dashboard-registry.service';

/**
 * Phase 45e — Observability ops hub dashboards (OD-DASHBOARD).
 */
@Controller('observability/dashboards')
@UseGuards(TenantScopedAccessGuard)
export class ObservabilityDashboardsController {
  constructor(
    private readonly dashboards: DashboardRegistryService,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  @Get()
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async catalog(@CurrentUser() user: JwtClaimsVO) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', dashboards: [] };
    }
    const roles = user.roles.map(String);
    const canCross = rolesCanAccessResource(
      roles,
      OBSERVABILITY_PERMISSION_RESOURCE,
      'approve',
    );
    const flags = loadObservabilityFeatureFlags();
    return {
      visible: true,
      phase: '45e',
      featureEnabled: isSystemMonitoringObservabilityEnabled(),
      tenantDashboardEnabled: flags.tenantDashboardEnabled,
      dashboards: this.dashboards.listDescriptors({
        includeTenantScoped: true,
      }),
      crossTenantAllowed: canCross,
      hubDeepLinks: [
        '/settings/observability',
        '/settings/backup-restore',
        '/settings/import-export',
        '/settings/api-integrations',
        '/health/ready',
      ],
    };
  }

  @Get(':id')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async query(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Query('crossTenant') crossTenantRaw?: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied' };
    }
    const roles = user.roles.map(String);
    const wantCross = crossTenantRaw === 'true' || crossTenantRaw === '1';
    const canCross = rolesCanAccessResource(
      roles,
      OBSERVABILITY_PERMISSION_RESOURCE,
      'approve',
    );
    const includeOtherTenants = wantCross && canCross;
    const snapshot = await this.dashboards.query({
      dashboardId: id,
      tenantId: includeOtherTenants ? null : user.tenantId,
      includeOtherTenants,
    });
    if (!snapshot) {
      return { visible: false, reason: 'not_found' };
    }
    return { visible: true, crossTenant: includeOtherTenants, snapshot };
  }

  private async assertLicensed(tenantId: string): Promise<boolean> {
    if (!isSystemMonitoringObservabilityEnabled()) return false;
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    return policy.allowObservability === true;
  }
}
