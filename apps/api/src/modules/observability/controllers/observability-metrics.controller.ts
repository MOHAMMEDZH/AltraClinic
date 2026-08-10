import {
  Controller,
  Get,
  Header,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import {
  OBSERVABILITY_PERMISSION_RESOURCE,
} from '../observability.constants';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFoundationConfig,
} from '../config/observability-config';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import {
  METRICS_PIPELINE,
  type MetricsPipelineService,
} from '../application/ports/services';

/**
 * Phase 45b — metrics catalog/query (RBAC) and scrape export surface.
 */
@Controller()
export class ObservabilityMetricsController {
  constructor(
    @Inject(METRICS_PIPELINE) private readonly pipeline: MetricsPipelineService,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  /** OD-EXPORT — reserved scrape path. Network restriction is an ops concern. */
  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape(): string {
    return this.pipeline.exportText?.() ?? '# metrics unavailable\n';
  }

  @Get('observability/metrics/catalog')
  @UseGuards(TenantScopedAccessGuard)
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async catalog(@CurrentUser() user: JwtClaimsVO) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return {
        visible: false,
        reason: 'license_or_flag_denied',
        descriptors: [],
      };
    }
    const descriptors = this.pipeline.listDescriptors?.() ?? [];
    return {
      visible: true,
      phase: '45b',
      count: descriptors.length,
      descriptors: descriptors.map((d) => ({
        name: d.name,
        type: d.type,
        unit: d.unit,
        description: d.description,
        allowedLabels: d.allowedLabels,
        scope: d.scope,
        dataClass: d.dataClass,
        maxSeries: d.maxSeries,
        retentionDays: d.retentionDays,
      })),
    };
  }

  @Get('observability/metrics/query')
  @UseGuards(TenantScopedAccessGuard)
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async query(
    @CurrentUser() user: JwtClaimsVO,
    @Query('name') name?: string,
    @Query('sinceMs') sinceMsRaw?: string,
    @Query('crossTenant') crossTenantRaw?: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', series: [] };
    }

    const roles = user.roles.map(String);
    const wantCross =
      crossTenantRaw === 'true' || crossTenantRaw === '1';
    const canCross = rolesCanAccessResource(
      roles,
      OBSERVABILITY_PERMISSION_RESOURCE,
      'approve',
    );
    const includeOtherTenants = wantCross && canCross;

    const sinceMs = sinceMsRaw ? Number(sinceMsRaw) : undefined;
    const series =
      this.pipeline.query?.({
        name,
        tenantId: includeOtherTenants ? undefined : user.tenantId,
        sinceMs: Number.isFinite(sinceMs) ? sinceMs : undefined,
        includeOtherTenants,
      }) ?? [];

    // Defense in depth: strip other tenants if not elevated.
    const filtered = includeOtherTenants
      ? series
      : series.filter(
          (s) => s.tenantId === null || s.tenantId === user.tenantId,
        );

    return {
      visible: true,
      crossTenant: includeOtherTenants,
      count: filtered.length,
      series: filtered,
      diagnostics: this.pipeline.diagnostics?.(),
    };
  }

  @Get('observability/metrics/diagnostics')
  @UseGuards(TenantScopedAccessGuard)
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async diagnostics(@CurrentUser() user: JwtClaimsVO) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied' };
    }
    const config = loadObservabilityFoundationConfig();
    return {
      visible: true,
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      flags: config.flags,
      pipeline: this.pipeline.diagnostics?.(),
      contractVersion: this.pipeline.contractVersion,
    };
  }

  private async assertLicensed(tenantId: string): Promise<boolean> {
    if (!isSystemMonitoringObservabilityEnabled()) return false;
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    return policy.allowObservability === true;
  }
}
