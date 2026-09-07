/**
 * Wave D HTTP DTO/permission — malformed input must 400 before service.
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
import { TreatmentPlanLinksController } from '../api/treatment-plan-links.controller';
import { DentalLabCasesController } from '../api/dental-lab-cases.controller';
import { ServicePerformanceController } from '../../service-performance/api/service-performance.controller';
import { TreatmentPlanAppointmentLinkService } from '../services/treatment-plan-appointment-link.service';
import { DentalLabCaseService } from '../services/dental-lab-case.service';
import { ServicePerformanceService } from '../../service-performance/services/service-performance.service';
import { LicensedModuleGuard } from '../../subscription/api/guards/licensed-module.guard';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { platformDbSecurityEnabled } from '../../auth/tests/platform-db-security.harness';

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

describeDb('Wave D HTTP DTO/permission (Nest runtime)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tenantId: string;
  let actorId: string;
  let planId: string;
  let itemId: string;
  const linkCalls: unknown[] = [];
  const labCalls: unknown[] = [];
  const perfCalls: unknown[] = [];

  beforeAll(async () => {
    tenantId = randomUUID();
    actorId = randomUUID();
    planId = randomUUID();
    itemId = randomUUID();
    const moduleRef = await Test.createTestingModule({
      controllers: [
        TreatmentPlanLinksController,
        DentalLabCasesController,
        ServicePerformanceController,
      ],
      providers: [
        PermissionGuard,
        { provide: APP_GUARD, useClass: TestClinicAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: PrismaService, useValue: { userCustomRole: { findMany: async () => [] } } },
        { provide: LicensedModuleGuard, useValue: { canActivate: () => true } },
        {
          provide: TreatmentPlanAppointmentLinkService,
          useValue: {
            link: async (input: unknown) => {
              linkCalls.push(input);
              return { id: randomUUID() };
            },
            listForItem: async () => [],
            unlink: async () => ({ ok: true }),
            completeFromAppointment: async () => ({ status: 'COMPLETED' }),
          },
        },
        {
          provide: DentalLabCaseService,
          useValue: {
            create: async (input: unknown) => {
              labCalls.push(input);
              return { id: randomUUID() };
            },
            list: async () => [],
            get: async () => ({ id: randomUUID() }),
            transition: async () => ({ status: 'SENT' }),
            attachMedia: async () => ({ id: randomUUID() }),
          },
        },
        {
          provide: ServicePerformanceService,
          useValue: {
            create: async (input: unknown) => {
              perfCalls.push(input);
              return { id: randomUUID() };
            },
            get: async () => ({ id: randomUUID() }),
            complete: async () => ({ status: 'COMPLETED' }),
            correct: async () => ({ id: randomUUID() }),
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

  it('malformed appointmentId returns 400 and does not call link service', async () => {
    linkCalls.length = 0;
    const res = await fetch(
      `${baseUrl}/dental/treatment-plans/${planId}/items/${itemId}/appointments`,
      {
        method: 'POST',
        headers: headers(['dentist']),
        body: JSON.stringify({ appointmentId: 'not-a-uuid' }),
      },
    );
    expect(res.status).toBe(400);
    expect(linkCalls).toHaveLength(0);
  });

  it('receptionist can create a plan link (permission allow)', async () => {
    linkCalls.length = 0;
    const res = await fetch(
      `${baseUrl}/dental/treatment-plans/${planId}/items/${itemId}/appointments`,
      {
        method: 'POST',
        headers: headers(['receptionist']),
        body: JSON.stringify({ appointmentId: randomUUID(), linkRole: 'PRIMARY' }),
      },
    );
    expect([200, 201]).toContain(res.status);
    expect(linkCalls).toHaveLength(1);
  });

  it('receptionist cannot create a lab case', async () => {
    labCalls.length = 0;
    const res = await fetch(`${baseUrl}/dental/lab-cases`, {
      method: 'POST',
      headers: headers(['receptionist']),
      body: JSON.stringify({
        patientId: randomUUID(),
        providerId: randomUUID(),
        labVendor: 'Acme',
        caseType: 'CROWN',
      }),
    });
    expect(res.status).toBe(403);
    expect(labCalls).toHaveLength(0);
  });

  it('malformed service-performance body returns 400 and does not call service', async () => {
    perfCalls.length = 0;
    const res = await fetch(`${baseUrl}/service-performances`, {
      method: 'POST',
      headers: headers(['dentist']),
      body: JSON.stringify({ clinicalServiceId: 'bad', performedAt: 'nope', participants: [] }),
    });
    expect(res.status).toBe(400);
    expect(perfCalls).toHaveLength(0);
  });
});
