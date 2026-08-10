/**
 * Flexible Step 22 — integrations health matrix INT01–INT10 (PostgreSQL).
 */
import { PrismaClient } from '@prisma/client';
import {
  API_CREDENTIAL_PEPPER_REF_ENV,
  API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
  INTEGRATIONS_SECRET_KEY_REF_ENV,
} from '../../integrations/integrations.constants';
import type { OpsIntegrationRow } from '../domain/operations-console.types';
import {
  cleanupOpsConsoleTables,
  clearOpsFailureInjection,
  createOpsStack,
  createPlatformDbSecurityClient,
  enableOpsConsole,
  platformDbSecurityEnabled,
  setOpsFailureInjection,
} from './operations-console-db.harness';
import { createWebhookMock } from './operations-console-stack';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const INTEGRATIONS_ENV_KEYS = [
  API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
  INTEGRATIONS_SECRET_KEY_REF_ENV,
  API_CREDENTIAL_PEPPER_REF_ENV,
  'INTEGRATIONS_ROTATION_GRACE_HOURS',
  'INTEGRATIONS_WEBHOOKS_ENABLED',
] as const;

function saveIntegrationsEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of INTEGRATIONS_ENV_KEYS) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restoreIntegrationsEnv(saved: Record<string, string | undefined>): void {
  for (const key of INTEGRATIONS_ENV_KEYS) {
    const prev = saved[key];
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

function enableValidIntegrationsFoundation(): void {
  process.env[API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV] = 'true';
  process.env.INTEGRATIONS_ROTATION_GRACE_HOURS = '24';
  process.env[API_CREDENTIAL_PEPPER_REF_ENV] = 'test-pepper-ref-ops-int';
  process.env[INTEGRATIONS_SECRET_KEY_REF_ENV] = 'test-secret-ref-ops-int';
}

describeDb('Step 22 Operations Console integrations health INT01–INT10 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restore: () => void;
  let savedEnv: Record<string, string | undefined>;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restore = enableOpsConsole();
  });

  afterAll(async () => {
    restore();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    savedEnv = saveIntegrationsEnv();
    clearOpsFailureInjection();
    process.env.NODE_ENV = 'test';
    for (const key of INTEGRATIONS_ENV_KEYS) {
      delete process.env[key];
    }
    await cleanupOpsConsoleTables(prisma);
  });

  afterEach(() => {
    restoreIntegrationsEnv(savedEnv);
    clearOpsFailureInjection();
  });

  function foundationRow(rows: OpsIntegrationRow[]) {
    const row = rows.find((r) => r.type === 'integrations_foundation');
    expect(row).toBeDefined();
    return row!;
  }

  it('INT01: flag off -> DISABLED foundation row', async () => {
    const stack = createOpsStack(prisma);
    const rows = await stack.query.listIntegrations();
    const foundation = foundationRow(rows);

    expect(foundation.enabled).toBe(false);
    expect(foundation.normalizedStatus).toBe('DISABLED');
    expect(foundation.runtimeHealth).toBe('DISABLED');
    expect(foundation.enabledState).toBe('disabled');
  });

  it('INT02: flag on + valid config + no runtime evidence -> UNKNOWN (not HEALTHY)', async () => {
    enableValidIntegrationsFoundation();
    const stack = createOpsStack(prisma);
    const foundation = foundationRow(await stack.query.listIntegrations());

    expect(foundation.enabled).toBe(true);
    expect(foundation.configurationState).toBe('valid');
    expect(foundation.normalizedStatus).toBe('UNKNOWN');
    expect(foundation.runtimeHealth).toBe('UNKNOWN');
    expect(foundation.normalizedStatus).not.toBe('HEALTHY');
    expect(foundation.stale).toBe(true);
  });

  it('INT03: real runtime healthy — wired webhook mock with active provider and clean queue', async () => {
    enableValidIntegrationsFoundation();
    const mockWebhooks = createWebhookMock({
      providers: [{ providerKey: 'stripe', status: 'active' }],
      diagnostics: { wired: true, failed: 0, dlq: 0 },
    });
    const stack = createOpsStack(prisma, { webhooks: mockWebhooks });
    const rows = await stack.query.listIntegrations();

    const provider = rows.find((r) => r.type === 'provider:stripe');
    expect(provider?.normalizedStatus).toBe('HEALTHY');
    expect(provider?.runtimeHealth).toBe('HEALTHY');

    const queue = rows.find((r) => r.type === 'integrations_webhook_queue');
    expect(queue?.normalizedStatus).toBe('HEALTHY');
    expect(queue?.runtimeHealth).toBe('HEALTHY');
    expect(queue?.queueHealth).toBe('HEALTHY');
  });

  it('INT04: provider disabled -> DISABLED provider row', async () => {
    enableValidIntegrationsFoundation();
    const mockWebhooks = createWebhookMock({
      providers: [{ providerKey: 'legacy', status: 'inactive' }],
      diagnostics: { wired: true, failed: 0, dlq: 0 },
    });
    const stack = createOpsStack(prisma, { webhooks: mockWebhooks });
    const rows = await stack.query.listIntegrations();

    const provider = rows.find((r) => r.type === 'provider:legacy');
    expect(provider?.normalizedStatus).toBe('DISABLED');
    expect(provider?.runtimeHealth).toBe('DISABLED');
    expect(provider?.enabledState).toBe('disabled');
  });

  it('INT05: failed/DLQ backlog -> DEGRADED queue row', async () => {
    enableValidIntegrationsFoundation();
    const mockWebhooks = createWebhookMock({
      diagnostics: { wired: true, failed: 3, dlq: 1 },
    });
    const stack = createOpsStack(prisma, { webhooks: mockWebhooks });
    const rows = await stack.query.listIntegrations();

    const queue = rows.find((r) => r.type === 'integrations_webhook_queue');
    expect(queue?.normalizedStatus).toBe('DEGRADED');
    expect(queue?.runtimeHealth).toBe('DEGRADED');
    expect(queue?.queueHealth).toBe('DEGRADED');
    expect(queue?.failureCategory).toBe('dead_letter');
    expect(queue?.retryable).toBe(true);
  });

  it('INT06: runtime source unavailable — unwired engine DISABLED; adapter injection throws', async () => {
    enableValidIntegrationsFoundation();
    const stack = createOpsStack(prisma);
    const rows = await stack.query.listIntegrations();

    const engine = rows.find((r) => r.type === 'integrations_webhook_engine');
    expect(engine?.normalizedStatus).toBe('DISABLED');
    expect(engine?.runtimeHealth).toBe('DISABLED');
    expect(engine?.sourceStatus).toBe('not_wired_into_ops');

    setOpsFailureInjection('integration_adapter');
    await expect(stack.query.listIntegrations()).rejects.toMatchObject({
      code: 'source_unavailable',
      httpStatus: 503,
    });
  });

  it('INT07: stale runtime evidence — config-only foundation is stale UNKNOWN', async () => {
    enableValidIntegrationsFoundation();
    const stack = createOpsStack(prisma);
    const foundation = foundationRow(await stack.query.listIntegrations());

    expect(foundation.stale).toBe(true);
    expect(foundation.normalizedStatus).toBe('UNKNOWN');
    expect(foundation.runtimeHealth).toBe('UNKNOWN');
    expect(foundation.lastSuccessAt).toBeNull();
    expect(foundation.lastFailureAt).toBeNull();
  });

  it('INT08: invalid config -> UNKNOWN foundation with config failure category', async () => {
    process.env[API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV] = 'true';
    process.env.INTEGRATIONS_ROTATION_GRACE_HOURS = '48';
    const stack = createOpsStack(prisma);
    const foundation = foundationRow(await stack.query.listIntegrations());

    expect(foundation.configurationState).toBe('invalid');
    expect(foundation.normalizedStatus).toBe('UNKNOWN');
    expect(foundation.runtimeHealth).toBe('UNKNOWN');
    expect(foundation.failureCategory).toBe('config');
    expect(foundation.stale).toBe(true);
  });

  it('INT09: no secrets/paths/raw payloads in integrations JSON', async () => {
    enableValidIntegrationsFoundation();
    const mockWebhooks = createWebhookMock();
    const stack = createOpsStack(prisma, { webhooks: mockWebhooks });
    const rows = await stack.query.listIntegrations();
    const blob = JSON.stringify(rows);

    expect(blob).not.toMatch(/secret|password|Bearer |sk_live|api_key/i);
    expect(blob).not.toMatch(/test-pepper-ref-ops-int|test-secret-ref-ops-int/);
    expect(blob).not.toMatch(/postgresql:\/\/|file:\/\//i);
  });

  it('INT10: overview never synthesizes HEALTHY from config-only integrations', async () => {
    enableValidIntegrationsFoundation();
    const stack = createOpsStack(prisma);
    const rows = await stack.query.listIntegrations();
    const foundation = foundationRow(rows);

    expect(foundation.normalizedStatus).not.toBe('HEALTHY');
    expect(foundation.runtimeHealth).not.toBe('HEALTHY');

    const overview = await stack.query.overview();
    const integrationCards = overview.cards.filter(
      (c) =>
        c.title.toLowerCase().includes('integration') ||
        c.id.toLowerCase().includes('integration'),
    );
    for (const card of integrationCards) {
      expect(card.normalizedStatus).not.toBe('HEALTHY');
    }

    const overviewText = JSON.stringify(overview);
    expect(overviewText).not.toMatch(/integrations_foundation.*HEALTHY/);
  });
});
