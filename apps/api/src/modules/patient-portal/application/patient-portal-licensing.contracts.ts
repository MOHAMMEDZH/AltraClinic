/**
 * Phase 46a — Licensing capability registry.
 * Consumes patientPortal module license + allowPatientPortal tenant gate.
 */
import {
  PATIENT_PORTAL_CAREGIVER_LICENSE_FEATURE,
  PATIENT_PORTAL_LICENSED_MODULE,
  PATIENT_PORTAL_TENANT_LICENSE_GATE,
} from '../patient-portal.constants';

export class PatientPortalLicensingContracts {
  readonly licensedModule = PATIENT_PORTAL_LICENSED_MODULE;
  readonly tenantGate = PATIENT_PORTAL_TENANT_LICENSE_GATE;
  readonly caregiverFeature = PATIENT_PORTAL_CAREGIVER_LICENSE_FEATURE;

  getLicensedModule(): typeof PATIENT_PORTAL_LICENSED_MODULE {
    return this.licensedModule;
  }

  getTenantLicenseGate(): typeof PATIENT_PORTAL_TENANT_LICENSE_GATE {
    return this.tenantGate;
  }

  getCaregiverLicenseFeature(): typeof PATIENT_PORTAL_CAREGIVER_LICENSE_FEATURE {
    return this.caregiverFeature;
  }

  listCapabilities(): readonly string[] {
    return [this.licensedModule, this.caregiverFeature];
  }
}
