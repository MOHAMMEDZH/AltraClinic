/**
 * Phase 45a/45d — Health contributor framework (definitions + registration registry).
 * Live probes execute in PlatformHealthAggregatorService (45d).
 * Definitions remain dormant | not_configured when center flag is OFF / not probed here.
 */
import { Injectable } from '@nestjs/common';
import { OBSERVABILITY_HEALTH_CONTRIBUTORS } from '../observability.constants';
import { loadObservabilityFoundationConfig } from '../config/observability-config';
import type { HealthContributorRegistration } from './ports/repositories';

export type ObservabilityHealthContributorId =
  (typeof OBSERVABILITY_HEALTH_CONTRIBUTORS)[number];

/** OD-HEALTH statuses; 45a uses only dormant | not_configured. */
export type ObservabilityHealthContributorStatus =
  | 'healthy'
  | 'degraded'
  | 'dormant'
  | 'unhealthy'
  | 'not_configured';

export interface ObservabilityHealthContributorDefinition {
  id: ObservabilityHealthContributorId;
  status: ObservabilityHealthContributorStatus;
  description: string;
}

@Injectable()
export class ObservabilityHealthContributors {
  private readonly dynamicRegistrations: HealthContributorRegistration[] = [];

  listDefinitions(): readonly ObservabilityHealthContributorDefinition[] {
    const dormant = !loadObservabilityFoundationConfig().featureEnabled;
    const status: ObservabilityHealthContributorStatus = dormant
      ? 'dormant'
      : 'not_configured';
    return OBSERVABILITY_HEALTH_CONTRIBUTORS.map((id) => ({
      id,
      status,
      description: `Phase 45a definition for ${id} (no runtime probe)`,
    }));
  }

  /**
   * Extension point: register a contributor id for later live probes (45d).
   * Does not evaluate health.
   */
  registerContributor(source: string, id: string): void {
    this.dynamicRegistrations.push({
      id,
      source,
      registeredAt: new Date().toISOString(),
    });
  }

  listRegisteredContributors(): readonly HealthContributorRegistration[] {
    return [...this.dynamicRegistrations];
  }
}
