import { DomainEvent } from './event.base';

interface TenantScopedDomainEvent {
  tenantId?: unknown;
}

function readTenantId(event: DomainEvent): string {
  const candidate = (event as TenantScopedDomainEvent).tenantId;
  return String(candidate ?? '').trim();
}

export function assertTenantScopedEvent(event: DomainEvent): void {
  const tenantId = readTenantId(event);
  if (!tenantId) {
    throw new Error(`Domain event ${event.constructor.name} is missing tenantId.`);
  }
}
