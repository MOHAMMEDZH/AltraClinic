/**
 * Phase 45a — repository ports for durable Observability config/state (later phases).
 * Null implementations only in 45a.
 */

export const OBSERVABILITY_CONFIG_REPOSITORY = Symbol(
  'OBSERVABILITY_CONFIG_REPOSITORY',
);
export const HEALTH_CONTRIBUTOR_REGISTRY = Symbol(
  'HEALTH_CONTRIBUTOR_REGISTRY',
);

export interface ObservabilityConfigRecord {
  id: string;
  tenantId: string | null;
  key: string;
  updatedAt: string;
}

export interface ObservabilityConfigRepository {
  findByKey(
    tenantId: string | null,
    key: string,
  ): Promise<ObservabilityConfigRecord | null>;
  listByTenant(
    tenantId: string | null,
  ): Promise<readonly ObservabilityConfigRecord[]>;
}

export interface HealthContributorRegistration {
  id: string;
  source: string;
  registeredAt: string;
}

export interface HealthContributorRegistryPort {
  list(): Promise<readonly HealthContributorRegistration[]>;
}
