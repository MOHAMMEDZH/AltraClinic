import {
  createOutboundSigningHeaders,
  createWebhookEngineForTests,
  decryptWebhookSecret,
  encryptWebhookSecret,
  evaluateWebhookUrlSafety,
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_NONCE_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from './webhook-engine.helpers';

describe('Phase 44c — Integrations & Webhooks Engine', () => {
  const previousEnv: Record<string, string | undefined> = {};
  const keys = [
    'API_KEYS_INTEGRATIONS_CENTER_ENABLED',
    'INTEGRATIONS_WEBHOOKS_ENABLED',
    'INTEGRATIONS_INBOUND_ENABLED',
    'INTEGRATIONS_SECRET_KEY_REF',
  ];

  beforeEach(() => {
    for (const k of keys) previousEnv[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of keys) {
      const prev = previousEnv[k];
      if (prev === undefined) delete process.env[k];
      else process.env[k] = prev;
    }
  });

  it('rejects SSRF / private / loopback / non-HTTPS URLs', () => {
    expect(evaluateWebhookUrlSafety('http://example.com').safe).toBe(false);
    expect(evaluateWebhookUrlSafety('https://127.0.0.1/hook').safe).toBe(false);
    expect(evaluateWebhookUrlSafety('https://10.0.0.1/hook').safe).toBe(false);
    expect(evaluateWebhookUrlSafety('https://169.254.169.254/latest').safe).toBe(
      false,
    );
    expect(evaluateWebhookUrlSafety('https://localhost/hook').safe).toBe(false);
    expect(evaluateWebhookUrlSafety('https://hooks.example.com/a').safe).toBe(
      true,
    );
  });

  it('signs and verifies HMAC with skew; rejects replay skew', () => {
    const secret = 'super-secret-webhook-key';
    const body = '{"ok":true}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWebhookPayload(secret, timestamp, body);
    expect(
      verifyWebhookSignature({
        secret,
        timestamp,
        rawBody: body,
        signatureHex: signature,
      }).ok,
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        secret,
        timestamp: String(Math.floor(Date.now() / 1000) - 301),
        rawBody: body,
        signatureHex: signWebhookPayload(
          secret,
          String(Math.floor(Date.now() / 1000) - 301),
          body,
        ),
      }).ok,
    ).toBe(false);
  });

  it('encrypts webhook secrets with envelope AES-GCM (never plaintext at rest)', () => {
    process.env.INTEGRATIONS_SECRET_KEY_REF = 'test-integrations-secret-key-44c';
    const raw = 'whsec_test_value_1234567890';
    const env = encryptWebhookSecret(raw);
    expect(env).not.toContain(raw);
    expect(decryptWebhookSecret(env)).toBe(raw);
  });

  it('creates subscription with one-time secret and SSRF checks', async () => {
    const ctx = createWebhookEngineForTests();
    await expect(
      ctx.engine.createSubscription({
        tenantId: ctx.actor.tenantId,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
        name: 'bad',
        targetUrl: 'https://127.0.0.1/x',
        eventFilters: ['credential.created'],
      }),
    ).rejects.toThrow(/Unsafe webhook URL/);

    const created = await ctx.engine.createSubscription({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'Orders',
      targetUrl: 'https://hooks.example.com/orders',
      eventFilters: ['credential.created', 'credential.revoked'],
    });
    expect(created.secretOnce.length).toBeGreaterThan(16);
    expect(created.subscription.status).toBe('active');
    const secretRow = ctx.store.secrets.get(created.subscription.secretId)!;
    expect(secretRow.ciphertextEnvelope).not.toContain(created.secretOnce);
    expect(JSON.stringify(ctx.audit.drainRecorded())).not.toContain(
      created.secretOnce,
    );
  });

  it('publishes events, delivers outbound, records attempts', async () => {
    const fetchImpl = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        text: async () => 'ok',
      } as Response;
    });
    const ctx = createWebhookEngineForTests({ fetchImpl });
    const sub = await ctx.engine.createSubscription({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'Cred hooks',
      targetUrl: 'https://hooks.example.com/c',
      eventFilters: ['credential.created'],
    });

    const event = ctx.engine.buildCredentialEvent(
      'credential.created',
      ctx.actor.tenantId,
      { credentialId: 'c1', prefix: 'bk_abcdef1234' },
    );
    const { enqueued } = await ctx.engine.publishEvent(event);
    expect(enqueued).toBe(1);

    await new Promise((r) => setTimeout(r, 30));
    expect(fetchImpl).toHaveBeenCalled();
    const deliveries = ctx.engine.listDeliveries(
      ctx.actor.tenantId,
      ctx.actor.actorRoles,
      sub.subscription.id,
    );
    expect(deliveries[0]?.status).toBe('succeeded');
    const attempts = ctx.engine.listAttempts(
      ctx.actor.tenantId,
      deliveries[0]!.id,
      ctx.actor.actorRoles,
    );
    expect(attempts.length).toBe(1);
    expect(attempts[0].outcome).toBe('succeeded');
  });

  it('retries then dead-letters on permanent failure exhaustion', async () => {
    let calls = 0;
    const fetchImpl = jest.fn(async () => {
      calls += 1;
      return {
        ok: false,
        status: 500,
        text: async () => 'fail',
      } as Response;
    });
    const ctx = createWebhookEngineForTests({ fetchImpl });
    // shrink max attempts via direct store mutation after create
    const sub = await ctx.engine.createSubscription({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'Retry',
      targetUrl: 'https://hooks.example.com/r',
      eventFilters: ['credential.rotated'],
    });
    const row = ctx.store.subscriptions.get(sub.subscription.id)!;
    ctx.store.subscriptions.set(sub.subscription.id, { ...row, maxAttempts: 2 });

    await ctx.engine.publishEvent(
      ctx.engine.buildCredentialEvent(
        'credential.rotated',
        ctx.actor.tenantId,
        { credentialId: 'c2' },
      ),
    );

    await new Promise((r) => setTimeout(r, 80));
    // first attempt scheduled; second after backoff — wait more
    await new Promise((r) => setTimeout(r, 1200));

    const deliveries = ctx.engine.listDeliveries(
      ctx.actor.tenantId,
      ctx.actor.actorRoles,
    );
    expect(deliveries[0]?.status).toBe('dead_lettered');
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(
      ctx.notificationIntents
        .drainRecorded()
        .some((i) => i.kind === 'webhook_dead_lettered'),
    ).toBe(true);
  }, 10000);

  it('verifies inbound HMAC and rejects replay nonce', async () => {
    const ctx = createWebhookEngineForTests();
    const sub = await ctx.engine.createSubscription({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'Inbound',
      targetUrl: 'https://hooks.example.com/in',
      eventFilters: ['credential.created'],
      providerKey: 'custom.http',
    });
    const secret = ctx.engine.decryptSecretForTests(sub.subscription.secretId);
    const rawBody = JSON.stringify({ type: 'credential.created', version: '1' });
    const signed = createOutboundSigningHeaders(secret, rawBody);
    const headers = {
      [WEBHOOK_SIGNATURE_HEADER]: signed.signature,
      [WEBHOOK_TIMESTAMP_HEADER]: signed.timestamp,
      [WEBHOOK_NONCE_HEADER]: signed.nonce,
    };
    const ok = await ctx.engine.verifyInbound({
      tenantId: ctx.actor.tenantId,
      providerKey: 'custom.http',
      rawBody,
      headers,
      secretPlaintext: secret,
    });
    expect(ok.ok).toBe(true);

    const replay = await ctx.engine.verifyInbound({
      tenantId: ctx.actor.tenantId,
      providerKey: 'custom.http',
      rawBody,
      headers,
      secretPlaintext: secret,
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe('replay_nonce');
  });

  it('rotates secrets and versions', async () => {
    const ctx = createWebhookEngineForTests();
    const sub = await ctx.engine.createSubscription({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'Rot',
      targetUrl: 'https://hooks.example.com/rot',
      eventFilters: ['credential.revoked'],
    });
    const rotated = await ctx.engine.rotateSecret({
      tenantId: ctx.actor.tenantId,
      subscriptionId: sub.subscription.id,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
    });
    expect(rotated.version).toBe(2);
    expect(rotated.secretOnce).not.toBe(sub.secretOnce);
    const updated = ctx.store.subscriptions.get(sub.subscription.id)!;
    expect(updated.secretVersion).toBe(2);
  });

  it('enforces tenant isolation on deliveries', () => {
    const ctx = createWebhookEngineForTests();
    const otherTenant = '00000000-0000-4000-8000-000000000099';
    expect(() =>
      ctx.engine.listAttempts(otherTenant, 'missing', ctx.actor.actorRoles),
    ).toThrow(/not found/i);
  });

  it('fails closed when feature flag off', async () => {
    const ctx = createWebhookEngineForTests();
    process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'false';
    await expect(
      ctx.engine.createSubscription({
        tenantId: ctx.actor.tenantId,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
        name: 'x',
        targetUrl: 'https://hooks.example.com/x',
        eventFilters: ['credential.created'],
      }),
    ).rejects.toThrow(/API_KEYS_INTEGRATIONS_CENTER_ENABLED=false/);
  });

  it('lists providers from catalog registry', () => {
    const ctx = createWebhookEngineForTests();
    expect(ctx.engine.listProviders().length).toBeGreaterThan(0);
  });
});
