import {
  hashApiCredential,
  generateApiCredentialMaterial,
  verifyApiCredentialHash,
  redactCredentialSecrets,
  isPepperConfigured,
  resolvePepperMaterial,
  CREDENTIAL_ENTROPY_BYTES,
} from '../domain/credential-hashing';
import { mapLegacySettingsScopesToCenter } from '../domain/credential-scopes';
import {
  canTransitionCredentialStatus,
  isCredentialAuthnEligible,
} from '../domain/credential-status.machine';
import { createCredentialEngineForTests } from './credential-engine.helpers';

describe('Phase 44b — Credential Engine', () => {
  const previousEnv: Record<string, string | undefined> = {};
  const envKeys = [
    'API_KEYS_INTEGRATIONS_CENTER_ENABLED',
    'API_CREDENTIAL_PEPPER_REF',
    'INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED',
    'INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ',
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      previousEnv[key] = process.env[key];
    }
    process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'true';
    process.env.API_CREDENTIAL_PEPPER_REF = 'test-pepper-material-44b-secure';
    process.env.INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED = 'true';
  });

  afterEach(() => {
    for (const key of envKeys) {
      const prev = previousEnv[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it('hashes with pepper and verifies constant-time', () => {
    const pepper = resolvePepperMaterial()!;
    expect(isPepperConfigured()).toBe(true);
    const material = generateApiCredentialMaterial({ pepper });
    expect(material.raw.startsWith('bk_')).toBe(true);
    expect(material.prefix).toHaveLength(12);
    expect(material.keyHash).toHaveLength(64);
    expect(material.raw.includes(material.keyHash)).toBe(false);
    // entropy: prefix + 24 bytes hex = 3 + 48 chars for bk_
    expect(CREDENTIAL_ENTROPY_BYTES).toBe(24);
    expect(verifyApiCredentialHash(material.raw, material.keyHash, pepper)).toBe(
      true,
    );
    expect(
      verifyApiCredentialHash(material.raw + 'x', material.keyHash, pepper),
    ).toBe(false);
    expect(
      hashApiCredential(material.raw, pepper),
    ).toBe(material.keyHash);
  });

  it('issues credential once — raw not persisted; metadata has no hash', async () => {
    const ctx = createCredentialEngineForTests();
    const result = await ctx.engine.issueApiCredential({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'CI key',
      scopes: ['ops.read'],
      ownerType: 'user',
      ownerId: ctx.actor.actorId,
    });

    expect(result.rawCredential.startsWith('bk_')).toBe(true);
    expect(result.metadata.prefix).toBe(result.rawCredential.slice(0, 12));
    expect((result.metadata as { keyHash?: string }).keyHash).toBeUndefined();
    expect(JSON.stringify(result.metadata)).not.toContain(result.rawCredential);

    const stored = await ctx.credentials.findById(
      ctx.actor.tenantId,
      result.metadata.id,
    );
    expect(stored?.keyHash).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain(result.rawCredential);
    expect(ctx.engine.verifyRawCredential(result.rawCredential, stored!.keyHash)).toBe(
      true,
    );

    const audits = ctx.audit.drainRecorded();
    expect(audits.some((a) => a.action === 'integrations.credential.created')).toBe(
      true,
    );
    expect(JSON.stringify(audits)).not.toContain(result.rawCredential);

    const activities = ctx.activity.drainEmitted();
    expect(activities.some((a) => a.event === 'credential_created')).toBe(true);
    expect(JSON.stringify(activities)).not.toContain(result.rawCredential);
  });

  it('denies unknown scopes and maps legacy scopes to ops.read only', async () => {
    const ctx = createCredentialEngineForTests();
    await expect(
      ctx.engine.issueApiCredential({
        tenantId: ctx.actor.tenantId,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
        name: 'bad',
        scopes: ['patients.admin'],
        ownerType: 'user',
        ownerId: ctx.actor.actorId,
      }),
    ).rejects.toThrow(/Unknown|forbidden scopes/i);

    expect(mapLegacySettingsScopesToCenter(['read', 'write'])).toEqual([
      'ops.read',
    ]);
    expect(mapLegacySettingsScopesToCenter(['patients.write'])).toEqual([
      'ops.read',
    ]);
  });

  it('rotates with 24h grace then revokes predecessor after grace', async () => {
    const ctx = createCredentialEngineForTests();
    const issued = await ctx.engine.issueApiCredential({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'rotate-me',
      scopes: ['ops.read'],
      ownerType: 'user',
      ownerId: ctx.actor.actorId,
    });

    const rotated = await ctx.engine.rotateApiCredential({
      tenantId: ctx.actor.tenantId,
      credentialId: issued.metadata.id,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
    });

    expect(rotated.rawCredential).not.toBe(issued.rawCredential);
    const pred = await ctx.credentials.findById(
      ctx.actor.tenantId,
      issued.metadata.id,
    );
    expect(pred?.status).toBe('rotated');
    expect(pred?.rotationGraceEndsAt).toBeTruthy();
    expect(ctx.engine.isAuthnEligible(pred!)).toBe(true);

    const succ = await ctx.credentials.findById(
      ctx.actor.tenantId,
      rotated.metadata.id,
    );
    expect(succ?.status).toBe('active');
    expect(succ?.rotatedFromId).toBe(issued.metadata.id);

    const afterGrace = new Date(
      new Date(pred!.rotationGraceEndsAt!).getTime() + 1000,
    );
    const result = await ctx.engine.expireApiCredentials({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      now: afterGrace,
    });
    expect(result.graceRevoked).toBe(1);
    const predAfter = await ctx.credentials.findById(
      ctx.actor.tenantId,
      issued.metadata.id,
    );
    expect(predAfter?.status).toBe('revoked');
    expect(ctx.engine.isAuthnEligible(predAfter!)).toBe(false);
  });

  it('revokes immediately and prevents reactivation', async () => {
    const ctx = createCredentialEngineForTests();
    const issued = await ctx.engine.issueApiCredential({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'rev',
      scopes: ['ops.read'],
      ownerType: 'user',
      ownerId: ctx.actor.actorId,
    });
    const revoked = await ctx.engine.revokeApiCredential({
      tenantId: ctx.actor.tenantId,
      credentialId: issued.metadata.id,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
    });
    expect(revoked.status).toBe('revoked');
    expect(canTransitionCredentialStatus('revoked', 'active')).toBe(false);

    await expect(
      ctx.engine.rotateApiCredential({
        tenantId: ctx.actor.tenantId,
        credentialId: issued.metadata.id,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
      }),
    ).rejects.toThrow(/terminal|Cannot rotate/i);

    expect(
      ctx.notificationIntents
        .drainRecorded()
        .some((i) => i.kind === 'credential_revoked'),
    ).toBe(true);
  });

  it('expires credentials and keeps expired terminal', async () => {
    const ctx = createCredentialEngineForTests();
    const past = new Date(Date.now() - 60_000).toISOString();
    const issued = await ctx.engine.issueApiCredential({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'exp',
      scopes: ['ops.read'],
      ownerType: 'user',
      ownerId: ctx.actor.actorId,
      expiresAt: past,
    });
    const result = await ctx.engine.expireApiCredentials({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
    });
    expect(result.expired).toBe(1);
    const row = await ctx.credentials.findById(
      ctx.actor.tenantId,
      issued.metadata.id,
    );
    expect(row?.status).toBe('expired');
    expect(canTransitionCredentialStatus('expired', 'active')).toBe(false);
    await expect(
      ctx.engine.revokeApiCredential({
        tenantId: ctx.actor.tenantId,
        credentialId: issued.metadata.id,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
      }),
    ).rejects.toThrow(/Expired/);
  });

  it('supports service-account ownership', async () => {
    const ctx = createCredentialEngineForTests();
    const sa = await ctx.engine.createServiceAccount({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      displayName: 'Payments Bot',
      roleBindings: ['ops'],
    });
    const issued = await ctx.engine.issueApiCredential({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'sa-key',
      scopes: ['ops.read'],
      ownerType: 'service_account',
      ownerId: sa.id,
    });
    expect(issued.metadata.ownerType).toBe('service_account');
    expect(issued.metadata.ownerId).toBe(sa.id);

    await ctx.engine.disableServiceAccount({
      tenantId: ctx.actor.tenantId,
      serviceAccountId: sa.id,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
    });
    const disabled = await ctx.serviceAccounts.findById(
      ctx.actor.tenantId,
      sa.id,
    );
    expect(disabled?.status).toBe('disabled');
  });

  it('fails closed on feature flag, license, and RBAC', async () => {
    const ctx = createCredentialEngineForTests();
    process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'false';
    await expect(
      ctx.engine.issueApiCredential({
        tenantId: ctx.actor.tenantId,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
        name: 'x',
        scopes: ['ops.read'],
        ownerType: 'user',
        ownerId: ctx.actor.actorId,
      }),
    ).rejects.toThrow(/API_KEYS_INTEGRATIONS_CENTER_ENABLED=false/);

    process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'true';
    ctx.tenantPolicy.getAdvancedPolicy.mockResolvedValue({
      allowIntegrations: false,
      allowBackupRestore: false,
      allowDataImport: true,
      allowDataExport: true,
      maintenanceMode: false,
    });
    await expect(
      ctx.engine.issueApiCredential({
        tenantId: ctx.actor.tenantId,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
        name: 'x',
        scopes: ['ops.read'],
        ownerType: 'user',
        ownerId: ctx.actor.actorId,
      }),
    ).rejects.toThrow(/allowIntegrations/);

    ctx.tenantPolicy.getAdvancedPolicy.mockResolvedValue({
      allowIntegrations: true,
      allowBackupRestore: false,
      allowDataImport: true,
      allowDataExport: true,
      maintenanceMode: false,
    });
    await expect(
      ctx.engine.issueApiCredential({
        tenantId: ctx.actor.tenantId,
        actorId: ctx.actor.actorId,
        actorRoles: ['patient'],
        name: 'x',
        scopes: ['ops.read'],
        ownerType: 'user',
        ownerId: ctx.actor.actorId,
      }),
    ).rejects.toThrow(/Missing permission/);
  });

  it('enforces tenant isolation on get/rotate/revoke', async () => {
    const ctx = createCredentialEngineForTests();
    const issued = await ctx.engine.issueApiCredential({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'iso',
      scopes: ['ops.read'],
      ownerType: 'user',
      ownerId: ctx.actor.actorId,
    });

    await expect(
      ctx.engine.getCredentialMetadata({
        tenantId: ctx.actor.otherTenantId,
        credentialId: issued.metadata.id,
        actorRoles: ctx.actor.actorRoles,
      }),
    ).rejects.toThrow(/not found/i);

    await expect(
      ctx.engine.rotateApiCredential({
        tenantId: ctx.actor.otherTenantId,
        credentialId: issued.metadata.id,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
      }),
    ).rejects.toThrow(/not found/i);

    await expect(
      ctx.engine.revokeApiCredential({
        tenantId: ctx.actor.otherTenantId,
        credentialId: issued.metadata.id,
        actorId: ctx.actor.actorId,
        actorRoles: ctx.actor.actorRoles,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('redacts credential-like values from logs helpers', () => {
    const raw = 'bk_abcdef0123456789abcdef0123456789abcdef0123456789';
    expect(redactCredentialSecrets(`key=${raw}`)).toContain('[REDACTED]');
    expect(redactCredentialSecrets(`key=${raw}`)).not.toContain('abcdef');
  });

  it('legacy list maps scopes to ops.read only (migration)', async () => {
    const ctx = createCredentialEngineForTests({
      legacyList: async () => [
        {
          id: 'legacy-1',
          tenantId: 't',
          branchId: null,
          name: 'legacy',
          prefix: 'bk_legacyxxxx',
          status: 'active',
          scopes: ['ops.read'],
          ownerType: 'user',
          ownerId: 'legacy',
          expiresAt: null,
          lastUsedAt: null,
          createdBy: 'legacy',
          rotatedFromId: null,
          rotationGraceEndsAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revokedAt: null,
          source: 'legacy_settings',
        },
      ],
    });

    // Prove mapper never elevates
    expect(mapLegacySettingsScopesToCenter(['write', 'patients.write'])).toEqual(
      ['ops.read'],
    );

    const listed = await ctx.engine.listCredentialMetadata({
      tenantId: ctx.actor.tenantId,
      actorRoles: ctx.actor.actorRoles,
    });
    expect(listed.some((c) => c.source === 'legacy_settings')).toBe(true);
    expect(
      listed
        .filter((c) => c.source === 'legacy_settings')
        .every((c) => c.scopes.length === 1 && c.scopes[0] === 'ops.read'),
    ).toBe(true);
  });

  it('dual-writes on issue (compatibility hook invoked)', async () => {
    const ctx = createCredentialEngineForTests();
    await ctx.engine.issueApiCredential({
      tenantId: ctx.actor.tenantId,
      actorId: ctx.actor.actorId,
      actorRoles: ctx.actor.actorRoles,
      name: 'dual',
      scopes: ['ops.read'],
      ownerType: 'user',
      ownerId: ctx.actor.actorId,
    });
    expect(ctx.legacy.dualWriteNewCredential).toHaveBeenCalled();
    const arg = ctx.legacy.dualWriteNewCredential.mock.calls[0][0];
    expect(arg.legacyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(arg).not.toHaveProperty('raw');
  });

  it('authn eligibility respects rotated grace window', () => {
    const now = new Date('2026-07-18T12:00:00.000Z');
    expect(
      isCredentialAuthnEligible({
        status: 'rotated',
        expiresAt: null,
        rotationGraceEndsAt: '2026-07-19T12:00:00.000Z',
        now,
      }),
    ).toBe(true);
    expect(
      isCredentialAuthnEligible({
        status: 'rotated',
        expiresAt: null,
        rotationGraceEndsAt: '2026-07-18T11:00:00.000Z',
        now,
      }),
    ).toBe(false);
  });
});
