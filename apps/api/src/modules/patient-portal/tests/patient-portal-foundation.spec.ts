import {
  PATIENT_PORTAL_API_NAMESPACE,
  PATIENT_PORTAL_API_VERSION,
  PATIENT_PORTAL_CENTER_ENABLED_ENV,
  PATIENT_PORTAL_ERROR_CODES,
  PATIENT_PORTAL_HEALTH_CONTRIBUTORS,
  PATIENT_PORTAL_LICENSED_MODULE,
  PATIENT_PORTAL_PERMISSION_RESOURCE,
  PATIENT_PORTAL_TENANT_LICENSE_GATE,
} from '../patient-portal.constants';
import {
  isPatientPortalCenterEnabled,
  loadPatientPortalFoundationConfig,
} from '../config/patient-portal-config';
import { PatientPortalHealthContributors } from '../application/patient-portal-health.contributors';
import { PatientPortalObservabilityContracts } from '../application/patient-portal-observability.contracts';
import { PatientPortalLicensingContracts } from '../application/patient-portal-licensing.contracts';
import { EffectivePatientPortalViewService } from '../application/effective-patient-portal-view.service';
import {
  assertPatientPortalTenantMatch,
  buildPatientPortalTenantContext,
  PatientPortalTenantContextError,
  resolvePatientPortalTenantId,
} from '../application/patient-portal-tenant-context';
import {
  applyPatientPortalBranchFilter,
  parsePatientPortalBranchFilter,
} from '../application/patient-portal-branch-context';
import { PatientPortalCenterEnabledGuard } from '../api/patient-portal-center.guard';
import { PatientPortalFoundationController } from '../api/patient-portal-foundation.controller';
import { PortalBrandingResolverService } from '../application/services/portal-branding-resolver.service';
import {
  buildPatientPortalSafeError,
  listPatientPortalErrorCodes,
} from '../api/patient-portal-safe-errors';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { ServiceUnavailableException } from '@nestjs/common';

function brandingStub(): PortalBrandingResolverService {
  return {
    resolve: jest.fn().mockResolvedValue({
      clinicName: 'Patient Portal',
      primaryColor: '#0f766e',
      secondaryColor: '#134e4a',
      logoUrl: null,
      faviconUrl: null,
      fontFamily: null,
      portalName: 'Patient Portal',
      source: 'default',
    }),
  } as unknown as PortalBrandingResolverService;
}

