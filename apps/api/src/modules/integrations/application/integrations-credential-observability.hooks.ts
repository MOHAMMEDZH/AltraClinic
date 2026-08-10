/**
 * Phase 44b — observability hooks (counters only; no external backends).
 */
import { Injectable } from '@nestjs/common';
import { INTEGRATIONS_METRIC_NAMES } from '../integrations.constants';

@Injectable()
export class IntegrationsCredentialObservabilityHooks {
  private readonly counters = new Map<string, number>();

  listMetricNames(): readonly string[] {
    return INTEGRATIONS_METRIC_NAMES;
  }

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  getCount(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  drainCounts(): Record<string, number> {
    const out = Object.fromEntries(this.counters.entries());
    this.counters.clear();
    return out;
  }
}
