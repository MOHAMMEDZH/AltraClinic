/**
 * Phase 46a/46e — Health contributor definitions (Release 45 reuse).
 * Foundation + experience readiness; no PHI.
 */
import { Injectable } from '@nestjs/common';
import { PATIENT_PORTAL_HEALTH_CONTRIBUTORS } from '../patient-portal.constants';
import { loadPatientPortalFoundationConfig } from '../config/patient-portal-config';

export type PatientPortalHealthContributorId =
  (typeof PATIENT_PORTAL_HEALTH_CONTRIBUTORS)[number];

export interface PatientPortalHealthContributorDefinition {
  id: PatientPortalHealthContributorId;
  status: 'not_configured' | 'dormant' | 'ready';
  description: string;
}

@Injectable()
export class PatientPortalHealthContributors {
  listDefinitions(): readonly PatientPortalHealthContributorDefinition[] {
    const config = loadPatientPortalFoundationConfig();
    const dormant = !config.featureEnabled;
    return PATIENT_PORTAL_HEALTH_CONTRIBUTORS.map((id) => {
      if (
        id === 'configuration' ||
        id === 'feature_flags' ||
        id === 'api_namespace' ||
        id === 'white_label' ||
        id === 'observability_hooks' ||
        id === 'licensing' ||
        id === 'rbac' ||
        id === 'tenant_context' ||
        id === 'branch_context'
      ) {
        return {
          id,
          status: dormant ? 'dormant' : 'ready',
          description: `Phase 46e experience readiness for ${id}`,
        };
      }
      return {
        id,
        status: dormant ? 'dormant' : 'not_configured',
        description: `Phase 46e definition for ${id}`,
      };
    });
  }

  registerContributor(source: string, id: string): { source: string; id: string } {
    return { source, id };
  }
}
