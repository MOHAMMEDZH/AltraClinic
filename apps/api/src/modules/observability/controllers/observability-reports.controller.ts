import {
  Controller,
  Get,
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
import { isSystemMonitoringObservabilityEnabled } from '../config/observability-config';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { OpsReportingService } from '../application/reporting/ops-reporting.service';
import type { OpsReportKind } from '../domain/report.types';

/**
 * Phase 45e — operational reports (OD-REPORT).
 */
@Controller('observability/reports')
@UseGuards(TenantScopedAccessGuard)
export class ObservabilityReportsController {
  constructor(
    private readonly reports: OpsReportingService,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  @Get()
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async kinds(@CurrentUser() user: JwtClaimsVO) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied', kinds: [] };
    }
    return {
      visible: true,
      phase: '45e',
      kinds: this.reports.listKinds(),
    };
  }

  @Get('export/:kind')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'export')
  async export(
    @CurrentUser() user: JwtClaimsVO,
    @Param('kind') kind: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied' };
    }
    if (!this.reports.listKinds().includes(kind as OpsReportKind)) {
      return { visible: false, reason: 'unknown_kind' };
    }
    const report = await this.reports.generate(
      kind as OpsReportKind,
      user.tenantId,
      false,
    );
    return {
      visible: true,
      format: 'json',
      export: this.reports.exportJson(report),
      schemaVersion: '45e',
    };
  }

  @Get(':kind')
  @RequirePermission(OBSERVABILITY_PERMISSION_RESOURCE, 'view')
  async generate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('kind') kind: string,
    @Query('crossTenant') crossTenantRaw?: string,
    @Query('format') format?: string,
  ) {
    const allowed = await this.assertLicensed(user.tenantId);
    if (!allowed) {
      return { visible: false, reason: 'license_or_flag_denied' };
    }
    if (!this.reports.listKinds().includes(kind as OpsReportKind)) {
      return { visible: false, reason: 'unknown_kind' };
    }
    const wantCross = crossTenantRaw === 'true' || crossTenantRaw === '1';
    const canCross = rolesCanAccessResource(
      user.roles.map(String),
      OBSERVABILITY_PERMISSION_RESOURCE,
      'approve',
    );
    const includeOtherTenants = wantCross && canCross;
    const report = await this.reports.generate(
      kind as OpsReportKind,
      includeOtherTenants ? null : user.tenantId,
      includeOtherTenants,
    );
    if (format === 'json') {
      return {
        visible: true,
        format: 'json',
        export: this.reports.exportJson(report),
      };
    }
    return { visible: true, crossTenant: includeOtherTenants, report };
  }

  private async assertLicensed(tenantId: string): Promise<boolean> {
    if (!isSystemMonitoringObservabilityEnabled()) return false;
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    return policy.allowObservability === true;
  }
}
