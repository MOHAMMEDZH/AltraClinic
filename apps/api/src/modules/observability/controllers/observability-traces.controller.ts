import {
  Controller,
  Get,
  Inject,
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
  TRACING_SERVICE,
  type TracingService,
} from '../application/ports/services';

/**
 * Phase 45d — trace query / diagnostics (RBAC). No dashboards.
 */
@Controller('observability/traces')
@UseGuards(TenantScopedAccessGuard)
export class ObservabilityTracesController {
  constructor(
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  @Get('query')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async query(
    @CurrentUser() user: JwtClaimsVO,
    @Query('traceId') traceId?: string,
    @Query('crossTenant') crossTenantRaw?: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', spans: [] };
    }

    const roles = user.roles.map(String);
    const wantCross = crossTenantRaw === 'true' || crossTenantRaw === '1';
    const canCross = rolesCanAccessResource(
      roles,
      OBSERVABILITY_PERMISSION_RESOURCE,
      'approve',
    );
    const includeOtherTenants = wantCross && canCross;

    const spans =
      this.tracing.listSpans?.({
        traceId,
        tenantId: includeOtherTenants ? undefined : user.tenantId,
        includeOtherTenants,
      }) ?? [];

    const filtered = includeOtherTenants
      ? spans
      : spans.filter(
          (s) => s.tenantId === null || s.tenantId === user.tenantId,
        );

    return {
      visible: true,
      crossTenant: includeOtherTenants,
      count: filtered.length,
      spans: filtered,
      schemaVersion: '45d',
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
      tracing: this.tracing.diagnostics?.(),
      contractVersion: this.tracing.contractVersion,
      active: this.tracing.isActive?.() === true,
    };
  }

  private async assertLicensed(tenantId: string): Promise<boolean> {
    if (!isSystemMonitoringObservabilityEnabled()) return false;
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    return policy.allowObservability === true;
  }
}
