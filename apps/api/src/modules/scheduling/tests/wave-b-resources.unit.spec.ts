/**
 * Wave B — Service resource requirements B-RES-01..08
 */
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';

jest.setTimeout(120_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave B resource requirements B-RES-01..08 (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let resources: ServiceResourceRequirementService;
  let concurrency: BookingConcurrencyService;
  let tenantId: string;
  let clinicalServiceId: string;
  let roomId: string;
  let room2Id: string;
  let equipmentId: string;
  let otherTenantResourceId: string;
  let otherTenantId: string;
  let branchId: string;
  let otherBranchId: string;
  let patientId: string;
  let providerId: string;

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    resources = new ServiceResourceRequirementService(wrapper as never, {
      async record() {},
      async recordInTransaction() {},
    } as never);
    concurrency = new BookingConcurrencyService(wrapper as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    clinicalServiceId = randomUUID();
    roomId = randomUUID();
    room2Id = randomUUID();
    equipmentId = randomUUID();
    otherTenantResourceId = randomUUID();
    branchId = randomUUID();
    otherBranchId = randomUUID();
    patientId = randomUUID();
    providerId = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: { id: tenantId, name: 'WB Res', slug: `wb-res-${tenantId.slice(0, 8)}` },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WB Res Other',
          slug: `wb-res-o-${otherTenantId.slice(0, 8)}`,
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.branch.create({ data: { id: otherBranchId, tenantId, name: 'Other' } });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'R', lastName: 'S' },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.res_${clinicalServiceId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: [{ locale: 'en', displayName: 'Proc' }] },
        },
      });
      await c.schedulingResource.createMany({
        data: [
          {
            id: roomId,
            tenantId,
            branchId,
            name: 'Room 1',
            resourceType: 'ROOM',
            isActive: true,
          },
          {
            id: room2Id,
            tenantId,
            branchId,
            name: 'Room 2',
            resourceType: 'ROOM',
            isActive: true,
          },
          {
            id: equipmentId,
            tenantId,
            branchId,
            name: 'Equip 1',
            resourceType: 'EQUIPMENT',
            isActive: true,
          },
          {
            id: otherTenantResourceId,
            tenantId: otherTenantId,
            name: 'Foreign',
            resourceType: 'ROOM',
            isActive: true,
          },
        ],
      });
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.appointment.deleteMany({ where: { tenantId } });
      await c.serviceResourceRequirement.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.schedulingResource.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId } });
      await c.canonicalClinicalServiceDefinition.deleteMany({ where: { id: clinicalServiceId } });
      await c.patient.deleteMany({ where: { id: patientId } });
      await c.branch.deleteMany({ where: { id: { in: [branchId, otherBranchId] } } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  it('B-RES-01 — missing required resource denied', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: randomUUID(),
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId,
        allocatedResourceIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('B-RES-02 — wrong type denied', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: randomUUID(),
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId,
        allocatedResourceIds: [equipmentId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('B-RES-03 — wrong tenant denied', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: randomUUID(),
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId,
        allocatedResourceIds: [otherTenantResourceId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('B-RES-04 — wrong branch denied where applicable', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: randomUUID(),
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId: otherBranchId,
        allocatedResourceIds: [roomId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('B-RES-05 — quantity satisfied allowed', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 1,
      actorId: randomUUID(),
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId,
        allocatedResourceIds: [roomId],
      }),
    ).resolves.toBeUndefined();
  });

  it('B-RES-06 — insufficient quantity denied', async () => {
    await resources.upsertRequirement({
      tenantId,
      clinicalServiceId,
      resourceType: 'ROOM',
      quantity: 2,
      actorId: randomUUID(),
    });
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId,
        allocatedResourceIds: [roomId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      resources.assertRequirementsSatisfied({
        tenantId,
        clinicalServiceId,
        branchId,
        allocatedResourceIds: [roomId, room2Id],
      }),
    ).resolves.toBeUndefined();
  });

  it('B-RES-07 — every allocated resource included in lock keys', () => {
    const keys = concurrency.buildLockKeys({
      tenantId,
      providerId,
      resourceIds: [room2Id, roomId],
    });
    expect(keys).toContain(`booking:resource:${tenantId}:${roomId}`);
    expect(keys).toContain(`booking:resource:${tenantId}:${room2Id}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('B-RES-08 — same exclusive resource race = one success', async () => {
    const start = new Date('2026-09-20T10:00:00.000Z');
    const end = new Date('2026-09-20T10:30:00.000Z');
    const p2 = randomUUID();
    const book = async (pid: string) => {
      const id = randomUUID();
      await concurrency.withBookingTransaction(async (client) => {
        await concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId: pid,
          resourceIds: [roomId],
          start,
          end,
        });
        await client.appointment.create({
          data: {
            id,
            tenantId,
            patientId,
            providerId: pid,
            scheduledStart: start,
            scheduledEnd: end,
            status: 'PENDING',
            resourceId: roomId,
          },
        });
      });
      return id;
    };
    const settled = await Promise.allSettled([book(providerId), book(p2)]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);
  });
});
