/**
 * Phase 45d — platform health model (OD-HEALTH).
 */

export type HealthStatus = 'healthy' | 'degraded' | 'dormant' | 'unhealthy';

export interface HealthContributorResult {
  id: string;
  status: HealthStatus;
  /** If unhealthy, readiness fails. */
  critical: boolean;
  description: string;
  message?: string;
  latencyMs?: number;
  checkedAt: string;
}

export interface PlatformHealthReport {
  status: HealthStatus;
  live: boolean;
  ready: boolean;
  dormant: boolean;
  featureFlag: { name: string; enabled: boolean };
  contributors: readonly HealthContributorResult[];
  summary: {
    healthy: number;
    degraded: number;
    dormant: number;
    unhealthy: number;
  };
  phase: '45d';
  checkedAt: string;
}

export interface HealthProbe {
  id: string;
  critical: boolean;
  description: string;
  check: () => Promise<Omit<HealthContributorResult, 'id' | 'critical' | 'description' | 'checkedAt'>> | Omit<HealthContributorResult, 'id' | 'critical' | 'description' | 'checkedAt'>;
}
