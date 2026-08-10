/**
 * Phase 44f — Production Acceptance gates (validation only; no new engines).
 */
import {
  isApiKeysIntegrationsCenterEnabled,
  loadIntegrationsFoundationConfig,
} from '../config/integrations-config';
import {
  API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
  INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
  INTEGRATIONS_PERMISSION_RESOURCE,
  INTEGRATIONS_HASH_ALGORITHM_ID,
} from '../integrations.constants';
import {
  hashApiCredential,
  redactCredentialSecrets,
  verifyApiCredentialHash,
} from '../domain/credential-hashing';
import { createFoundationHealthController } from './integrations-foundation.helpers';

describe('Phase 44f — Production Acceptance', () => {
  const prevFlag = process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED;

  afterAll(() => {
    if (prevFlag === undefined) {
      delete process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED;
    } else {
      process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = prevFlag;
    }
  });

  it('keeps master feature flag OFF when unset', () => {
    delete process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED;
    expect(isApiKeysIntegrationsCenterEnabled()).toBe(false);
    const cfg = loadIntegrationsFoundationConfig();
    expect(cfg.featureEnabled).toBe(false);
    expect(cfg.featureFlagEnv).toBe(API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV);
    expect(cfg.flags.centerEnabled).toBe(false);
    expect(cfg.flags.webhooksEnabled).toBe(false);
    expect(cfg.flags.inboundEnabled).toBe(false);
    expect(cfg.flags.serviceAccountsEnabled).toBe(false);
  });

  it('reserves isolated queue name integrations-webhooks', () => {
    expect(INTEGRATIONS_WEBHOOKS_QUEUE_NAME).toBe('integrations-webhooks');
    expect(loadIntegrationsFoundationConfig().queueName).toBe(
      'integrations-webhooks',
    );
  });

  it('uses peppered OD-HASH with constant-time verify + redaction', () => {
    const pepper = 'acceptance-pepper-material';
    const raw = 'bk_' + 'a'.repeat(48);
    const hash = hashApiCredential(raw, pepper);
    expect(verifyApiCredentialHash(raw, hash, pepper)).toBe(true);
    expect(verifyApiCredentialHash(raw + 'x', hash, pepper)).toBe(false);
    expect(INTEGRATIONS_HASH_ALGORITHM_ID).toBe('sha256_pepper_v1');
    expect(redactCredentialSecrets(`leak ${raw}`)).toContain('bk_[REDACTED]');
    expect(redactCredentialSecrets(`leak ${raw}`)).not.toContain(raw.slice(4));
  });

  it('health reports 44e ops readiness with engines wired and flag dormant', async () => {
    delete process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED;
    const health = await createFoundationHealthController().health();
    expect(health.ready).toBe(true);
    expect(health.dormant).toBe(true);
    expect(health.featureFlag.enabled).toBe(false);
    expect(health.phase).toBe('44e');
    expect(health.credentialEngine.wired).toBe(true);
    expect(health.webhookEngine.wired).toBe(true);
    expect(health.authMiddleware.wired).toBe(true);
    expect(health.gateway.wired).toBe(true);
    expect(health.quotaEngine.wired).toBe(true);
    expect(health.quotaEngine.redisDeferred).toBe(true);
    expect(health.queue.name).toBe('integrations-webhooks');
    expect(health.queue.wired).toBe(true);
  });

  it('binds RBAC resource api.integrations', () => {
    expect(INTEGRATIONS_PERMISSION_RESOURCE).toBe('api.integrations');
  });
});
