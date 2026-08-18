/**
 * Wave C Round 4 B1 — tenant-safe related IDs on canonical inventory usage posting.
 * Service tests hit InventoryUsagePostingService directly.
 * HTTP test executes the real posting path (not a mocked mutation service).
 */
import 'reflect-metadata';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import { PermissionGuard } from '../../auth/api/guards/permission.guard';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { InventoryController } from '../controllers/inventory.controller';
import { InventoryPermissionGuard } from '../api/inventory-permission.guard';
import { InventoryPolicyService } from '../policies/inventory-policy.service';
import { LicensedModuleGuard } from '../../subscription/api/guards/licensed-module.guard';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InventoryUsagePostingService } from '../application/services/inventory-usage-posting.service';
import { InventoryUsageOwnerReportService } from '../application/services/inventory-usage-owner-report.service';
import { ConsumeInventoryHandler } from '../application/handlers/consume-inventory.handler';
import { ListInventoryConsumptionsHandler } from '../application/handlers/list-inventory-consumptions.handler';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
} from '../../auth/tests/platform-db-security.harness';

jest.setTimeout(120_000);

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
      userId?: string;
    };
    req.user = {
      sub: parsed.sub,
      userId: parsed.userId ?? parsed.sub,
      tenantId: parsed.tenantId,
      roles: parsed.roles,
      isPlatformSession: () => false,
    } as unknown as JwtClaimsVO;
    return true;
  }
}

