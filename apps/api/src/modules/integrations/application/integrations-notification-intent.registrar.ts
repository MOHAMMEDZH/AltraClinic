import { Injectable } from '@nestjs/common';

export type IntegrationsNotificationIntentKind =
  | 'credential_expiring'
  | 'credential_revoked'
  | 'credential_created'
  | 'credential_rotated'
  | 'credential_expiring_soon'
  | 'webhook_delivery_failed'
  | 'webhook_dead_lettered'
  | 'quota_exceeded'
  | 'inbound_rejected'
  | 'migration_complete'
  | 'pepper_not_ready'
  | 'secret_store_not_ready';

/**
 * Phase 44b — registers notification intents only (no delivery / no Phase 41 edits).
 */
@Injectable()
export class IntegrationsNotificationIntentRegistrar {
  private readonly registered: Array<{
    kind: IntegrationsNotificationIntentKind;
    tenantId: string;
    credentialId?: string;
    correlationId?: string;
    at: string;
  }> = [];

  listRegisteredKinds(): readonly IntegrationsNotificationIntentKind[] {
    return [
      'credential_expiring',
      'credential_revoked',
      'credential_created',
      'credential_rotated',
      'credential_expiring_soon',
      'webhook_delivery_failed',
      'webhook_dead_lettered',
      'quota_exceeded',
      'inbound_rejected',
      'migration_complete',
      'pepper_not_ready',
      'secret_store_not_ready',
    ];
  }

  recordIntent(
    kind: IntegrationsNotificationIntentKind,
    payload: {
      tenantId: string;
      credentialId?: string;
      correlationId?: string;
    },
  ): void {
    this.registered.push({
      kind,
      tenantId: payload.tenantId,
      credentialId: payload.credentialId,
      correlationId: payload.correlationId,
      at: new Date().toISOString(),
    });
  }

  drainRecorded() {
    const copy = [...this.registered];
    this.registered.length = 0;
    return copy;
  }
}
