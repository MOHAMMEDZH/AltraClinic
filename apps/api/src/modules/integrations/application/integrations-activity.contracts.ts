/**
 * Phase 44a — Activity event name registry only.
 * Does NOT emit Activity at runtime.
 */
import { INTEGRATIONS_ACTIVITY_EVENTS } from '../integrations.constants';

export type IntegrationsActivityEventName =
  (typeof INTEGRATIONS_ACTIVITY_EVENTS)[number];

export class IntegrationsActivityContracts {
  readonly eventNames: readonly IntegrationsActivityEventName[] =
    INTEGRATIONS_ACTIVITY_EVENTS;

  listEventNames(): readonly IntegrationsActivityEventName[] {
    return this.eventNames;
  }
}