describeDb('Wave C Round 4 tenant-related inventory references', () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const actorA = randomUUID();
  const usedByA = randomUUID();
  let prisma: ReturnType<typeof createPlatformDbSecurityClient>;
  let posting: InventoryUsagePostingService;
  let itemA: string;
  let warehouseA: string;
  let patientA: string;
  let patientA2: string;
  let patientB: string;
  let branchA: string;
  let branchB: string;
  let appointmentA: string;
  let appointmentB: string;
  let encounterA: string;
  let encounterB: string;
  let serviceA: string;
  let serviceB: string;
  let platformService: string;
  let annotationA: string;
  let annotationB: string;
  let app: INestApplication | undefined;
  let baseUrl: string;

  async function seedStock(qty = 50) {
    await prisma.inventoryItem.update({
      where: { id: itemA },
      data: { quantityOnHand: new Prisma.Decimal(qty) },
    });
    await prisma.inventoryWarehouseStock.updateMany({
      where: { tenantId: tenantA, warehouseId: warehouseA, inventoryItemId: itemA },
      data: { quantityOnHand: new Prisma.Decimal(qty) },
    });
  }

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: 'WC R4 A', slug: `wc-r4-a-${tenantA.slice(0, 8)}`, status: 'ACTIVE' },
        { id: tenantB, name: 'WC R4 B', slug: `wc-r4-b-${tenantB.slice(0, 8)}`, status: 'ACTIVE' },
      ],
    });
    await prisma.user.create({
      data: {
        id: actorA,
        tenantId: tenantA,
        email: `r4-actor-${actorA.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'A',
        lastName: 'Actor',
      },
    });
    await prisma.user.create({
      data: {
        id: usedByA,
        tenantId: tenantA,
        email: `r4-used-${usedByA.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Used',
        lastName: 'By',
      },
    });

    patientA = randomUUID();
    patientA2 = randomUUID();
    patientB = randomUUID();
    await prisma.patient.createMany({
      data: [
        { id: patientA, tenantId: tenantA, firstName: 'Pat', lastName: 'A', phone: `+1${tenantA.slice(0, 10)}` },
        { id: patientA2, tenantId: tenantA, firstName: 'Pat', lastName: 'A2', phone: `+2${tenantA.slice(0, 10)}` },
        { id: patientB, tenantId: tenantB, firstName: 'Pat', lastName: 'B', phone: `+1${tenantB.slice(0, 10)}` },
      ],
    });

    branchA = randomUUID();
    branchB = randomUUID();
    await prisma.branch.createMany({
      data: [
        { id: branchA, tenantId: tenantA, name: 'Branch A' },
        { id: branchB, tenantId: tenantB, name: 'Branch B' },
      ],
    });

    platformService = randomUUID();
    serviceA = randomUUID();
    serviceB = randomUUID();
    await prisma.canonicalClinicalServiceDefinition.create({
      data: {
        id: platformService,
        tenantId: null,
        provenance: 'SYSTEM_CANONICAL',
        stableKey: `canonical.general.wc-r4-${platformService.slice(0, 8)}`,
        domain: 'GENERAL',
        lifecycle: 'PUBLISHED',
      },
    });
    await prisma.canonicalClinicalServiceDefinition.create({
      data: {
        id: serviceA,
        tenantId: tenantA,
        provenance: 'TENANT_CUSTOM',
        stableKey: `tenant.${tenantA}.custom.wc-r4-a`,
        domain: 'GENERAL',
        lifecycle: 'PUBLISHED',
      },
    });
    await prisma.canonicalClinicalServiceDefinition.create({
      data: {
        id: serviceB,
        tenantId: tenantB,
        provenance: 'TENANT_CUSTOM',
        stableKey: `tenant.${tenantB}.custom.wc-r4-b`,
        domain: 'GENERAL',
        lifecycle: 'PUBLISHED',
      },
    });

    const start = new Date(Date.now() + 3600_000);
    const end = new Date(start.getTime() + 1800_000);
    appointmentA = randomUUID();
    appointmentB = randomUUID();
    await prisma.appointment.create({
      data: {
        id: appointmentA,
        tenantId: tenantA,
        branchId: branchA,
        patientId: patientA,
        providerId: actorA,
        scheduledStart: start,
        scheduledEnd: end,
        clinicalServiceId: serviceA,
      },
    });
    await prisma.appointment.create({
      data: {
        id: appointmentB,
        tenantId: tenantB,
        branchId: branchB,
        patientId: patientB,
        providerId: actorA,
        scheduledStart: start,
        scheduledEnd: end,
        clinicalServiceId: serviceB,
      },
    });

    encounterA = randomUUID();
    encounterB = randomUUID();
    await prisma.encounter.create({
      data: {
        id: encounterA,
        tenantId: tenantA,
        branchId: branchA,
        patientId: patientA,
        appointmentId: appointmentA,
        clinicianId: actorA,
      },
    });
    await prisma.encounter.create({
      data: {
        id: encounterB,
        tenantId: tenantB,
        branchId: branchB,
        patientId: patientB,
        appointmentId: appointmentB,
        clinicianId: actorA,
      },
    });

    const beautyA = randomUUID();
    const beautyB = randomUUID();
    await prisma.beautyRecord.create({
      data: { id: beautyA, tenantId: tenantA, patientId: patientA },
    });
    await prisma.beautyRecord.create({
      data: { id: beautyB, tenantId: tenantB, patientId: patientB },
    });
    annotationA = randomUUID();
    annotationB = randomUUID();
    await prisma.beautyAnnotation.create({
      data: {
        id: annotationA,
        beautyRecordId: beautyA,
        tenantId: tenantA,
        zone: 'forehead',
        treatment: 'botox',
        coordinates: { x: 0, y: 0, view: 'front' },
        recordedBy: actorA,
        encounterId: encounterA,
      },
    });
    await prisma.beautyAnnotation.create({
      data: {
        id: annotationB,
        beautyRecordId: beautyB,
        tenantId: tenantB,
        zone: 'forehead',
        treatment: 'botox',
        coordinates: { x: 0, y: 0, view: 'front' },
        recordedBy: actorA,
        encounterId: encounterB,
      },
    });

    warehouseA = randomUUID();
    await prisma.inventoryWarehouse.create({
      data: {
        id: warehouseA,
        tenantId: tenantA,
        code: 'R4MAIN',
        nameEn: 'R4 Main',
        isDefault: true,
        isActive: true,
      },
    });
    itemA = randomUUID();
    await prisma.inventoryItem.create({
      data: {
        id: itemA,
        tenantId: tenantA,
        sku: `R4-${itemA.slice(0, 6)}`,
        nameEn: 'R4 Item',
        unit: 'unit',
        quantityOnHand: new Prisma.Decimal(50),
      },
    });
    await prisma.inventoryWarehouseStock.create({
      data: {
        id: randomUUID(),
        tenantId: tenantA,
        warehouseId: warehouseA,
        inventoryItemId: itemA,
        quantityOnHand: new Prisma.Decimal(50),
      },
    });

    posting = new InventoryUsagePostingService(prisma as never);

    const moduleRef = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryPermissionGuard,
        InventoryPolicyService,
        PermissionGuard,
        { provide: APP_GUARD, useClass: TestClinicAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: tenantA, branchId: null }) },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryUsagePostingService, useValue: posting },
        {
          provide: ConsumeInventoryHandler,
          useValue: {
            execute: async (cmd: Record<string, unknown>) => {
              const posted = await posting.postUsage({
                tenantId: tenantA,
                inventoryItemId: String(cmd.itemId),
                quantity: Number(cmd.quantity),
                usageType: (cmd.usageType as 'CLINICAL_CONSUMPTION') ?? 'CLINICAL_CONSUMPTION',
                recordedByUserId: String(cmd.recordedByUserId),
                usedByUserId: (cmd.usedByUserId as string | null) ?? null,
                warehouseId: (cmd.warehouseId as string | null) ?? warehouseA,
                branchId: (cmd.branchId as string | null) ?? null,
                encounterId: (cmd.encounterId as string | null) ?? null,
                beautyAnnotationId: (cmd.beautyAnnotationId as string | null) ?? null,
                patientId: (cmd.patientId as string | null) ?? null,
                appointmentId: (cmd.appointmentId as string | null) ?? null,
                clinicalServiceId: (cmd.clinicalServiceId as string | null) ?? null,
                inventoryBatchId: (cmd.inventoryBatchId as string | null) ?? null,
                reasonCode: (cmd.reasonCode as string | null) ?? null,
                procedureCode: (cmd.procedureCode as string | null) ?? null,
                notes: (cmd.notes as string | null) ?? null,
                injectable: (cmd.injectable as PostUsageInjectable) ?? null,
              });
              return {
                itemId: cmd.itemId,
                quantity: cmd.quantity,
                usageLedgerIds: posted.lines.map((l) => l.usageLedgerId),
              };
            },
          },
        },
        { provide: InventoryUsageOwnerReportService, useValue: new InventoryUsageOwnerReportService(prisma as never) },
        { provide: ListInventoryConsumptionsHandler, useValue: { execute: async () => ({ items: [], total: 0 }) } },
      ],
    })
      .useMocker(() => ({ execute: async () => ({ ok: true }) }))
      .overrideGuard(LicensedModuleGuard)
      .useValue({ canActivate: async () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  function basePost() {
    return {
      tenantId: tenantA,
      inventoryItemId: itemA,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION' as const,
      recordedByUserId: actorA,
      usedByUserId: usedByA,
      warehouseId: warehouseA,
    };
  }

  it('same-tenant related IDs succeed; null optionals succeed; platform clinical service allowed', async () => {
    await seedStock();
    const posted = await posting.postUsage({
      ...basePost(),
      patientId: patientA,
      appointmentId: appointmentA,
      clinicalServiceId: serviceA,
      branchId: branchA,
      encounterId: encounterA,
      beautyAnnotationId: annotationA,
    });
    expect(posted.lines.length).toBe(1);
    const row = await prisma.inventoryUsageLedger.findUnique({ where: { id: posted.lines[0].usageLedgerId } });
    expect(row?.patientId).toBe(patientA);
    expect(row?.appointmentId).toBe(appointmentA);
    expect(row?.clinicalServiceId).toBe(serviceA);
    expect(row?.branchId).toBe(branchA);
    expect(row?.encounterId).toBe(encounterA);
    expect(row?.beautyAnnotationId).toBe(annotationA);

    await seedStock();
    const nulls = await posting.postUsage(basePost());
    expect(nulls.lines.length).toBe(1);

    await seedStock();
    const platform = await posting.postUsage({ ...basePost(), clinicalServiceId: platformService });
    const platformRow = await prisma.inventoryUsageLedger.findUnique({
      where: { id: platform.lines[0].usageLedgerId },
    });
    expect(platformRow?.clinicalServiceId).toBe(platformService);
  });

  it('cross-tenant and nonexistent related IDs are rejected', async () => {
    await seedStock();
    await expect(posting.postUsage({ ...basePost(), patientId: patientB })).rejects.toThrow(/patientId/);
    await expect(posting.postUsage({ ...basePost(), appointmentId: appointmentB })).rejects.toThrow(/appointmentId/);
    await expect(posting.postUsage({ ...basePost(), clinicalServiceId: serviceB })).rejects.toThrow(
      /clinicalServiceId/,
    );
    await expect(posting.postUsage({ ...basePost(), branchId: branchB })).rejects.toThrow(/branchId/);
    await expect(posting.postUsage({ ...basePost(), encounterId: encounterB })).rejects.toThrow(/encounterId/);
    await expect(posting.postUsage({ ...basePost(), beautyAnnotationId: annotationB })).rejects.toThrow(
      /beautyAnnotationId/,
    );
    await expect(posting.postUsage({ ...basePost(), patientId: randomUUID() })).rejects.toThrow(/patientId/);
    await expect(posting.postUsage({ ...basePost(), appointmentId: randomUUID() })).rejects.toThrow(/appointmentId/);
    await expect(posting.postUsage({ ...basePost(), clinicalServiceId: randomUUID() })).rejects.toThrow(
      /clinicalServiceId/,
    );
    await expect(posting.postUsage({ ...basePost(), branchId: randomUUID() })).rejects.toThrow(/branchId/);
    await expect(posting.postUsage({ ...basePost(), encounterId: randomUUID() })).rejects.toThrow(/encounterId/);
    await expect(posting.postUsage({ ...basePost(), beautyAnnotationId: randomUUID() })).rejects.toThrow(
      /beautyAnnotationId/,
    );
  });

  it('same-tenant relationship mismatches are rejected', async () => {
    await seedStock();
    await expect(
      posting.postUsage({ ...basePost(), appointmentId: appointmentA, patientId: patientA2 }),
    ).rejects.toThrow(/appointmentId patient/);
    await expect(
      posting.postUsage({ ...basePost(), appointmentId: appointmentA, clinicalServiceId: platformService }),
    ).rejects.toThrow(/clinical service/);
  });

  it('HTTP POST /inventory/usage with Tenant B patientId executes real posting and is rejected', async () => {
    await seedStock();
    const before = await prisma.inventoryUsageLedger.count({ where: { tenantId: tenantA } });
    const res = await fetch(`${baseUrl}/inventory/usage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': JSON.stringify({
          sub: actorA,
          tenantId: tenantA,
          roles: ['inventory_manager'],
        }),
      },
      body: JSON.stringify({
        itemId: itemA,
        quantity: 1,
        usedByUserId: usedByA,
        usageType: 'CLINICAL_CONSUMPTION',
        warehouseId: warehouseA,
        patientId: patientB,
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const after = await prisma.inventoryUsageLedger.count({ where: { tenantId: tenantA } });
    expect(after).toBe(before);
  });

  it('HTTP owner-report: inventory_manager includePhi=true is 403; omitted includePhi has no PHI fields', async () => {
    await seedStock();
    await posting.postUsage({
      ...basePost(),
      patientId: patientA,
      appointmentId: appointmentA,
    });
    const denied = await fetch(`${baseUrl}/inventory/usage/owner-report?includePhi=true`, {
      headers: {
        'x-test-principal': JSON.stringify({
          sub: actorA,
          tenantId: tenantA,
          roles: ['inventory_manager'],
        }),
      },
    });
    expect(denied.status).toBe(403);

    const allowed = await fetch(`${baseUrl}/inventory/usage/owner-report`, {
      headers: {
        'x-test-principal': JSON.stringify({
          sub: actorA,
          tenantId: tenantA,
          roles: ['inventory_manager'],
        }),
      },
    });
    expect(allowed.status).toBe(200);
    const body = (await allowed.json()) as { rows: Array<Record<string, unknown>> };
    expect(body.rows.every((r) => !('patientId' in r) && !('appointmentId' in r))).toBe(true);
  });

  it('HTTP owner-report: owner includePhi=true returns PHI fields', async () => {
    const res = await fetch(`${baseUrl}/inventory/usage/owner-report?includePhi=true`, {
      headers: {
        'x-test-principal': JSON.stringify({
          sub: actorA,
          tenantId: tenantA,
          roles: ['owner'],
        }),
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<Record<string, unknown>> };
    expect(body.rows.some((r) => r.patientId === patientA)).toBe(true);
    expect(body.rows.some((r) => 'appointmentId' in r)).toBe(true);
  });
});

type PostUsageInjectable = {
  dose?: number | null;
  anatomicalSite?: string | null;
  beautyAnnotationId?: string | null;
  notes?: string | null;
};
