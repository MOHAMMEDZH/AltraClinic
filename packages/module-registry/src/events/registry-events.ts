import type { ModuleRegistryEvent, ModuleEventType } from '../types';

let eventCounter = 0;

export function createRegistryEvent(
  eventType: ModuleEventType,
  moduleId: string,
  options: {
    tenantId?: string;
    manifestId?: string;
    fromState?: string;
    toState?: string;
    actor?: { type: 'system' | 'user' | 'publisher'; id: string };
    payload?: Record<string, unknown>;
    correlationId?: string;
  } = {},
): ModuleRegistryEvent {
  eventCounter += 1;
  return {
    eventType,
    eventId: `mre-${Date.now()}-${eventCounter}`,
    occurredAt: new Date().toISOString(),
    tenantId: options.tenantId,
    moduleId,
    manifestId: options.manifestId,
    fromState: options.fromState,
    toState: options.toState,
    actor: options.actor ?? { type: 'system', id: 'module-registry' },
    payload: options.payload ?? {},
    correlationId: options.correlationId,
  };
}

export const REGISTRY_EVENT_CATALOG: Array<{
  eventType: ModuleEventType;
  purpose: string;
}> = [
  { eventType: 'module.discovered', purpose: 'Candidate manifest detected' },
  { eventType: 'module.registered', purpose: 'Manifest indexed in catalog' },
  { eventType: 'module.validated', purpose: 'Manifest passed validation' },
  { eventType: 'module.installed', purpose: 'Module bound to tenant' },
  { eventType: 'module.initialized', purpose: 'Runtime extension index ready' },
  { eventType: 'module.enabled', purpose: 'Module accessible in effective view' },
  { eventType: 'module.disabled', purpose: 'Module narrowed or hidden' },
  { eventType: 'module.degraded', purpose: 'Partial functionality' },
  { eventType: 'module.failed', purpose: 'Initialization or required probe failed' },
  { eventType: 'module.suspended', purpose: 'Administrative suspension' },
  { eventType: 'module.removed', purpose: 'Manifest withdrawn from catalog' },
  { eventType: 'module.uninstalled', purpose: 'Tenant module record removed' },
  { eventType: 'module.health.changed', purpose: 'Probe status transition' },
  { eventType: 'module.dependencies.changed', purpose: 'Dependency graph recomputed' },
  { eventType: 'module.upgraded', purpose: 'Manifest version upgraded' },
  { eventType: 'module.rollback', purpose: 'Prior manifest restored' },
];
