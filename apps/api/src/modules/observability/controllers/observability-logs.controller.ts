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
  CORRELATION_SERVICE,
  LOGGING_PIPELINE,
  type CorrelationService,
  type LoggingPipelineService,
} from '../application/ports/services';

/**
 * Phase 45c — structured log query / diagnostics (RBAC).
 */
@Controller('observability/logs')
@UseGuards(TenantScopedAccessGuard)
export class ObservabilityLogsController {
  constructor(
    @Inject(LOGGING_PIPELINE) private readonly logging: LoggingPipelineService,
    @Inject(CORRELATION_SERVICE)
    private readonly correlation: CorrelationService,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  @Get('query')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async query(
    @CurrentUser() user: JwtClaimsVO,
    @Query('category') category?: string,
    @Query('correlationId') correlationId?: string,
    @Query('sinceMs') sinceMsRaw?: string,
    @Query('crossTenant') crossTenantRaw?: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', events: [] };
    }

    const roles = user.roles.map(String);
    const wantCross = crossTenantRaw === 'true' || crossTenantRaw === '1';
    const canCross = rolesCanAccessResource(
      roles,
      OBSERVABILITY_PERMISSION_RESOURCE,
      'approve',
    );
    const includeOtherTenants = wantCross && canCross;
    const sinceMs = sinceMsRaw ? Number(sinceMsRaw) : undefined;

    const events =
      this.logging.query?.({
        category,
        correlationId,
        tenantId: includeOtherTenants ? undefined : user.tenantId,
        sinceMs: Number.isFinite(sinceMs) ? sinceMs : undefined,
        includeOtherTenants,
      }) ?? [];

    const filtered = includeOtherTenants
      ? events
      : events.filter(
          (e) => e.tenantId === null || e.tenantId === user.tenantId,
        );

    return {
      visible: true,
      crossTenant: includeOtherTenants,
      count: filtered.length,
      events: filtered,
      schemaVersion: '45c',
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
      logging: this.logging.diagnostics?.(),
      correlation: this.correlation.diagnostics?.(),
      contractVersions: {
        logging: this.logging.contractVersion,
        correlation: this.correlation.contractVersion,
      },
    };
  }

  private async assertLicensed(tenantId: string): Promise<boolean> {
    if (!isSystemMonitoringObservabilityEnabled()) return false;
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    return policy.allowObservability === true;
  }
}
