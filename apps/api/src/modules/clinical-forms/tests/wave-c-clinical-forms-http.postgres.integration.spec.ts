/**
 * Wave C Round 5 — Clinical Forms HTTP DTO + void-route authorization (Nest runtime).
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
import { ClinicalFormsController } from '../api/clinical-forms.controller';
import { ClinicalFormTemplateService } from '../services/clinical-form-template.service';
import { ClinicalFormVersionService } from '../services/clinical-form-version.service';
import { PatientFormInstanceService } from '../services/patient-form-instance.service';
import { ClinicalServiceFormRequirementService } from '../services/clinical-service-form-requirement.service';
import { LicensedModuleGuard } from '../../subscription/api/guards/licensed-module.guard';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';

jest.setTimeout(60_000);

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
    const parsed = JSON.parse(raw) as { sub: string; tenantId: string | null; roles: string[] };
    req.user = {
      sub: parsed.sub,
      userId: parsed.sub,
      tenantId: parsed.tenantId,
      roles: parsed.roles,
      isPlatformSession: () => false,
    } as unknown as JwtClaimsVO;
    return true;
  }
}

describeDb('Wave C clinical-forms HTTP DTO/permission (Nest runtime)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tenantId: string;
  let createCalls: unknown[];
  let signCalls: unknown[];
  let voidCalls: unknown[];
  let upsertCalls: unknown[];
  let customRoleRows: Array<{ customRole: { isArchived: boolean; permissions: Record<string, string[]> } }>;

  beforeAll(async () => {
    tenantId = randomUUID();
    createCalls = [];
    signCalls = [];
    voidCalls = [];
    upsertCalls = [];
    customRoleRows = [];

    const moduleRef = await Test.createTestingModule({
      controllers: [ClinicalFormsController],
      providers: [
        PermissionGuard,
        { provide: APP_GUARD, useClass: TestClinicAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: PrismaService, useValue: { userCustomRole: { findMany: async () => customRoleRows } } },
        {
          provide: PatientFormInstanceService,
          useValue: {
            createDraft: async (args: unknown) => {
              createCalls.push(args);
              return { id: randomUUID(), status: 'DRAFT' };
            },
            sign: async (args: unknown) => {
              signCalls.push(args);
              return { id: randomUUID(), status: 'SIGNED' };
            },
            voidInstance: async (args: unknown) => {
              voidCalls.push(args);
              return { id: randomUUID(), status: 'VOID' };
            },
          },
        },
        {
          provide: ClinicalServiceFormRequirementService,
          useValue: {
            upsert: async (args: unknown) => {
              upsertCalls.push(args);
              return { id: randomUUID() };
            },
            list: async () => [],
            deactivate: async () => ({ id: randomUUID() }),
          },
        },
        {
          provide: ClinicalFormTemplateService,
          useValue: { list: async () => [], create: async () => ({}), get: async () => ({}), activate: async () => ({}) },
        },
        {
          provide: ClinicalFormVersionService,
          useValue: { createDraft: async () => ({}), publish: async () => ({}) },
        },
      ],
    })
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

  function headers(roles: string[]) {
    return {
      'content-type': 'application/json',
      'x-test-principal': JSON.stringify({ sub: randomUUID(), tenantId, roles }),
    };
  }

  it('create instance malformed patientId -> 400 and service not called', async () => {
    createCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/instances`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({ patientId: 'not-a-uuid', versionId: randomUUID() }),
    });
    expect(res.status).toBe(400);
    expect(createCalls.length).toBe(0);
  });

  it('create instance malformed versionId / appointmentId / clinicalServiceId -> 400', async () => {
    createCalls.length = 0;
    const badVersion = await fetch(`${baseUrl}/clinical-forms/instances`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({ patientId: randomUUID(), versionId: 'bad' }),
    });
    const badAppt = await fetch(`${baseUrl}/clinical-forms/instances`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({
        patientId: randomUUID(),
        versionId: randomUUID(),
        appointmentId: 'bad',
      }),
    });
    const badSvc = await fetch(`${baseUrl}/clinical-forms/instances`, {
      method: 'POST',
      headers: headers(['owner']),
      body: JSON.stringify({
        patientId: randomUUID(),
        versionId: randomUUID(),
        clinicalServiceId: 'bad',
      }),
    });
    expect(badVersion.status).toBe(400);
    expect(badAppt.status).toBe(400);
    expect(badSvc.status).toBe(400);
    expect(createCalls.length).toBe(0);
  });

  it('sign malformed signerPatientId / invalid method -> 400', async () => {
    signCalls.length = 0;
    const badSigner = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({ signerPatientId: 'nope' }),
    });
    const badMethod = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({ method: 'GUARDIAN' }),
    });
    expect(badSigner.status).toBe(400);
    expect(badMethod.status).toBe(400);
    expect(signCalls.length).toBe(0);
  });

  it('invalid path UUID on sign/void/template/publish/requirements -> 400 and service not called', async () => {
    createCalls.length = 0;
    signCalls.length = 0;
    voidCalls.length = 0;
    const badSign = await fetch(`${baseUrl}/clinical-forms/instances/not-a-uuid/sign`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({}),
    });
    const badVoid = await fetch(`${baseUrl}/clinical-forms/instances/not-a-uuid/void`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({ reason: 'valid reason' }),
    });
    const badTemplate = await fetch(`${baseUrl}/clinical-forms/templates/not-a-uuid`, {
      headers: headers(['owner']),
    });
    const badPublish = await fetch(`${baseUrl}/clinical-forms/versions/not-a-uuid/publish`, {
      method: 'POST',
      headers: headers(['owner']),
    });
    const badReqQuery = await fetch(`${baseUrl}/clinical-forms/requirements?clinicalServiceId=bad`, {
      headers: headers(['owner']),
    });
    const badDeactivate = await fetch(`${baseUrl}/clinical-forms/requirements/not-a-uuid/deactivate`, {
      method: 'POST',
      headers: headers(['owner']),
    });
    expect(badSign.status).toBe(400);
    expect(badVoid.status).toBe(400);
    expect(badTemplate.status).toBe(400);
    expect(badPublish.status).toBe(400);
    expect(badReqQuery.status).toBe(400);
    expect(badDeactivate.status).toBe(400);
    expect(signCalls.length).toBe(0);
    expect(voidCalls.length).toBe(0);
  });

  it('void missing/empty reason -> 400 and service not called', async () => {
    voidCalls.length = 0;
    const missing = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
      method: 'POST',
      headers: headers(['nurse']),
      body: JSON.stringify({}),
    });
    const empty = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
      method: 'POST',
      headers: headers(['nurse']),
      body: JSON.stringify({ reason: '' }),
    });
    expect(missing.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(voidCalls.length).toBe(0);
  });

  it('void authorized clinical staff (nurse) -> service called', async () => {
    voidCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
      method: 'POST',
      headers: headers(['nurse']),
      body: JSON.stringify({ reason: 'Patient withdrew' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(voidCalls.length).toBe(1);
  });

  it('sign authorized clinical staff (doctor) -> service called', async () => {
    signCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({ method: 'STAFF_WITNESSED' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(signCalls.length).toBe(1);
  });

  it('receptionist sign -> 403 and no DB mutation service call', async () => {
    signCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
      method: 'POST',
      headers: headers(['receptionist']),
      body: JSON.stringify({ method: 'STAFF_WITNESSED' }),
    });
    expect(res.status).toBe(403);
    expect(signCalls.length).toBe(0);
  });

  it('receptionist void -> 403 and service not called', async () => {
    voidCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
      method: 'POST',
      headers: headers(['receptionist']),
      body: JSON.stringify({ reason: 'Patient withdrew' }),
    });
    expect(res.status).toBe(403);
    expect(voidCalls.length).toBe(0);
  });

  it('assistant create draft still allowed (create permission)', async () => {
    createCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/instances`, {
      method: 'POST',
      headers: headers(['assistant']),
      body: JSON.stringify({ patientId: randomUUID(), versionId: randomUUID() }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(createCalls.length).toBe(1);
  });

  it('frozen clinical staff sign/void matrix: allowed vs denied roles', async () => {
    const allowed = ['doctor', 'dentist', 'specialist', 'nurse'];
    const denied = [
      'receptionist',
      'assistant',
      'branch_manager',
      'general_manager',
      'owner',
      'super_admin',
      'accountant',
    ];
    for (const role of allowed) {
      signCalls.length = 0;
      voidCalls.length = 0;
      const signRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ method: 'STAFF_WITNESSED' }),
      });
      const voidRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ reason: 'Patient withdrew' }),
      });
      expect(signRes.status).toBeGreaterThanOrEqual(200);
      expect(signRes.status).toBeLessThan(300);
      expect(voidRes.status).toBeGreaterThanOrEqual(200);
      expect(voidRes.status).toBeLessThan(300);
      expect(signCalls.length).toBe(1);
      expect(voidCalls.length).toBe(1);
    }
    for (const role of denied) {
      signCalls.length = 0;
      voidCalls.length = 0;
      const signRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ method: 'STAFF_WITNESSED' }),
      });
      const voidRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ reason: 'Patient withdrew' }),
      });
      expect(signRes.status).toBe(403);
      expect(voidRes.status).toBe(403);
      expect(signCalls.length).toBe(0);
      expect(voidCalls.length).toBe(0);
    }
  });

  it('custom-role approve cannot bypass frozen sign/void contract', async () => {
    const denied = [
      'receptionist',
      'assistant',
      'branch_manager',
      'general_manager',
      'owner',
      'super_admin',
    ];
    customRoleRows = [
      {
        customRole: {
          isArchived: false,
          permissions: { 'api.clinical-forms': ['approve'] },
        },
      },
    ];
    for (const role of denied) {
      signCalls.length = 0;
      voidCalls.length = 0;
      const signRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ method: 'STAFF_WITNESSED' }),
      });
      const voidRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ reason: 'Patient withdrew' }),
      });
      expect(signRes.status).toBe(403);
      expect(voidRes.status).toBe(403);
      expect(signCalls.length).toBe(0);
      expect(voidCalls.length).toBe(0);
    }
    customRoleRows = [];
  });

  it('doctor and nurse remain allowed without custom grants', async () => {
    customRoleRows = [];
    for (const role of ['doctor', 'nurse']) {
      signCalls.length = 0;
      voidCalls.length = 0;
      const signRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ method: 'STAFF_WITNESSED' }),
      });
      const voidRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
        method: 'POST',
        headers: headers([role]),
        body: JSON.stringify({ reason: 'Patient withdrew' }),
      });
      expect(signRes.status).toBeGreaterThanOrEqual(200);
      expect(signRes.status).toBeLessThan(300);
      expect(voidRes.status).toBeGreaterThanOrEqual(200);
      expect(voidRes.status).toBeLessThan(300);
      expect(signCalls.length).toBe(1);
      expect(voidCalls.length).toBe(1);
    }
  });

  it('unrelated custom-role grant still works for create', async () => {
    customRoleRows = [
      {
        customRole: {
          isArchived: false,
          permissions: { 'api.clinical-forms': ['create'] },
        },
      },
    ];
    createCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/instances`, {
      method: 'POST',
      headers: headers(['accountant']),
      body: JSON.stringify({ patientId: randomUUID(), versionId: randomUUID() }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(createCalls.length).toBe(1);
    customRoleRows = [];
  });

  it('unrelated super_admin bypass still works for view (not approve)', async () => {
    customRoleRows = [];
    const res = await fetch(`${baseUrl}/clinical-forms/templates`, {
      headers: headers(['super_admin']),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });

  it('unauthenticated sign/void -> 401 and no mutation', async () => {
    signCalls.length = 0;
    voidCalls.length = 0;
    const signRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/sign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'STAFF_WITNESSED' }),
    });
    const voidRes = await fetch(`${baseUrl}/clinical-forms/instances/${randomUUID()}/void`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Patient withdrew' }),
    });
    expect(signRes.status).toBe(401);
    expect(voidRes.status).toBe(401);
    expect(signCalls.length).toBe(0);
    expect(voidCalls.length).toBe(0);
  });

  it('requirements malformed clinicalServiceId -> 400', async () => {
    upsertCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/requirements`, {
      method: 'PUT',
      headers: headers(['owner']),
      body: JSON.stringify({ clinicalServiceId: 'bad', formKind: 'CONSENT' }),
    });
    expect(res.status).toBe(400);
    expect(upsertCalls.length).toBe(0);
  });

  it('requirements invalid formKind -> 400', async () => {
    upsertCalls.length = 0;
    const res = await fetch(`${baseUrl}/clinical-forms/requirements`, {
      method: 'PUT',
      headers: headers(['owner']),
      body: JSON.stringify({ clinicalServiceId: randomUUID(), formKind: 'NOT_A_KIND' }),
    });
    expect(res.status).toBe(400);
    expect(upsertCalls.length).toBe(0);
  });
});
