/**
 * WAVE-A-PA-03 — API-level cross-tenant negative tests for Wave A clinical catalog.
 * Exercises Nest controllers + PermissionGuard / PlatformPermissionGuard + service predicates
 * against real PostgreSQL (platform bypass used only after tenant identity checks).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand src/modules/clinical-catalog/tests/clinical-catalog.cross-tenant.api.postgres.integration.spec.ts
 */
import 'reflect-metadata';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { PermissionGuard } from '../../auth/api/guards/permission.guard';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { ClinicalCatalogController } from '../api/clinical-catalog.controller';
import { ClinicalCatalogConfigsController } from '../api/clinical-catalog-configs.controller';
import { ClinicalCatalogPricesController } from '../api/clinical-catalog-prices.controller';
import { PlatformClinicalCatalogController } from '../api/platform-clinical-catalog.controller';
import { ClinicalCatalogService } from '../application/clinical-catalog.service';
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import { TenantServiceConfigService } from '../application/tenant-service-config.service';
import { CLINICAL_CATALOG_AUDIT_LOG } from '../application/ports/clinical-catalog-audit-log.port';
import {
  cleanupWaveAFixtures,
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from './clinical-catalog-db.harness';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

jest.setTimeout(180_000);

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

@Injectable()
class TestClinicAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtClaimsVO;
    }>();
    const raw = req.headers['x-test-principal'];
    if (!raw) throw new UnauthorizedException('Authentication required.');
    const parsed = JSON.parse(raw) as {
      sub: string;
      tenantId: string | null;
      roles: string[];
      platform?: boolean;
    };
    const claims = {
      sub: parsed.sub,
      tenantId: parsed.tenantId,
      roles: parsed.roles,
      isPlatformSession: () => Boolean(parsed.platform),
    } as unknown as JwtClaimsVO;
    req.user = claims;
    return true;
  }
}

