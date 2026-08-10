/**
 * Phase 45a — Activity event name registry only.
 * Does NOT emit Activity at runtime.
 */
import { OBSERVABILITY_ACTIVITY_EVENTS } from '../observability.constants';

export type ObservabilityActivityEventName =
  (typeof OBSERVABILITY_ACTIVITY_EVENTS)[number];

export class ObservabilityActivityContracts {
  readonly eventNames: readonly ObservabilityActivityEventName[] =
    OBSERVABILITY_ACTIVITY_EVENTS;

  listEventNames(): readonly ObservabilityActivityEventName[] {
    return this.eventNames;
  }
}
