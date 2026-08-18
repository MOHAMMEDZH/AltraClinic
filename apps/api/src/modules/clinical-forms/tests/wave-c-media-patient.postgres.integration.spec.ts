/**
 * Wave C Round 5 H5 — protected media patient tenant ownership on the upload handler.
 */
import { randomUUID } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import {
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  assertSafePlatformTestDatabaseUrl,
} from '../../auth/tests/platform-db-security.harness';
import { UploadMediaHandler } from '../../media/application/handlers/upload-media.handler';
import { MediaAsset } from '../../media/domain/entities/media-asset.entity';

const describeIf = platformDbSecurityEnabled() ? describe : describe.skip;

describeIf('Wave C media patient tenant ownership (postgres)', () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const patientA = randomUUID();
  const patientB = randomUUID();
  const invoiceA = randomUUID();
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  let saved: MediaAsset[];
  let handler: UploadMediaHandler;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: 'WC Media A', slug: `wc-med-a-${tenantA.slice(0, 8)}` },
        { id: tenantB, name: 'WC Media B', slug: `wc-med-b-${tenantB.slice(0, 8)}` },
      ],
    });
    await prisma.patient.createMany({
      data: [
        { id: patientA, tenantId: tenantA, firstName: 'Med', lastName: 'A', phone: `+1${tenantA.slice(0, 10)}` },
        { id: patientB, tenantId: tenantB, firstName: 'Med', lastName: 'B', phone: `+1${tenantB.slice(0, 10)}` },
      ],
    });
    await prisma.invoice.create({
      data: {
        id: invoiceA,
        tenantId: tenantA,
        patientId: patientA,
        invoiceNumber: `INV-${invoiceA.slice(0, 8)}`,
        invoiceDate: new Date(),
      },
    });

    saved = [];
    handler = new UploadMediaHandler(
      {
        save: async (asset: MediaAsset) => {
          saved.push(asset);
          return asset;
        },
      } as never,
      { resolve: async () => ({ tenantId: tenantA, branchId: null }) } as never,
      prisma as never,
      { publish: async () => undefined } as never,
      {
        execute: async ({ asset }: { asset: MediaAsset }) => ({ asset, bytesAdded: 0 }),
      } as never,
      { enforceStorageLimit: async () => undefined } as never,
    );
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      await prisma.invoice.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => undefined);
      await prisma.patient.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => undefined);
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } }).catch(() => undefined);
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  function jpegCmd(patientId: string | null, category = 'dental_image') {
    return {
      category,
      ownerType: 'patient',
      ownerId: patientId ?? randomUUID(),
      patientId,
      originalFilename: 'x.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      uploadedBy: randomUUID(),
    };
  }

  it('protected category + same-tenant patient -> persists', async () => {
    saved.length = 0;
    const result = await handler.execute(jpegCmd(patientA));
    expect(result.mediaId).toBeTruthy();
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0].patientId).toBe(patientA);
    expect(saved[0].requiresPhotoConsent).toBe(true);
  });

  it('protected category + Tenant B patient -> reject, no MediaAsset saved', async () => {
    saved.length = 0;
    await expect(handler.execute(jpegCmd(patientB))).rejects.toBeInstanceOf(NotFoundException);
    expect(saved.length).toBe(0);
  });

  it('protected category + unknown patient -> reject, no MediaAsset saved', async () => {
    saved.length = 0;
    await expect(handler.execute(jpegCmd(randomUUID()))).rejects.toBeInstanceOf(NotFoundException);
    expect(saved.length).toBe(0);
  });

  it('non-protected invoice_attachment without patient still succeeds', async () => {
    saved.length = 0;
    const result = await handler.execute({
      category: 'invoice_attachment',
      ownerType: 'invoice',
      ownerId: invoiceA,
      patientId: null,
      originalFilename: 'x.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      uploadedBy: randomUUID(),
    });
    expect(result.mediaId).toBeTruthy();
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0].requiresPhotoConsent).toBe(false);
  });
});
