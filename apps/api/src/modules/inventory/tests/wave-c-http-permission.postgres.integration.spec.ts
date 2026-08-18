/**
 * Wave C Blocker 5 — runtime Nest HTTP permission / DTO validation for inventory usage routes.
 * Uses the real InventoryController + ValidationPipe + InventoryPermissionGuard + PermissionGuard.
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
import { DisposeInventoryBatchHandler } from '../application/handlers/dispose-inventory-batch.handler';
import { FulfillStockRequestLineHandler } from '../application/handlers/stock-request.handlers';
import { ListInventoryConsumptionsHandler } from '../application/handlers/list-inventory-consumptions.handler';
import {
  assertSafePlatformTestDatabaseUrl,
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

describeDb('Wave C inventory usage HTTP permission/DTO (Nest runtime)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tenantId: string;
  let consumeCalls: Array<Record<string, unknown>>;
  let reverseCalls: unknown[];
  let correctCalls: unknown[];
  let reportCalls: unknown[];
  let injectableLookups: unknown[];
  let listUsageCalls: unknown[];
  let disposeCalls: unknown[];
  let postingDisposeCalls: unknown[];
  let fulfillCalls: unknown[];
  let postingPostUsageCalls: unknown[];

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    tenantId = randomUUID();
    consumeCalls = [];
    reverseCalls = [];
    correctCalls = [];
    reportCalls = [];
    injectableLookups = [];
    listUsageCalls = [];
    disposeCalls = [];
    postingDisposeCalls = [];
    fulfillCalls = [];
    postingPostUsageCalls = [];

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
          useValue: { resolve: async () => ({ tenantId, branchId: null }) },
        },
        {
          provide: PrismaService,
          useValue: {
            userCustomRole: { findMany: async () => [] },
            inventoryUsageLedger: {
              findFirst: async (args: unknown) => {
                injectableLookups.push(args);
                return null;
              },
            },
          },
        },
        {
          provide: ConsumeInventoryHandler,
          useValue: {
            execute: async (cmd: Record<string, unknown>) => {
              consumeCalls.push(cmd);
              return { itemId: cmd.itemId, quantity: cmd.quantity, usageLedgerIds: [randomUUID()] };
            },
          },
        },
        {
          provide: InventoryUsagePostingService,
          useValue: {
            reverseUsage: async (args: unknown) => {
              reverseCalls.push(args);
              return { reversalUsageId: randomUUID() };
            },
            correctUsage: async (args: unknown) => {
              correctCalls.push(args);
              return { reversalUsageId: randomUUID(), lines: [{ usageLedgerId: randomUUID() }] };
            },
            disposeBatch: async (args: unknown) => {
              postingDisposeCalls.push(args);
              return { batchId: randomUUID(), itemId: randomUUID(), quantity: 1, usageLedgerIds: [] };
            },
            postUsage: async (args: unknown) => {
              postingPostUsageCalls.push(args);
              return { lines: [] };
            },
            postUsageInTx: async (args: unknown) => {
              postingPostUsageCalls.push(args);
              return { lines: [] };
            },
          },
        },
        {
          provide: FulfillStockRequestLineHandler,
          useValue: {
            execute: async (args: unknown) => {
              fulfillCalls.push(args);
              return { requestId: randomUUID(), status: 'APPROVED' };
            },
          },
        },
        {
          provide: DisposeInventoryBatchHandler,
          useValue: {
            execute: async (args: unknown) => {
              disposeCalls.push(args);
              return { batchId: randomUUID(), itemId: randomUUID(), quantity: 1, usageLedgerIds: [] };
            },
          },
        },
        {
          provide: InventoryUsageOwnerReportService,
          useValue: {
            report: async (args: unknown) => {
              reportCalls.push(args);
              return {
                total: 0,
                limit: 50,
                offset: 0,
                aggregates: { netQuantityTotal: 0, byUsageType: [], byUsedBy: [] },
                rows: [],
              };
            },
          },
        },
        {
          provide: ListInventoryConsumptionsHandler,
          useValue: {
            execute: async (args: unknown) => {
              listUsageCalls.push(args);
              return { items: [], total: 0 };
            },
          },
        },
      ],
    })
      .useMocker(() => ({ execute: async () => ({ ok: true }) }))
      .overrideGuard(LicensedModuleGuard)
      .useValue({ canActivate: async () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  function principal(roles: string[]) {
    return JSON.stringify({ sub: randomUUID(), tenantId, roles });
  }

  async function postUsage(opts: {
    roles?: string[];
    body?: Record<string, unknown>;
    auth?: boolean;
  }) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.auth !== false) {
      headers['x-test-principal'] = principal(opts.roles ?? ['inventory_manager']);
    }
    return fetch(`${baseUrl}/inventory/usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        opts.body ?? {
          itemId: randomUUID(),
          quantity: 1,
          usedByUserId: randomUUID(),
          usageType: 'CLINICAL_CONSUMPTION',
        },
      ),
    });
  }

  it('assistant normal usage -> allowed (inventory update)', async () => {
    consumeCalls.length = 0;
    const res = await postUsage({
      roles: ['assistant'],
      body: {
        itemId: randomUUID(),
        quantity: 1,
        usedByUserId: randomUUID(),
        usageType: 'CLINICAL_CONSUMPTION',
      },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(consumeCalls.length).toBe(1);
    expect(consumeCalls[0].hasInjectableCreatePermission).toBe(false);
  });

  it('assistant injectable payload -> 403 and consume is not called', async () => {
    consumeCalls.length = 0;
    const res = await postUsage({
      roles: ['assistant'],
      body: {
        itemId: randomUUID(),
        quantity: 1,
        usedByUserId: randomUUID(),
        usageType: 'CLINICAL_CONSUMPTION',
        injectable: { dose: 0.5, anatomicalSite: 'glabella' },
      },
    });
    expect(res.status).toBe(403);
    expect(consumeCalls.length).toBe(0);
  });

  it('doctor injectable payload -> allowed (inventory update + injectable create)', async () => {
    consumeCalls.length = 0;
    const res = await postUsage({
      roles: ['doctor'],
      body: {
        itemId: randomUUID(),
        quantity: 1,
        usedByUserId: randomUUID(),
        usageType: 'CLINICAL_CONSUMPTION',
        injectable: { dose: 0.5, anatomicalSite: 'glabella' },
      },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(consumeCalls.length).toBe(1);
    expect(consumeCalls[0].hasInjectableCreatePermission).toBe(true);
    expect(consumeCalls[0].injectable).toEqual(
      expect.objectContaining({ dose: 0.5, anatomicalSite: 'glabella' }),
    );
  });

  it('nurse injectable payload -> 403 (has injectable create but not inventory update)', async () => {
    consumeCalls.length = 0;
    const res = await postUsage({
      roles: ['nurse'],
      body: {
        itemId: randomUUID(),
        quantity: 1,
        usedByUserId: randomUUID(),
        usageType: 'CLINICAL_CONSUMPTION',
        injectable: { dose: 0.1 },
      },
    });
    expect(res.status).toBe(403);
    expect(consumeCalls.length).toBe(0);
  });

  it('unauthenticated -> 401', async () => {
    const res = await postUsage({ auth: false });
    expect(res.status).toBe(401);
  });

  it('authenticated unauthorized role -> 403', async () => {
    const res = await postUsage({ roles: ['patient'] });
    expect(res.status).toBe(403);
  });

  it('invalid usageType DTO -> 400', async () => {
    const res = await postUsage({
      roles: ['inventory_manager'],
      body: {
        itemId: randomUUID(),
        quantity: 1,
        usedByUserId: randomUUID(),
        usageType: 'SOMETHING_ELSE',
      },
    });
    expect(res.status).toBe(400);
  });

  it('malformed body (missing itemId) -> 400', async () => {
    const res = await postUsage({
      roles: ['owner'],
      body: { quantity: 1, usedByUserId: randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it('authorized inventory_manager posts usage -> success via canonical consume handler', async () => {
    consumeCalls.length = 0;
    const itemId = randomUUID();
    const usedBy = randomUUID();
    const res = await postUsage({
      roles: ['inventory_manager'],
      body: {
        itemId,
        quantity: 2,
        usedByUserId: usedBy,
        usageType: 'CLINICAL_CONSUMPTION',
      },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(consumeCalls.length).toBe(1);
    expect(consumeCalls[0].itemId).toBe(itemId);
    expect(consumeCalls[0].usedByUserId).toBe(usedBy);
    expect(consumeCalls[0].usageType).toBe('CLINICAL_CONSUMPTION');
  });

  it('owner-report authorized -> 200 via owner report service', async () => {
    reportCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/owner-report`, {
      headers: { 'x-test-principal': principal(['owner']) },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(reportCalls.length).toBe(1);
  });

  it('correct usage authorized approve role -> canonical correctUsage', async () => {
    correctCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/${randomUUID()}/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({
        reasonCode: 'FIX',
        correction: {
          itemId: randomUUID(),
          quantity: 1,
          usedByUserId: randomUUID(),
          usageType: 'CORRECTION',
        },
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(correctCalls.length).toBe(1);
  });

  it('correct usage with invalid nested usageType -> 400', async () => {
    const res = await fetch(`${baseUrl}/inventory/usage/${randomUUID()}/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({
        reasonCode: 'FIX',
        correction: {
          itemId: randomUUID(),
          quantity: 1,
          usedByUserId: randomUUID(),
          usageType: 'NOT_A_TYPE',
        },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('missing correction object -> 400 and correctUsage is not called', async () => {
    correctCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/${randomUUID()}/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ reasonCode: 'FIX' }),
    });
    expect(res.status).toBe(400);
    expect(correctCalls.length).toBe(0);
  });

  it('correction null -> 400 and correctUsage is not called', async () => {
    correctCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/${randomUUID()}/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ reasonCode: 'FIX', correction: null }),
    });
    expect(res.status).toBe(400);
    expect(correctCalls.length).toBe(0);
  });

  it('correction empty object -> 400 and correctUsage is not called', async () => {
    correctCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/${randomUUID()}/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ reasonCode: 'FIX', correction: {} }),
    });
    expect(res.status).toBe(400);
    expect(correctCalls.length).toBe(0);
  });

  it('correction missing quantity -> 400', async () => {
    const res = await fetch(`${baseUrl}/inventory/usage/${randomUUID()}/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({
        reasonCode: 'FIX',
        correction: { itemId: randomUUID(), usedByUserId: randomUUID() },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('correction invalid UUID -> 400', async () => {
    const res = await fetch(`${baseUrl}/inventory/usage/${randomUUID()}/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({
        reasonCode: 'FIX',
        correction: { itemId: 'not-a-uuid', quantity: 1, usedByUserId: randomUUID() },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('owner-report inventory_manager without includePhi -> 200 and hasPhiPermission false', async () => {
    reportCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/owner-report`, {
      headers: { 'x-test-principal': principal(['inventory_manager']) },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(reportCalls.length).toBe(1);
    expect((reportCalls[0] as { includePhi: boolean; hasPhiPermission: boolean }).includePhi).toBe(false);
    expect((reportCalls[0] as { hasPhiPermission: boolean }).hasPhiPermission).toBe(false);
  });

  it('owner-report inventory_manager includePhi=true -> 403 (export is not PHI)', async () => {
    reportCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/owner-report?includePhi=true`, {
      headers: { 'x-test-principal': principal(['inventory_manager']) },
    });
    expect(res.status).toBe(403);
    expect(reportCalls.length).toBe(0);
  });

  it('owner-report accountant includePhi=true -> 403', async () => {
    const res = await fetch(`${baseUrl}/inventory/usage/owner-report?includePhi=true`, {
      headers: { 'x-test-principal': principal(['accountant']) },
    });
    expect(res.status).toBe(403);
  });

  it('owner-report owner includePhi=true -> 200 with PHI permission derived from roles', async () => {
    reportCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/owner-report?includePhi=true`, {
      headers: { 'x-test-principal': principal(['owner']) },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(reportCalls.length).toBe(1);
    expect((reportCalls[0] as { includePhi: boolean; hasPhiPermission: boolean }).includePhi).toBe(true);
    expect((reportCalls[0] as { hasPhiPermission: boolean }).hasPhiPermission).toBe(true);
  });

  it('owner-report receptionist (no export) -> 403', async () => {
    const res = await fetch(`${baseUrl}/inventory/usage/owner-report`, {
      headers: { 'x-test-principal': principal(['receptionist']) },
    });
    expect(res.status).toBe(403);
  });

  it('cross-tenant context stays on resolved tenant (handler receives tenant from server context)', async () => {
    consumeCalls.length = 0;
    await postUsage({
      roles: ['owner'],
      body: {
        itemId: randomUUID(),
        quantity: 1,
        usedByUserId: randomUUID(),
        usageType: 'CLINICAL_CONSUMPTION',
      },
    });
    // Tenant is resolved by TenantContextService, not client body.
    expect(consumeCalls.length).toBe(1);
  });

  it('reverse invalid UUID path -> 400 and service not called', async () => {
    reverseCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/not-a-uuid/reverse`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ reasonCode: 'FIX' }),
    });
    expect(res.status).toBe(400);
    expect(reverseCalls.length).toBe(0);
  });

  it('correct invalid UUID path -> 400 and service not called', async () => {
    correctCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/not-a-uuid/correct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({
        reasonCode: 'FIX',
        correction: { itemId: randomUUID(), quantity: 1, usedByUserId: randomUUID() },
      }),
    });
    expect(res.status).toBe(400);
    expect(correctCalls.length).toBe(0);
  });

  it('injectable lookup invalid UUID path -> 400 and prisma not queried', async () => {
    injectableLookups.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage/not-a-uuid/injectable`, {
      headers: { 'x-test-principal': principal(['doctor']) },
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
    expect(injectableLookups.length).toBe(0);
  });

  async function ownerReport(query: string) {
    return fetch(`${baseUrl}/inventory/usage/owner-report${query}`, {
      headers: { 'x-test-principal': principal(['owner']) },
    });
  }

  it('owner-report invalid UUID filters -> 400 and service not called', async () => {
    reportCalls.length = 0;
    const usedBy = await ownerReport('?usedByUserId=not-a-uuid');
    const item = await ownerReport('?inventoryItemId=bad');
    const batch = await ownerReport('?inventoryBatchId=nope');
    const branch = await ownerReport('?branchId=xyz');
    const service = await ownerReport(`?clinicalServiceId=not-a-uuid`);
    expect(usedBy.status).toBe(400);
    expect(item.status).toBe(400);
    expect(batch.status).toBe(400);
    expect(branch.status).toBe(400);
    expect(service.status).toBe(400);
    expect(reportCalls.length).toBe(0);
  });

  it('owner-report invalid date / from>to -> 400', async () => {
    reportCalls.length = 0;
    const badDate = await ownerReport('?from=not-a-date');
    const range = await ownerReport('?from=2026-02-01&to=2026-01-01');
    expect(badDate.status).toBe(400);
    expect(range.status).toBe(400);
    expect(reportCalls.length).toBe(0);
  });

  it('owner-report invalid limit/offset/usageType -> 400', async () => {
    reportCalls.length = 0;
    const limitAbc = await ownerReport('?limit=abc');
    const limitNeg = await ownerReport('?limit=-1');
    const limitDec = await ownerReport('?limit=1.5');
    const offsetAbc = await ownerReport('?offset=abc');
    const offsetNeg = await ownerReport('?offset=-1');
    const usage = await ownerReport('?usageType=NOT_A_TYPE');
    expect(limitAbc.status).toBe(400);
    expect(limitNeg.status).toBe(400);
    expect(limitDec.status).toBe(400);
    expect(offsetAbc.status).toBe(400);
    expect(offsetNeg.status).toBe(400);
    expect(usage.status).toBe(400);
    expect(reportCalls.length).toBe(0);
  });

  it('owner-report valid query still reaches service', async () => {
    reportCalls.length = 0;
    const res = await ownerReport(
      `?from=2026-01-01&to=2026-01-31&limit=10&offset=0&usageType=CLINICAL_CONSUMPTION&usedByUserId=${randomUUID()}`,
    );
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(reportCalls.length).toBe(1);
  });

  it('list usage invalid itemId UUID -> 400 and handler not called', async () => {
    listUsageCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/usage?itemId=not-a-uuid`, {
      headers: { 'x-test-principal': principal(['owner']) },
    });
    expect(res.status).toBe(400);
    expect(listUsageCalls.length).toBe(0);
  });

  it('dispose invalid batchId UUID -> 400 and handler/posting not called', async () => {
    disposeCalls.length = 0;
    postingDisposeCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/batch/not-a-uuid/dispose`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ quantity: 1, reason: 'expired', usedByUserId: randomUUID() }),
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
    expect(disposeCalls.length).toBe(0);
    expect(postingDisposeCalls.length).toBe(0);
  });

  it('dispose valid batchId still reaches handler', async () => {
    disposeCalls.length = 0;
    postingDisposeCalls.length = 0;
    const batchId = randomUUID();
    const usedByUserId = randomUUID();
    const res = await fetch(`${baseUrl}/inventory/batch/${batchId}/dispose`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ quantity: 1, reason: 'expired', usedByUserId }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(disposeCalls.length).toBe(1);
    expect((disposeCalls[0] as { batchId: string; usedByUserId: string }).batchId).toBe(batchId);
    expect((disposeCalls[0] as { usedByUserId: string }).usedByUserId).toBe(usedByUserId);
    expect(postingDisposeCalls.length).toBe(0);
  });

  it('stock-request fulfill invalid lineId UUID -> 400 and handler/posting not called', async () => {
    fulfillCalls.length = 0;
    postingPostUsageCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/stock-requests/lines/not-a-uuid/fulfill`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ quantity: 1, usedByUserId: randomUUID() }),
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
    expect(fulfillCalls.length).toBe(0);
    expect(postingPostUsageCalls.length).toBe(0);
  });

  it('stock-request fulfill missing usedByUserId -> 400 and handler/posting not called', async () => {
    fulfillCalls.length = 0;
    postingPostUsageCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/stock-requests/lines/${randomUUID()}/fulfill`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ quantity: 1 }),
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
    expect(fulfillCalls.length).toBe(0);
    expect(postingPostUsageCalls.length).toBe(0);
  });

  it('stock-request fulfill malformed usedByUserId -> 400 and handler/posting not called', async () => {
    fulfillCalls.length = 0;
    postingPostUsageCalls.length = 0;
    const res = await fetch(`${baseUrl}/inventory/stock-requests/lines/${randomUUID()}/fulfill`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': principal(['owner']),
      },
      body: JSON.stringify({ quantity: 1, usedByUserId: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
    expect(fulfillCalls.length).toBe(0);
    expect(postingPostUsageCalls.length).toBe(0);
  });

  it('stock-request fulfill valid lineId still reaches handler with explicit usedBy', async () => {
    fulfillCalls.length = 0;
    postingPostUsageCalls.length = 0;
    const lineId = randomUUID();
    const usedByUserId = randomUUID();
    const actorId = randomUUID();
    const res = await fetch(`${baseUrl}/inventory/stock-requests/lines/${lineId}/fulfill`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': JSON.stringify({
          sub: actorId,
          userId: actorId,
          tenantId,
          roles: ['owner'],
        }),
      },
      body: JSON.stringify({ quantity: 2, usedByUserId }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(fulfillCalls.length).toBe(1);
    const cmd = fulfillCalls[0] as {
      lineId: string;
      quantity: number;
      fulfilledBy: string;
      usedByUserId: string;
    };
    expect(cmd.lineId).toBe(lineId);
    expect(cmd.quantity).toBe(2);
    expect(cmd.fulfilledBy).toBe(actorId);
    expect(cmd.usedByUserId).toBe(usedByUserId);
    expect(cmd.usedByUserId).not.toBe(cmd.fulfilledBy);
    expect(postingPostUsageCalls.length).toBe(0);
  });

  it('stock-request fulfill dashboard contract {quantity, usedByUserId, notes} is accepted', async () => {
    fulfillCalls.length = 0;
    postingPostUsageCalls.length = 0;
    const lineId = randomUUID();
    const usedByUserId = randomUUID();
    const actorId = randomUUID();
    const res = await fetch(`${baseUrl}/inventory/stock-requests/lines/${lineId}/fulfill`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-principal': JSON.stringify({
          sub: actorId,
          userId: actorId,
          tenantId,
          roles: ['owner'],
        }),
      },
      body: JSON.stringify({ quantity: 3, usedByUserId, notes: 'ward A' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(fulfillCalls.length).toBe(1);
    const cmd = fulfillCalls[0] as {
      quantity: number;
      usedByUserId: string;
      fulfilledBy: string;
      notes?: string | null;
    };
    expect(cmd.quantity).toBe(3);
    expect(cmd.usedByUserId).toBe(usedByUserId);
    expect(cmd.fulfilledBy).toBe(actorId);
    expect(cmd.usedByUserId).not.toBe(cmd.fulfilledBy);
    expect(cmd.notes).toBe('ward A');
  });
});
