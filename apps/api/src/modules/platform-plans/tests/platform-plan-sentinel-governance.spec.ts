/**
 * Step 14 final closure — Platform audit-sentinel governance (Option B).
 * Lifecycle: reserved identity always protected; row may be lazy-absent; exact fail-closed.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  assertNotPlatformAuditSentinelTenantId,
  isPlatformAuditSentinelTenantId,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
  PLATFORM_AUDIT_SENTINEL_SLUG,
} from '../../platform-tenants/platform-tenants.tokens';
import { PlatformTenant } from '../../platform-admin/domain/entities/platform-tenant.entity';
import { PlatformAdminValidationError } from '../../platform-admin/domain/exceptions/platform-admin.exception';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import { ProvisionPlatformTenantHandler } from '../../platform-admin/application/handlers/provision-platform-tenant.handler';

const RESERVED_LITERAL = PLATFORM_AUDIT_SENTINEL_TENANT_ID;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.includes('.postgres.integration.')) {
      out.push(full);
    }
  }
  return out;
}

describe('Step 14 sentinel governance (final closure)', () => {
  it('authoritative reserved-id appears once in production source under platform-tenants.tokens', () => {
    const apiSrc = join(__dirname, '../..');
    const files = walkTsFiles(apiSrc);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes(RESERVED_LITERAL)) continue;
      hits.push(relative(apiSrc, file).replace(/\\/g, '/'));
    }
    // Single definition site; other production modules must import the constant / helper.
    expect(hits).toEqual(['platform-tenants/platform-tenants.tokens.ts']);
  });

  it('assertNotPlatformAuditSentinelTenantId rejects exact id and accepts arbitrary/similar', () => {
    expect(() =>
      assertNotPlatformAuditSentinelTenantId(PLATFORM_AUDIT_SENTINEL_TENANT_ID, 'unit.test'),
    ).toThrow(/Reserved platform audit-sentinel/);
    expect(() =>
      assertNotPlatformAuditSentinelTenantId('11111111-1111-4111-8111-111111111111', 'unit.test'),
    ).not.toThrow();
    expect(() =>
      assertNotPlatformAuditSentinelTenantId('00000000-0000-4000-8000-000000000048', 'unit.test'),
    ).not.toThrow();
    expect(isPlatformAuditSentinelTenantId(PLATFORM_AUDIT_SENTINEL_SLUG)).toBe(false);
  });

  it('provision entity and handler reject reserved identity (collision)', async () => {
    expect(() =>
      PlatformTenant.provision({
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        displayName: 'x',
        region: 'me-central',
        plan: 'starter',
        provisionedBy: 'admin-1',
      }),
    ).toThrow(PlatformAdminValidationError);

    const handler = Object.create(ProvisionPlatformTenantHandler.prototype) as {
      execute: ProvisionPlatformTenantHandler['execute'];
      policy: { canManageTenantLifecycle: () => boolean };
      repository: { findByTenantId: jest.Mock };
    };
    handler.policy = { canManageTenantLifecycle: () => true };
    handler.repository = { findByTenantId: jest.fn() };
    await expect(
      ProvisionPlatformTenantHandler.prototype.execute.call(handler, {
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        displayName: 'x',
        region: 'me-central',
        plan: 'starter',
        actorId: 'a',
        actorRoles: ['platform_owner'],
        correlationId: null,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(handler.repository.findByTenantId).not.toHaveBeenCalled();
  });

  it('licensing fail-closed before cache/tenant lookup; arbitrary path continues', async () => {
    const engine = Object.create(LicensingEngineService.prototype) as {
      resolveLicense: (tenantId: string) => Promise<unknown>;
      licenseCache: Map<string, unknown>;
      loadTenantContext: jest.Mock;
      buildLicense: jest.Mock;
      lifecycleState: { syncFromResolvedLicense: jest.Mock };
      logger: { warn: jest.Mock };
    };
    engine.licenseCache = new Map();
    engine.loadTenantContext = jest.fn();
    engine.buildLicense = jest.fn(() => ({ uiPlan: 'pro', status: 'active' }));
    engine.lifecycleState = { syncFromResolvedLicense: jest.fn(async () => undefined) };
    engine.logger = { warn: jest.fn() };

    await expect(engine.resolveLicense(PLATFORM_AUDIT_SENTINEL_TENANT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(engine.loadTenantContext).not.toHaveBeenCalled();
    expect(engine.licenseCache.size).toBe(0);
    expect(engine.logger.warn).toHaveBeenCalledWith('platform_audit_sentinel_license_rejected');

    await engine.resolveLicense('22222222-2222-4222-8222-222222222222');
    expect(engine.loadTenantContext).toHaveBeenCalledTimes(1);
  });
});