describe('Phase 46a — Patient Portal foundation', () => {
  const previousFlags: Record<string, string | undefined> = {};
  const flagKeys = [
    'PATIENT_PORTAL_CENTER_ENABLED',
    'PATIENT_PORTAL_APPOINTMENTS_ENABLED',
    'PATIENT_PORTAL_CAREGIVER_ENABLED',
    'PATIENT_PORTAL_PROFILE_ENABLED',
    'PATIENT_PORTAL_RECORDS_ENABLED',
    'PATIENT_PORTAL_MESSAGING_ENABLED',
    'PATIENT_PORTAL_BILLING_ENABLED',
    'PATIENT_PORTAL_PAYMENTS_ENABLED',
    'PATIENT_PORTAL_DOCUMENTS_ENABLED',
  ];

  beforeEach(() => {
    for (const key of flagKeys) {
      previousFlags[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of flagKeys) {
      const prev = previousFlags[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it('defaults all feature flags OFF and loads dormant config', () => {
    expect(isPatientPortalCenterEnabled()).toBe(false);
    const config = loadPatientPortalFoundationConfig();
    expect(config.featureEnabled).toBe(false);
    expect(config.featureFlagEnv).toBe(PATIENT_PORTAL_CENTER_ENABLED_ENV);
    expect(config.apiNamespace).toBe(PATIENT_PORTAL_API_NAMESPACE);
    expect(config.apiVersion).toBe(PATIENT_PORTAL_API_VERSION);
    expect(config.flags).toEqual({
      centerEnabled: false,
      appointmentsEnabled: false,
      caregiverEnabled: false,
      profileEnabled: false,
      recordsEnabled: false,
      messagingEnabled: false,
      billingEnabled: false,
      paymentsEnabled: false,
      documentsEnabled: false,
    });
  });

  it('parses explicit true flag values only', () => {
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'true';
    expect(isPatientPortalCenterEnabled()).toBe(true);
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'yes';
    expect(isPatientPortalCenterEnabled()).toBe(true);
    process.env.PATIENT_PORTAL_CENTER_ENABLED = '1';
    expect(isPatientPortalCenterEnabled()).toBe(true);
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'false';
    expect(isPatientPortalCenterEnabled()).toBe(false);
  });

  it('registers RBAC resource against runtime matrix', () => {
    expect(PATIENT_PORTAL_PERMISSION_RESOURCE).toBe('api.patient_portal');
    expect(rolesCanAccessResource(['patient'], 'api.patient_portal', 'view')).toBe(true);
    expect(rolesCanAccessResource(['owner'], 'api.patient_portal', 'manage')).toBe(true);
  });

  it('registers licensing module and allowPatientPortal tenant gate', () => {
    const licensing = new PatientPortalLicensingContracts();
    expect(licensing.getLicensedModule()).toBe(PATIENT_PORTAL_LICENSED_MODULE);
    expect(licensing.getTenantLicenseGate()).toBe(PATIENT_PORTAL_TENANT_LICENSE_GATE);
    expect(licensing.listCapabilities()).toContain('patientPortal');
    expect(licensing.listCapabilities()).toContain('caregiverAccess');
  });

  it('EffectivePatientPortalView is not visible when flag OFF', async () => {
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowPatientPortal: true,
        allowObservability: false,
        allowBackupRestore: false,
        allowIntegrations: false,
        allowDataImport: true,
        allowDataExport: true,
        maintenanceMode: false,
      }),
    };
    const view = new EffectivePatientPortalViewService(tenantPolicy as never);
    const result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      hasReadPermission: true,
    });
    expect(result.featureEnabled).toBe(false);
    expect(result.allowPatientPortal).toBe(true);
    expect(result.visible).toBe(false);
    expect(result.dormant).toBe(true);
    expect(result.meta.productSurfacesLive).toBe(false);
    expect(tenantPolicy.getAdvancedPolicy).toHaveBeenCalledWith('tenant-a');
  });

  it('EffectivePatientPortalView denies when allowPatientPortal is false', async () => {
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'true';
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowPatientPortal: false,
        allowObservability: false,
        allowBackupRestore: false,
        allowIntegrations: false,
        allowDataImport: true,
        allowDataExport: true,
        maintenanceMode: false,
      }),
    };
    const view = new EffectivePatientPortalViewService(tenantPolicy as never);
    const result = await view.resolve({
      tenantId: 'tenant-a',
      hasReadPermission: true,
    });
    expect(result.featureEnabled).toBe(true);
    expect(result.allowPatientPortal).toBe(false);
    expect(result.visible).toBe(false);
  });

  it('health endpoint reports ready / dormant foundation state', async () => {
    const controller = new PatientPortalFoundationController(
      new EffectivePatientPortalViewService({
        getAdvancedPolicy: jest.fn().mockResolvedValue({ allowPatientPortal: false }),
      } as never),
      new PatientPortalHealthContributors(),
      new PatientPortalObservabilityContracts(),
      new PatientPortalLicensingContracts(),
      brandingStub(),
    );
    const health = await controller.health();
    expect(health.ready).toBe(true);
    expect(health.dormant).toBe(true);
    expect(health.phase).toBe('46e');
    expect(health.experienceReady).toBe(true);
    expect(health.featureFlag.enabled).toBe(false);
    expect(health.productSurfacesLive).toBe(false);
    expect(health.healthContributors.length).toBe(PATIENT_PORTAL_HEALTH_CONTRIBUTORS.length);
    expect(health.observability.metricsNamespace).toBe('patient_portal');
  });

  it('foundation endpoint lists deferred product capabilities', async () => {
    const controller = new PatientPortalFoundationController(
      new EffectivePatientPortalViewService({
        getAdvancedPolicy: jest.fn().mockResolvedValue({ allowPatientPortal: false }),
      } as never),
      new PatientPortalHealthContributors(),
      new PatientPortalObservabilityContracts(),
      new PatientPortalLicensingContracts(),
      brandingStub(),
    );
    const foundation = await controller.foundation();
    expect(foundation.implementationStatus).toBe('46e_experience');
    expect(foundation.deferred).toContain('messaging');
    expect(foundation.deferred).toContain('clinical_results_display');
    expect(foundation.deferred).not.toContain('enrollment');
  });

  it('branding endpoint returns safe defaults without tenant', async () => {
    const controller = new PatientPortalFoundationController(
      new EffectivePatientPortalViewService({
        getAdvancedPolicy: jest.fn().mockResolvedValue({ allowPatientPortal: false }),
      } as never),
      new PatientPortalHealthContributors(),
      new PatientPortalObservabilityContracts(),
      new PatientPortalLicensingContracts(),
      brandingStub(),
    );
    const branding = await controller.getBranding();
    expect(branding.source).toBe('default');
    expect(branding.primaryColor).toBeTruthy();
  });

  it('CenterEnabledGuard denies when flag OFF', () => {
    const guard = new PatientPortalCenterEnabledGuard();
    expect(() => guard.canActivate({} as never)).toThrow(ServiceUnavailableException);
    try {
      guard.canActivate({} as never);
    } catch (error) {
      const response = (error as ServiceUnavailableException).getResponse() as {
        code: string;
      };
      expect(response.code).toBe(PATIENT_PORTAL_ERROR_CODES.DISABLED);
    }
  });

  it('CenterEnabledGuard allows when flag ON', () => {
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'true';
    const guard = new PatientPortalCenterEnabledGuard();
    expect(guard.canActivate({} as never)).toBe(true);
  });

  it('resolves and validates tenant context fail-closed', () => {
    expect(resolvePatientPortalTenantId(' tenant-1 ')).toBe('tenant-1');
    expect(buildPatientPortalTenantContext('tenant-1')).toEqual({ tenantId: 'tenant-1' });
    expect(() => resolvePatientPortalTenantId('')).toThrow(PatientPortalTenantContextError);
    expect(() => assertPatientPortalTenantMatch('a', 'b')).toThrow(
      PatientPortalTenantContextError,
    );
    assertPatientPortalTenantMatch('a', 'a');
  });

  it('branch filter never expands authorization', () => {
    expect(parsePatientPortalBranchFilter(undefined)).toEqual({ branchId: null });
    expect(parsePatientPortalBranchFilter('  branch-1 ')).toEqual({ branchId: 'branch-1' });
    const items = [
      { id: '1', branchId: 'b1' },
      { id: '2', branchId: 'b2' },
      { id: '3', branchId: null },
    ];
    expect(applyPatientPortalBranchFilter(items, { branchId: null })).toHaveLength(3);
    expect(applyPatientPortalBranchFilter(items, { branchId: 'b1' })).toEqual([
      { id: '1', branchId: 'b1' },
    ]);
  });

  it('patient-safe error contracts omit PHI', () => {
    const body = buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.TENANT_MISMATCH, 'c1');
    expect(body.message).not.toMatch(/patient|phi|email|mrn/i);
    expect(listPatientPortalErrorCodes()).toContain(PATIENT_PORTAL_ERROR_CODES.DISABLED);
  });

  it('observability contracts register hooks without PHI', () => {
    const obs = new PatientPortalObservabilityContracts();
    const fields = obs.createFoundationLogFields({
      event: 'health_check',
      tenantId: 't1',
      correlationId: 'c1',
    });
    expect(fields.phi).toBe(false);
    expect(fields.kind).toBe('patient_portal');
    expect(obs.listMetricNames().length).toBeGreaterThan(0);
  });

  it('health contributors are dormant when flag OFF', () => {
    const contributors = new PatientPortalHealthContributors();
    const defs = contributors.listDefinitions();
    expect(defs.every((d) => d.status === 'dormant' || d.status === 'ready')).toBe(true);
    expect(defs.filter((d) => d.status === 'dormant').length).toBeGreaterThan(0);
    expect(contributors.registerContributor('46a', 'configuration')).toEqual({
      source: '46a',
      id: 'configuration',
    });
  });
});
