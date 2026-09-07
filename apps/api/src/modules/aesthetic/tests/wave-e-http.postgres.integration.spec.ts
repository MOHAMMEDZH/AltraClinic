/**
 * Wave E HTTP DTO/permission — malformed input must 400 before service.
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
import { AestheticWaveEController } from '../api/aesthetic-wave-e.controller';
import { TreatmentCourseService } from '../services/treatment-course.service';
import { DeviceTreatmentRecordService } from '../services/device-treatment-record.service';
import { DermatologyEncounterService } from '../services/dermatology-encounter.service';
import { PrePostCareService } from '../services/pre-post-care.service';
import { LicensedModuleGuard } from '../../subscription/api/guards/licensed-module.guard';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { platformDbSecurityEnabled } from '../../auth/tests/platform-db-security.harness';

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

describeDb('Wave E HTTP DTO/permission (Nest runtime)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tenantId: string;
  let actorId: string;
  const courseCalls: unknown[] = [];
  const deviceCalls: unknown[] = [];
  const dermCalls: unknown[] = [];

  beforeAll(async () => {
    tenantId = randomUUID();
    actorId = randomUUID();
    const moduleRef = await Test.createTestingModule({
      controllers: [AestheticWaveEController],
      providers: [
        PermissionGuard,
        { provide: APP_GUARD, useClass: TestClinicAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: PrismaService, useValue: { userCustomRole: { findMany: async () => [] } } },
        { provide: LicensedModuleGuard, useValue: { canActivate: () => true } },
        {
          provide: TreatmentCourseService,
          useValue: {
            create: async (input: unknown) => {
              courseCalls.push(input);
              return { id: randomUUID(), sessions: [] };
            },
            get: async () => ({ id: randomUUID() }),
            transition: async () => ({ status: 'ACTIVE' }),
            linkSessionAppointment: async () => ({ status: 'BOOKED' }),
            transitionSession: async () => ({ status: 'COMPLETED' }),
          },
        },
        {
          provide: DeviceTreatmentRecordService,
          useValue: {
            create: async (input: unknown) => {
              deviceCalls.push(input);
              return { id: randomUUID() };
            },
            get: async () => ({ id: randomUUID() }),
            correct: async (input: unknown) => {
              deviceCalls.push({ correct: input });
              return { id: randomUUID() };
            },
          },
        },
        {
          provide: DermatologyEncounterService,
          useValue: {
            openDermatologyEncounter: async (input: unknown) => {
              dermCalls.push(input);
              return { id: randomUUID() };
            },
            get: async () => ({ id: randomUUID() }),
            assertNoDermatologyRecordModel: () => ({ dermatologyRecordModel: false }),
          },
        },
        {
          provide: PrePostCareService,
          useValue: {
            listSupportedKinds: () => ['PRE_CARE', 'POST_CARE'],
            assertInstanceKind: async () => ({ id: randomUUID(), kind: 'PRE_CARE' }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  function headers(roles: string[]) {
    return {
      'content-type': 'application/json',
      'x-test-principal': JSON.stringify({ sub: actorId, tenantId, roles }),
    };
  }

  it('malformed patientId returns 400 and does not call course service', async () => {
    courseCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/treatment-courses`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId: 'not-a-uuid',
        clinicalServiceId: randomUUID(),
        plannedSessions: 3,
      }),
    });
    expect(res.status).toBe(400);
    expect(courseCalls).toHaveLength(0);
  });

  it('doctor can create a treatment course (permission allow)', async () => {
    courseCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/treatment-courses`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId: randomUUID(),
        clinicalServiceId: randomUUID(),
        plannedSessions: 3,
      }),
    });
    expect([200, 201]).toContain(res.status);
    expect(courseCalls).toHaveLength(1);
  });

  it('receptionist cannot create a treatment course', async () => {
    courseCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/treatment-courses`, {
      method: 'POST',
      headers: headers(['receptionist']),
      body: JSON.stringify({
        patientId: randomUUID(),
        clinicalServiceId: randomUUID(),
        plannedSessions: 2,
      }),
    });
    expect(res.status).toBe(403);
    expect(courseCalls).toHaveLength(0);
  });

  it('malformed device-treatment body returns 400 and does not call service', async () => {
    deviceCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        clinicalServiceId: 'bad',
        parameterSchemaKey: 'laser.generic.v1',
        patientId: randomUUID(),
        providerId: randomUUID(),
      }),
    });
    expect(res.status).toBe(400);
    expect(deviceCalls).toHaveLength(0);
  });

  it('doctor can create a device treatment (permission allow)', async () => {
    deviceCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        clinicalServiceId: randomUUID(),
        parameterSchemaKey: 'laser.generic.v1',
        patientId: randomUUID(),
        providerId: randomUUID(),
      }),
    });
    expect([200, 201]).toContain(res.status);
    expect(deviceCalls).toHaveLength(1);
  });

  it('R2-B3-T1: opaque deviceId EXT-DEVICE-001 passes DTO validation', async () => {
    deviceCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: 'EXT-DEVICE-001',
        clinicalServiceId: randomUUID(),
        parameterSchemaKey: 'laser.generic.v1',
        patientId: randomUUID(),
        providerId: randomUUID(),
      }),
    });
    expect([200, 201]).toContain(res.status);
    expect(deviceCalls).toHaveLength(1);
    expect((deviceCalls[0] as { deviceId?: string }).deviceId).toBe('EXT-DEVICE-001');
  });

  it('R2-B3-T2: deviceId >120 chars returns 400', async () => {
    deviceCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: 'X'.repeat(121),
        clinicalServiceId: randomUUID(),
        parameterSchemaKey: 'laser.generic.v1',
        patientId: randomUUID(),
        providerId: randomUUID(),
      }),
    });
    expect(res.status).toBe(400);
    expect(deviceCalls).toHaveLength(0);
  });

  it('R2-B3-T3: whitespace-only deviceId returns 400', async () => {
    deviceCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        deviceType: 'laser',
        deviceId: '   ',
        clinicalServiceId: randomUUID(),
        parameterSchemaKey: 'laser.generic.v1',
        patientId: randomUUID(),
        providerId: randomUUID(),
      }),
    });
    expect(res.status).toBe(400);
    expect(deviceCalls).toHaveLength(0);
  });

  it('R2-B3-T4: correction DTO does not require UUID deviceId (payload+reason only)', async () => {
    deviceCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments/${randomUUID()}/corrections`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({ parameterPayload: { joules: 12 }, reason: 'parameter adjust' }),
    });
    expect([200, 201]).toContain(res.status);
    expect(deviceCalls.some((c) => typeof c === 'object' && c !== null && 'correct' in (c as object))).toBe(
      true,
    );
  });

  it('nurse cannot manage device corrections', async () => {
    deviceCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/device-treatments/${randomUUID()}/corrections`, {
      method: 'POST',
      headers: headers(['nurse']),
      body: JSON.stringify({ parameterPayload: { x: 1 }, reason: 'adjust' }),
    });
    expect(res.status).toBe(403);
    expect(deviceCalls).toHaveLength(0);
  });

  it('malformed dermatology encounter returns 400', async () => {
    dermCalls.length = 0;
    const res = await fetch(`${baseUrl}/aesthetic/dermatology/encounters`, {
      method: 'POST',
      headers: headers(['doctor']),
      body: JSON.stringify({
        patientId: 'nope',
        clinicianId: randomUUID(),
        clinicalServiceId: randomUUID(),
      }),
    });
    expect(res.status).toBe(400);
    expect(dermCalls).toHaveLength(0);
  });

  it('pre-post-care kinds endpoint returns PRE_CARE and POST_CARE', async () => {
    const res = await fetch(`${baseUrl}/aesthetic/pre-post-care/kinds`, {
      method: 'GET',
      headers: headers(['nurse']),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kinds: string[] };
    expect(body.kinds).toEqual(['PRE_CARE', 'POST_CARE']);
  });

  it('no-dermatology-record endpoint returns dermatologyRecordModel false', async () => {
    const res = await fetch(`${baseUrl}/aesthetic/dermatology/no-dermatology-record`, {
      method: 'GET',
      headers: headers(['doctor']),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dermatologyRecordModel: boolean };
    expect(body.dermatologyRecordModel).toBe(false);
  });
});
