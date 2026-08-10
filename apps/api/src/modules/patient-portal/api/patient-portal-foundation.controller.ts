import { Controller, Get, Headers, Query } from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import { loadPatientPortalFoundationConfig } from '../config/patient-portal-config';
import { EffectivePatientPortalViewService } from '../application/effective-patient-portal-view.service';
import { PatientPortalHealthContributors } from '../application/patient-portal-health.contributors';
import { PatientPortalObservabilityContracts } from '../application/patient-portal-observability.contracts';
import { PatientPortalLicensingContracts } from '../application/patient-portal-licensing.contracts';
import { parsePatientPortalBranchFilter } from '../application/patient-portal-branch-context';
import { PortalBrandingResolverService } from '../application/services/portal-branding-resolver.service';
import {
  PATIENT_PORTAL_METRICS_NAMESPACE,
  PATIENT_PORTAL_PERMISSION_RESOURCE,
  PATIENT_PORTAL_TRACE_NAMESPACE,
} from '../patient-portal.constants';

/**
 * Phase 46a/46e foundation readiness + branding bootstrap (no PHI).
 */
@Controller('patient-portal')
export class PatientPortalFoundationController {
  constructor(
    private readonly effectiveView: EffectivePatientPortalViewService,
    private readonly healthContributors: PatientPortalHealthContributors,
    private readonly observability: PatientPortalObservabilityContracts,
    private readonly licensing: PatientPortalLicensingContracts,
    private readonly branding: PortalBrandingResolverService,
  ) {}

  @Public()
  @Get('health')
  async health(
    @Headers('x-tenant-id') tenantHeader?: string,
    @Query('tenantId') tenantQuery?: string,
    @Query('branchId') branchQuery?: string,
  ) {
    const config = loadPatientPortalFoundationConfig();
    const tenantId = (tenantHeader ?? tenantQuery ?? '').trim() || undefined;
    const branch = parsePatientPortalBranchFilter(branchQuery);
    const view = await this.effectiveView.resolve({
      tenantId,
      branchId: branch.branchId,
      hasReadPermission: true,
    });

    return {
      ready: true,
      dormant: !config.featureEnabled,
      phase: '46e',
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      flags: config.flags,
      api: {
        namespace: config.apiNamespace,
        version: config.apiVersion,
      },
      permissionResource: PATIENT_PORTAL_PERMISSION_RESOURCE,
      licensing: {
        module: this.licensing.getLicensedModule(),
        tenantGate: this.licensing.getTenantLicenseGate(),
        caregiverFeature: this.licensing.getCaregiverLicenseFeature(),
        capabilities: this.licensing.listCapabilities(),
      },
      allowPatientPortal: view.allowPatientPortal,
      visible: view.visible,
      branchFilter: branch,
      productSurfacesLive: config.featureEnabled && view.visible,
      experienceReady: true,
      observability: {
        metricsNamespace: PATIENT_PORTAL_METRICS_NAMESPACE,
        traceNamespace: PATIENT_PORTAL_TRACE_NAMESPACE,
        logKind: this.observability.logKind,
        metricNames: this.observability.listMetricNames(),
        correlationIdField: this.observability.correlationIdField(),
      },
      healthContributors: this.healthContributors.listDefinitions(),
    };
  }

  @Public()
  @Get('branding')
  async getBranding(
    @Headers('x-tenant-id') tenantHeader?: string,
    @Query('tenantId') tenantQuery?: string,
  ) {
    const tenantId = (tenantHeader ?? tenantQuery ?? '').trim() || undefined;
    return this.branding.resolve(tenantId);
  }

  @Public()
  @Get('foundation')
  async foundation() {
    const health = await this.health();
    return {
      ...health,
      implementationStatus: '46e_experience',
      deferred: [
        'clinical_results_display',
        'messaging',
        'billing',
        'payments',
        'documents',
      ],
    };
  }
}
