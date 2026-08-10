/**
 * Phase 44a — Health contributor definitions only.
 * No live probes beyond foundation health endpoint.
 */
import { INTEGRATIONS_HEALTH_CONTRIBUTORS } from '../integrations.constants';
import { loadIntegrationsFoundationConfig } from '../config/integrations-config';

export type IntegrationsHealthContributorId =
  (typeof INTEGRATIONS_HEALTH_CONTRIBUTORS)[number];

export interface IntegrationsHealthContributorDefinition {
  id: IntegrationsHealthContributorId;
  /** Always not_configured / dormant in 44a (no adapters). */
  status: 'not_configured' | 'dormant';
  description: string;
}

export class IntegrationsHealthContributors {
  listDefinitions(): readonly IntegrationsHealthContributorDefinition[] {
    const dormant = !loadIntegrationsFoundationConfig().featureEnabled;
    const status = dormant ? 'dormant' : 'not_configured';
    return INTEGRATIONS_HEALTH_CONTRIBUTORS.map((id) => ({
      id,
      status,
      description: `Phase 44a definition for ${id} (no runtime probe)`,
    }));
  }
}
