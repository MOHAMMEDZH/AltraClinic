/**
 * Wave C Round 6 H4 — Media ownerType/ownerId semantic integrity.
 */
import { randomUUID } from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { UploadMediaHandler } from '../../media/application/handlers/upload-media.handler';
import { MediaAsset } from '../../media/domain/entities/media-asset.entity';
import { assertMediaOwnerReference } from '../../media/services/media-owner-reference.validation';

const describeIf = platformDbSecurityEnabled() ? describe : describe.skip;

describeIf('Wave C media owner reference integrity (postgres)', () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const patientA = randomUUID();
  const patientB = randomUUID();
  const patientA2 = randomUUID();
  const encounterA = randomUUID();
  const appointmentA = randomUUID();
  const beautyRecordA = randomUUID();
  const invoiceA = randomUUID();
  const invoiceB = randomUUID();
  const invoiceDeleted = randomUUID();
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  let saved: MediaAsset[];
  let handler: UploadMediaHandler;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: 'Owner A', slug: `own-a-${tenantA.slice(0, 8)}` },
        { id: tenantB, name: 'Owner B', slug: `own-b-${tenantB.slice(0, 8)}` },
      ],
    });
    await prisma.patient.createMany({
      data: [
        { id: patientA, tenantId: tenantA, firstName: 'Own', lastName: 'A', phone: `+1${tenantA.slice(0, 10)}` },
        { id: patientA2, tenantId: tenantA, firstName: 'Own', lastName: 'A2', phone: `+1${tenantA.slice(1, 11)}` },
        { id: patientB, tenantId: tenantB, firstName: 'Own', lastName: 'B', phone: `+1${tenantB.slice(0, 10)}` },
      ],
    });
    await prisma.beautyRecord.create({
      data: { id: beautyRecordA, tenantId: tenantA, patientId: patientA, bodyMapState: {} },
    });
    const providerId = randomUUID();
    const branchId = randomUUID();
    await prisma.user.create({
      data: {
        id: providerId,
        tenantId: tenantA,
        email: `own-prov-${providerId.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'P',
        lastName: 'Rov',
      },
    });
    await prisma.branch.create({ data: { id: branchId, tenantId: tenantA, name: 'Owner Branch' } });
    const start = new Date(Date.now() + 3600_000);
    await prisma.appointment.create({
      data: {
        id: appointmentA,
        tenantId: tenantA,
        branchId,
        patientId: patientA,
        providerId,
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + 1800_000),
      },
    });
    await prisma.encounter.create({
      data: {
        id: encounterA,
        tenantId: tenantA,
        patientId: patientA,
        clinicianId: providerId,
      },
    });
    await prisma.invoice.createMany({
      data: [
        {
          id: invoiceA,
          tenantId: tenantA,
          patientId: patientA,
          invoiceNumber: `INV-${invoiceA.slice(0, 8)}`,
          invoiceDate: new Date(),
        },
        {
          id: invoiceB,
          tenantId: tenantB,
          patientId: patientB,
          invoiceNumber: `INV-${invoiceB.slice(0, 8)}`,
          invoiceDate: new Date(),
        },
        {
          id: invoiceDeleted,
          tenantId: tenantA,
          patientId: patientA,
          invoiceNumber: `INV-${invoiceDeleted.slice(0, 8)}`,
          invoiceDate: new Date(),
          deletedAt: new Date(),
        },
      ],
    });

    saved = [];
    handler = new UploadMediaHandler(
      { save: async (asset: MediaAsset) => { saved.push(asset); return asset; } } as never,
      { resolve: async () => ({ tenantId: tenantA, branchId: null }) } as never,
      prisma as never,
      { publish: async () => undefined } as never,
      { execute: async ({ asset }: { asset: MediaAsset }) => ({ asset, bytesAdded: 0 }) } as never,
      { enforceStorageLimit: async () => undefined } as never,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

  it('ownerType patient + matching patientId succeeds via handler', async () => {
    saved.length = 0;
    await handler.execute({
      category: 'dental_image',
      ownerType: 'patient',
      ownerId: patientA,
      patientId: patientA,
      originalFilename: 'x.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('jpeg'),
      uploadedBy: randomUUID(),
    });
    expect(saved.length).toBeGreaterThan(0);
  });

  it('ownerType patient cross-tenant ownerId rejects with no MediaAsset', async () => {
    saved.length = 0;
    await expect(
      assertMediaOwnerReference(prisma as never, tenantA, 'patient', patientB, { patientId: patientB }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saved.length).toBe(0);
  });

  it('ownerType patient ownerId != patientId rejects', async () => {
    await expect(
      assertMediaOwnerReference(prisma as never, tenantA, 'patient', patientA, {
        patientId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ownerType encounter same tenant + patient match succeeds', async () => {
    await expect(
      assertMediaOwnerReference(prisma as never, tenantA, 'encounter', encounterA, {
        patientId: patientA,
        encounterId: encounterA,
      }),
    ).resolves.toBeUndefined();
  });

  it('ownerType encounter patient mismatch rejects', async () => {
    await expect(
      assertMediaOwnerReference(prisma as never, tenantA, 'encounter', encounterA, {
        patientId: patientB,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ownerType appointment same tenant succeeds', async () => {
    await expect(
      assertMediaOwnerReference(prisma as never, tenantA, 'appointment', appointmentA, {
        patientId: patientA,
      }),
    ).resolves.toBeUndefined();
  });

  it('unknown ownerType rejects', async () => {
    await expect(
      assertMediaOwnerReference(prisma as never, tenantA, 'unknown_owner', randomUUID(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ownerType invoice same-tenant matching patientId succeeds', async () => {
    saved.length = 0;
    await handler.execute({
      category: 'invoice_attachment',
      ownerType: 'invoice',
      ownerId: invoiceA,
      patientId: patientA,
      originalFilename: 'inv.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      uploadedBy: randomUUID(),
    });
    expect(saved.length).toBeGreaterThan(0);
  });

  it('ownerType invoice same-tenant mismatched patientId rejects with no MediaAsset', async () => {
    saved.length = 0;
    await expect(
      handler.execute({
        category: 'invoice_attachment',
        ownerType: 'invoice',
        ownerId: invoiceA,
        patientId: patientA2,
        originalFilename: 'inv.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        uploadedBy: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saved.length).toBe(0);
  });

  it('ownerType invoice cross-tenant rejects with no MediaAsset', async () => {
    saved.length = 0;
    await expect(
      handler.execute({
        category: 'invoice_attachment',
        ownerType: 'invoice',
        ownerId: invoiceB,
        patientId: patientB,
        originalFilename: 'inv.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        uploadedBy: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saved.length).toBe(0);
  });

  it('ownerType invoice soft-deleted same-tenant rejects with no MediaAsset', async () => {
    saved.length = 0;
    await expect(
      handler.execute({
        category: 'invoice_attachment',
        ownerType: 'invoice',
        ownerId: invoiceDeleted,
        patientId: patientA,
        originalFilename: 'inv.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        uploadedBy: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saved.length).toBe(0);
  });

  it('ownerType invoice nonexistent rejects with no MediaAsset', async () => {
    saved.length = 0;
    await expect(
      handler.execute({
        category: 'invoice_attachment',
        ownerType: 'invoice',
        ownerId: randomUUID(),
        patientId: patientA,
        originalFilename: 'inv.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        uploadedBy: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saved.length).toBe(0);
  });
});
