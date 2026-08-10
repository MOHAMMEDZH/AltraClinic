import { Injectable, Logger } from '@nestjs/common';
import { INTEGRATIONS_LOG_KIND } from '../integrations.constants';
import { redactCredentialSecrets } from '../domain/credential-hashing';

export type IntegrationsActivityEvent =
  | 'credential_created'
  | 'credential_rotated'
  | 'credential_revoked'
  | 'credential_expired'
  | 'service_account_created'
  | 'service_account_disabled'
  | 'legacy_key_imported'
  | 'migration_status_changed'
  | 'webhook_subscription_created'
  | 'webhook_subscription_updated'
  | 'webhook_subscription_disabled'
  | 'webhook_delivered'
  | 'webhook_failed'
  | 'webhook_dead_lettered'
  | 'inbound_received'
  | 'inbound_rejected'
  | 'quota_exceeded'
  | 'auth_rejected';

export interface IntegrationsActivityPayload {
  tenantId: string;
  branchId?: string | null;
  credentialId?: string;
  serviceAccountId?: string;
  status?: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string;
}

/**
 * Phase 44b — Activity lifecycle emit (structured logs). No secrets in payloads.
 */
@Injectable()
export class IntegrationsActivityEmitterService {
  private readonly logger = new Logger(IntegrationsActivityEmitterService.name);
  private readonly emitted: Array<{
    event: IntegrationsActivityEvent;
    payload: IntegrationsActivityPayload;
  }> = [];

  drainEmitted() {
    const copy = [...this.emitted];
    this.emitted.length = 0;
    return copy;
  }

  async emit(
    event: IntegrationsActivityEvent,
    payload: IntegrationsActivityPayload,
  ): Promise<void> {
    const safe: IntegrationsActivityPayload = {
      tenantId: payload.tenantId,
      branchId: payload.branchId ?? null,
      credentialId: payload.credentialId,
      serviceAccountId: payload.serviceAccountId,
      status: payload.status,
      correlationId: payload.correlationId,
      causationId: payload.causationId ?? null,
      reason: payload.reason
        ? redactCredentialSecrets(payload.reason)
        : undefined,
    };
    this.emitted.push({ event, payload: safe });
    this.logger.log({
      kind: INTEGRATIONS_LOG_KIND,
      component: 'activity',
      event,
      ...safe,
    });
  }
}
