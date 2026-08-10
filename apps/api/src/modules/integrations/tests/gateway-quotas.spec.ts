import {
  createGatewayForTests,
  issueTestCredential,
} from './gateway-quotas.helpers';
import { parseApiKeyFromHeaders } from '../domain/gateway/api-key-header.parser';
import { InProcessQuotaEngine } from '../infrastructure/gateway/in-process-quota.engine';
import { verifyApiCredentialHash, hashApiCredential, resolvePepperMaterial } from '../domain/credential-hashing';

describe('Phase 44d — Gateway & Quotas', () => {
  const previous = {
    flag: process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED,
    pepper: process.env.API_CREDENTIAL_PEPPER_REF,
  };

  afterAll(() => {
    process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = previous.flag;
    process.env.API_CREDENTIAL_PEPPER_REF = previous.pepper;
  });

  it('parses Bearer and X-Api-Key; ignores JWT Bearer', () => {
    expect(
      parseApiKeyFromHeaders({
        authorization: 'Bearer bk_abcdef0123456789abcdef0123456789abcdef',
      }).kind,
    ).toBe('parsed');
    expect(
      parseApiKeyFromHeaders({
        apiKey: 'bki_abcdef0123456789abcdef0123456789abcdef',
      }).kind,
    ).toBe('parsed');
    expect(
      parseApiKeyFromHeaders({
        authorization:
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig',
      }).kind,
    ).toBe('none');
    expect(
      parseApiKeyFromHeaders({
        apiKey: 'not-a-valid-prefix',
      }).kind,
    ).toBe('reject');
  });

  it('authenticates via Bearer and updates lastUsedAt', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    const result = await ctx.gateway.authenticate({
      authorization: `Bearer ${issued.key}`,
      requiredScopes: ['ops.read'],
      endpoint: '/integrations/gateway/whoami',
      operation: 'GET whoami',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.tenantId).toBe(ctx.actor.tenantId);
    expect(result.principal.credentialId).toBe(issued.credential.id);
    expect(result.principal.authSource).toBe('bearer');
    expect(result.remainingQuota).toBeGreaterThanOrEqual(0);

    const stored = await ctx.credentials.findById(
      ctx.actor.tenantId,
      issued.credential.id,
    );
    expect(stored?.lastUsedAt).toBeTruthy();
    expect(ctx.metrics.getCount('integrations.auth.success')).toBeGreaterThan(0);
  });

  it('authenticates via X-Api-Key', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    const result = await ctx.gateway.authenticate({
      apiKey: issued.key,
      requiredScopes: ['ops.read'],
      endpoint: 'probe',
      operation: 'x-api-key',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.principal.authSource).toBe('x_api_key');
    }
  });

  it('verifies hash with constant-time helper', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    const pepper = resolvePepperMaterial()!;
    expect(
      verifyApiCredentialHash(issued.key, issued.credential.keyHash, pepper),
    ).toBe(true);
    expect(
      verifyApiCredentialHash(
        issued.key + 'x',
        issued.credential.keyHash,
        pepper,
      ),
    ).toBe(false);
    expect(hashApiCredential(issued.key, pepper)).toBe(issued.credential.keyHash);
  });

  it('rejects revoked credentials', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    await ctx.engine.revokeApiCredential({
      tenantId: ctx.actor.tenantId,
      credentialId: issued.credential.id,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
    });
    const result = await ctx.gateway.authenticate({
      authorization: `Bearer ${issued.key}`,
      endpoint: 't',
      operation: 't',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('revoked');
      expect(result.statusCode).toBe(401);
    }
  });

  it('rejects expired credentials', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    const past = new Date(Date.now() - 60_000).toISOString();
    await ctx.credentials.save({
      ...issued.credential,
      status: 'expired',
      expiresAt: past,
      updatedAt: past,
    });
    const result = await ctx.gateway.authenticate({
      apiKey: issued.key,
      endpoint: 't',
      operation: 't',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(['expired', 'not_eligible']).toContain(result.reason);
  });

  it('honors rotation grace for rotated predecessor', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    const rotated = await ctx.engine.rotateApiCredential({
      tenantId: ctx.actor.tenantId,
      credentialId: issued.credential.id,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
    });
    const oldResult = await ctx.gateway.authenticate({
      authorization: `Bearer ${issued.key}`,
      endpoint: 'grace',
      operation: 'old',
    });
    expect(oldResult.ok).toBe(true);
    const newResult = await ctx.gateway.authenticate({
      authorization: `Bearer ${rotated.rawCredential}`,
      endpoint: 'grace',
      operation: 'new',
    });
    expect(newResult.ok).toBe(true);
  });

  it('denies missing scopes', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx, ['ops.read']);
    const result = await ctx.gateway.authenticate({
      authorization: `Bearer ${issued.key}`,
      requiredScopes: ['patients.write'],
      endpoint: 't',
      operation: 't',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('scope_denied');
      expect(result.statusCode).toBe(403);
    }
  });

  it('fails closed when feature flag off', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'false';
    const result = await ctx.gateway.authenticate({
      apiKey: issued.key,
      endpoint: 't',
      operation: 't',
    });
    process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'true';
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('feature_disabled');
  });

  it('fails closed when license denies integrations', async () => {
    const ctx2 = createGatewayForTests({ allowIntegrations: true });
    const issued2 = await issueTestCredential(ctx2);
    ctx2.tenantPolicy.getAdvancedPolicy.mockResolvedValue({
      maintenanceMode: false,
      allowDataExport: true,
      allowDataImport: true,
      allowBackupRestore: false,
      allowIntegrations: false,
    });
    const result = await ctx2.gateway.authenticate({
      apiKey: issued2.key,
      endpoint: 't',
      operation: 't',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('license_denied');
  });

  it('enforces tenant isolation via tenant hint mismatch', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    const result = await ctx.gateway.authenticate({
      apiKey: issued.key,
      tenantIdHint: ctx.actor.otherTenantId,
      endpoint: 't',
      operation: 't',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('tenant_mismatch');
  });

  it('enforces quota with burst then rejects with 429', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'credential', {
      limit: 3,
      windowSeconds: 3600,
    });
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'tenant', {
      limit: 100,
      windowSeconds: 3600,
    });
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'endpoint', {
      limit: 100,
      windowSeconds: 60,
    });
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'operation', {
      limit: 100,
      windowSeconds: 60,
    });

    for (let i = 0; i < 3; i++) {
      const ok = await ctx.gateway.authenticate({
        apiKey: issued.key,
        endpoint: 'quota-test',
        operation: 'burst',
      });
      expect(ok.ok).toBe(true);
    }
    const denied = await ctx.gateway.authenticate({
      apiKey: issued.key,
      endpoint: 'quota-test',
      operation: 'burst',
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.reason).toBe('quota_exceeded');
      expect(denied.statusCode).toBe(429);
    }
    expect(ctx.metrics.getCount('integrations.quota.exceeded')).toBeGreaterThan(
      0,
    );
    const usage = ctx.gateway.getUsageSnapshot(ctx.actor.tenantId);
    expect(usage.totals.success).toBe(3);
    expect(usage.totals.quotaFailure).toBeGreaterThanOrEqual(1);
  });

  it('resets quota windows', async () => {
    const ctx = createGatewayForTests();
    const issued = await issueTestCredential(ctx);
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'credential', {
      limit: 1,
      windowSeconds: 3600,
    });
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'tenant', {
      limit: 100,
      windowSeconds: 3600,
    });
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'endpoint', {
      limit: 100,
      windowSeconds: 60,
    });
    ctx.gateway.setTenantQuotaWindow(ctx.actor.tenantId, 'operation', {
      limit: 100,
      windowSeconds: 60,
    });
    expect(
      (
        await ctx.gateway.authenticate({
          apiKey: issued.key,
          endpoint: 'r',
          operation: 'r',
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await ctx.gateway.authenticate({
          apiKey: issued.key,
          endpoint: 'r',
          operation: 'r',
        })
      ).ok,
    ).toBe(false);
    ctx.gateway.resetQuota(`credential:${ctx.actor.tenantId}`);
    // Also reset related burst buckets
    ctx.gateway.resetQuota();
    expect(
      (
        await ctx.gateway.authenticate({
          apiKey: issued.key,
          endpoint: 'r',
          operation: 'r',
        })
      ).ok,
    ).toBe(true);
  });

  it('in-process quota engine supports evaluate without consume', () => {
    const engine = new InProcessQuotaEngine();
    const input = {
      tenantId: 't1',
      credentialId: 'c1',
      serviceAccountId: null,
      endpoint: 'e',
      operation: 'o',
    };
    const a = engine.evaluate(input);
    expect(a.allowed).toBe(true);
    const b = engine.evaluate(input);
    expect(b.remaining).toBe(a.remaining);
    engine.consume(input);
    const c = engine.evaluate(input);
    expect(c.remaining).toBeLessThan(a.remaining);
  });

  it('authenticates service-account owned credentials', async () => {
    const ctx = createGatewayForTests();
    process.env.INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED = 'true';
    const sa = await ctx.engine.createServiceAccount({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      displayName: 'bot',
      roleBindings: ['ops'],
    });
    const issued = await issueTestCredential(ctx, ['ops.read'], {
      ownerType: 'service_account',
      ownerId: sa.id,
    });
    const result = await ctx.gateway.authenticate({
      apiKey: issued.key,
      endpoint: 'sa',
      operation: 'sa',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.principal.ownerType).toBe('service_account');
      expect(result.principal.serviceAccountId).toBe(sa.id);
    }
  });

  it('exposes gateway diagnostics', () => {
    const ctx = createGatewayForTests();
    const diag = ctx.gateway.getDiagnostics(ctx.actor.tenantId);
    expect(diag.wired).toBe(true);
    expect(diag.contractVersion).toBe('44d');
    expect(diag.quotaBackend).toBe('in_process');
    expect(diag.redisDeferred).toBe(true);
  });
});