describeDb('Wave A clinical catalog cross-tenant API (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let tenantA: string;
  let tenantB: string;
  let branchA: string;
  let branchB: string;
  let canonicalId: string;
  let customBId: string;
  let configBId: string;
  let priceBId: string;
  let actorA: string;
  let actorB: string;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();

    tenantA = randomUUID();
    tenantB = randomUUID();
    actorA = randomUUID();
    actorB = randomUUID();

    const wrapper = createClinicalPrismaWrapper(prisma);
    await wrapper.withPlatformBypass(async (client) => {
      await client.tenant.create({
        data: { id: tenantA, name: 'Tenant A', slug: `wa-a-${tenantA.slice(0, 8)}`, features: {} },
      });
      await client.tenant.create({
        data: { id: tenantB, name: 'Tenant B', slug: `wa-b-${tenantB.slice(0, 8)}`, features: {} },
      });
      branchA = (
        await client.branch.create({ data: { tenantId: tenantA, name: 'A Branch', isActive: true } })
      ).id;
      branchB = (
        await client.branch.create({ data: { tenantId: tenantB, name: 'B Branch', isActive: true } })
      ).id;

      canonicalId = (
        await client.canonicalClinicalServiceDefinition.create({
          data: {
            tenantId: null,
            provenance: 'SYSTEM_CANONICAL',
            stableKey: `canonical.general.iso_${tenantA.slice(0, 8)}`,
            domain: 'GENERAL',
            lifecycle: 'PUBLISHED',
            publishedAt: new Date(),
            translations: {
              create: [
                { locale: 'en', displayName: 'Isolation Canonical' },
                { locale: 'ar', displayName: 'عزل' },
              ],
            },
          },
        })
      ).id;

      customBId = (
        await client.canonicalClinicalServiceDefinition.create({
          data: {
            tenantId: tenantB,
            provenance: 'TENANT_CUSTOM',
            stableKey: `tenant.${tenantB}.custom.private`,
            domain: 'GENERAL',
            lifecycle: 'PUBLISHED',
            publishedAt: new Date(),
            translations: {
              create: [
                { locale: 'en', displayName: 'Private B' },
                { locale: 'ar', displayName: 'خاص ب' },
              ],
            },
          },
        })
      ).id;

      configBId = (
        await client.tenantServiceConfiguration.create({
          data: {
            tenantId: tenantB,
            clinicalServiceId: customBId,
            branchId: null,
            enabled: true,
          },
        })
      ).id;

      priceBId = (
        await client.clinicalServicePriceVersion.create({
          data: {
            tenantId: tenantB,
            branchId: null,
            clinicalServiceId: customBId,
            pricingUnit: 'PER_VISIT',
            currency: 'SYP',
            unitPrice: 99,
            taxPercent: 0,
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            status: 'DRAFT',
          },
        })
      ).id;
    });

    const prismaWrapper = createClinicalPrismaWrapper(prisma);
    const audit = new FakeClinicalCatalogAuditLog();
    const prismaForGuards = {
      ...prismaWrapper,
      // PermissionGuard custom-role lookup — empty grants in this harness.
      userCustomRole: { findMany: async () => [] },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [
        ClinicalCatalogController,
        ClinicalCatalogConfigsController,
        ClinicalCatalogPricesController,
        PlatformClinicalCatalogController,
      ],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaForGuards,
        },
        {
          provide: TenantContextService,
          useFactory: () => ({
            resolve: async () => {
              const store = (globalThis as { __waTenant?: string }).__waTenant;
              if (!store) throw new UnauthorizedException('Tenant context missing.');
              return { tenantId: store, branchId: null, locale: 'en' };
            },
          }),
        },
        {
          provide: CLINICAL_CATALOG_AUDIT_LOG,
          useValue: audit,
        },
        ClinicalCatalogService,
        ClinicalPriceVersionService,
        TenantServiceConfigService,
        {
          provide: APP_GUARD,
          useClass: TestClinicAuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: PermissionGuard,
        },
        PermissionGuard,
      ],
    })
      .overrideGuard(PlatformPermissionGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const user = ctx.switchToHttp().getRequest().user as JwtClaimsVO | undefined;
          if (!user?.isPlatformSession()) {
            throw new UnauthorizedException('Platform authentication required.');
          }
          return true;
        },
      })
      .compile();

    // Bridge: TestClinicAuthGuard sets user; wrap PermissionGuard path and tenant context.
    app = moduleRef.createNestApplication();
    app.use((
      req: { headers: Record<string, string>; user?: JwtClaimsVO },
      _res: unknown,
      next: () => void,
    ) => {
      try {
        const raw = req.headers['x-test-principal'];
        if (raw) {
          const parsed = JSON.parse(raw) as { tenantId: string | null; platform?: boolean };
          (globalThis as { __waTenant?: string }).__waTenant = parsed.tenantId ?? undefined;
        }
      } catch {
        /* ignore */
      }
      next();
    });
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await cleanupWaveAFixtures(prisma, [tenantA, tenantB]).catch(() => undefined);
    // also delete canonical created for isolation
    const wrapper = createClinicalPrismaWrapper(prisma);
    await wrapper
      .withPlatformBypass(async (client) => {
        await client.clinicalServiceTranslation.deleteMany({
          where: { clinicalServiceId: canonicalId },
        });
        await client.canonicalClinicalServiceDefinition.deleteMany({
          where: { id: canonicalId },
        });
      })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  function principal(opts: {
    sub: string;
    tenantId: string | null;
    roles?: string[];
    platform?: boolean;
  }) {
    return JSON.stringify({
      sub: opts.sub,
      tenantId: opts.tenantId,
      roles: opts.roles ?? ['owner'],
      platform: opts.platform ?? false,
    });
  }

  async function http(
    method: string,
    path: string,
    opts: { principal?: string; body?: unknown } = {},
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(opts.principal ? { 'x-test-principal': opts.principal } : {}),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json, text };
  }

  it('tenant cannot invoke platform clinical-catalog admin routes', async () => {
    const res = await http('GET', '/platform/clinical-catalog/services', {
      principal: principal({ sub: actorA, tenantId: tenantA, platform: false }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it('tenant cannot mutate SYSTEM_CANONICAL body', async () => {
    const res = await http('PATCH', `/clinical-catalog/services/${canonicalId}`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: { defaultDurationMin: 99 },
    });
    expect([403, 422]).toContain(res.status);
  });

  it('Tenant A cannot GET Tenant B TENANT_CUSTOM service', async () => {
    const res = await http('GET', `/clinical-catalog/services/${customBId}`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
    });
    expect([403, 404]).toContain(res.status);
  });

  it('Tenant A cannot UPDATE Tenant B TENANT_CUSTOM service', async () => {
    const res = await http('PATCH', `/clinical-catalog/services/${customBId}`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: { defaultDurationMin: 12 },
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('Tenant A cannot publish Tenant B TENANT_CUSTOM service', async () => {
    const res = await http('POST', `/clinical-catalog/services/${customBId}/publish`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('Tenant A cannot deprecate Tenant B TENANT_CUSTOM service', async () => {
    const res = await http('POST', `/clinical-catalog/services/${customBId}/deprecate`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('Tenant A config list does not include Tenant B configs', async () => {
    const res = await http('GET', '/clinical-catalog/configs', {
      principal: principal({ sub: actorA, tenantId: tenantA }),
    });
    expect(res.status).toBe(200);
    const rows = res.json as Array<{ id: string; tenantId: string }>;
    expect(rows.every((r) => r.tenantId === tenantA)).toBe(true);
    expect(rows.some((r) => r.id === configBId)).toBe(false);
  });

  it('Tenant A cannot enable Tenant B config by id', async () => {
    const res = await http('PATCH', `/clinical-catalog/configs/${configBId}/enabled`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: { enabled: false },
    });
    expect([403, 404]).toContain(res.status);
  });

  it('Tenant A cannot create config pointing to Tenant B TENANT_CUSTOM', async () => {
    const res = await http('PUT', '/clinical-catalog/configs', {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: { clinicalServiceId: customBId, enabled: true },
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('Tenant A cannot use Branch B belonging to another tenant', async () => {
    const res = await http('PUT', '/clinical-catalog/configs', {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: { clinicalServiceId: canonicalId, branchId: branchB, enabled: true },
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('Tenant A cannot read Tenant B price history', async () => {
    const res = await http('GET', `/clinical-catalog/prices?clinicalServiceId=${customBId}`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
    });
    expect(res.status).toBe(200);
    const rows = res.json as Array<{ id: string; tenantId: string }>;
    expect(rows.some((r) => r.id === priceBId)).toBe(false);
  });

  it('Tenant A cannot create draft for Tenant B custom service', async () => {
    const res = await http('POST', '/clinical-catalog/prices/drafts', {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: {
        clinicalServiceId: customBId,
        currency: 'SYP',
        unitPrice: 1,
        effectiveFrom: new Date('2026-08-01T00:00:00.000Z').toISOString(),
      },
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('Tenant A cannot publish Tenant B price draft', async () => {
    const res = await http('POST', `/clinical-catalog/prices/${priceBId}/publish`, {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: {},
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('Tenant A cannot create price draft using foreign branch', async () => {
    const res = await http('POST', '/clinical-catalog/prices/drafts', {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: {
        clinicalServiceId: canonicalId,
        branchId: branchB,
        currency: 'SYP',
        unitPrice: 1,
        effectiveFrom: new Date('2026-08-01T00:00:00.000Z').toISOString(),
      },
    });
    expect([403, 404, 422]).toContain(res.status);
  });

  it('platform bypass path still enforces tenant identity before privileged writes', async () => {
    // createDraft uses withPlatformBypass internally, but assertServiceReadable must deny
    // foreign TENANT_CUSTOM before insert.
    const res = await http('POST', '/clinical-catalog/prices/drafts', {
      principal: principal({ sub: actorA, tenantId: tenantA }),
      body: {
        clinicalServiceId: customBId,
        currency: 'SYP',
        unitPrice: 5,
        effectiveFrom: new Date('2026-10-01T00:00:00.000Z').toISOString(),
      },
    });
    expect([403, 404, 422]).toContain(res.status);

    const wrapper = createClinicalPrismaWrapper(prisma);
    const leaked = await wrapper.withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findFirst({
        where: { tenantId: tenantA, clinicalServiceId: customBId },
      }),
    );
    expect(leaked).toBeNull();
  });

  it('Tenant B owner can read own custom service (positive control)', async () => {
    const res = await http('GET', `/clinical-catalog/services/${customBId}`, {
      principal: principal({ sub: actorB, tenantId: tenantB }),
    });
    expect(res.status).toBe(200);
  });
});
