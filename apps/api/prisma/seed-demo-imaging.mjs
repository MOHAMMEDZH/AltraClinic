/**
 * Seeds demo dental imaging assets with synthetic X-ray / panoramic / CBCT slices.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

const STORAGE_BASE = process.env.MEDIA_STORAGE_PATH ?? './storage/media';

function storagePath(tenantId, assetId, variant, ext) {
  return join(STORAGE_BASE, tenantId, assetId, `${variant}.${ext}`);
}

async function writeBuffer(keyPath, buffer) {
  await mkdir(dirname(keyPath), { recursive: true });
  await writeFile(keyPath, buffer);
}

function buildGrayscaleBuffer(width, height, paint) {
  const raw = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      raw[y * width + x] = Math.max(0, Math.min(255, Math.round(paint(x, y, width, height))));
    }
  }
  return raw;
}

async function makeXrayLike(width, height) {
  const raw = buildGrayscaleBuffer(width, height, (x, y, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const jaw = Math.hypot(x - cx, (y - cy) * 0.7) < w * 0.34;
    const noise = Math.random() * 28;
    return jaw ? 95 + noise + Math.sin(x * 0.08) * 12 : 18 + noise * 0.4;
  });
  return sharp(raw, { raw: { width, height, channels: 1 } }).jpeg({ quality: 88 }).toBuffer();
}

async function makePanoramic(width, height) {
  const raw = buildGrayscaleBuffer(width, height, (x, y, w, h) => {
    const t = x / w;
    const archY = h * 0.45 + Math.sin(t * Math.PI) * h * 0.12;
    const onArch = Math.abs(y - archY) < 18;
    const noise = Math.random() * 22;
    return onArch ? 110 + noise : 25 + noise * 0.5;
  });
  return sharp(raw, { raw: { width, height, channels: 1 } }).jpeg({ quality: 88 }).toBuffer();
}

async function makeIntraoral(width, height, tint = 0) {
  const raw = buildGrayscaleBuffer(width, height, (x, y, w, h) => {
    const toothX = w * (0.35 + tint * 0.15);
    const tooth = Math.hypot(x - toothX, y - h * 0.5) < 42;
    const noise = Math.random() * 18;
    return tooth ? 200 + noise : 40 + noise;
  });
  return sharp(raw, { raw: { width, height, channels: 1 } }).jpeg({ quality: 90 }).toBuffer();
}

async function makeCbctSlice(size, index, total) {
  const t = index / Math.max(1, total - 1);
  const raw = buildGrayscaleBuffer(size, size, (x, y, w) => {
    const cx = w / 2;
    const cy = w / 2;
    const radius = w * (0.18 + t * 0.16);
    const dist = Math.hypot(x - cx, y - cy);
    const inBone = dist > radius - 8 && dist < radius + 10;
    const noise = Math.random() * 20;
    return inBone ? 150 + noise : 35 + noise * 0.6;
  });
  return sharp(raw, { raw: { width: size, height: size, channels: 1 } }).jpeg({ quality: 82 }).toBuffer();
}

async function makeThumbnail(buffer) {
  return sharp(buffer).resize(240, 180, { fit: 'inside' }).webp({ quality: 72 }).toBuffer();
}

async function makeWebp(buffer) {
  return sharp(buffer).webp({ quality: 80 }).toBuffer();
}

async function persistImageAsset(prisma, {
  id,
  tenantId,
  branchId,
  patientId,
  ownerType,
  ownerId,
  uploadedBy,
  filename,
  imagingType,
  title,
  toothNumbers,
  encounterId,
  comparisonGroupId,
  comparisonRole,
  buffer,
  width,
  height,
  extraVariants = [],
  clinicalExtra = {},
}) {
  const originalKey = `${tenantId}/${id}/original.jpg`;
  await writeBuffer(storagePath(tenantId, id, 'original', 'jpg'), buffer);

  const thumb = await makeThumbnail(buffer);
  const webp = await makeWebp(buffer);
  await writeBuffer(storagePath(tenantId, id, 'thumbnail', 'webp'), thumb);
  await writeBuffer(storagePath(tenantId, id, 'webp', 'webp'), webp);
  await writeBuffer(storagePath(tenantId, id, 'compressed', 'jpg'), buffer);

  const variants = [
    { type: 'original', storageKey: originalKey, mimeType: 'image/jpeg', sizeBytes: buffer.length, width, height },
    { type: 'compressed', storageKey: `${tenantId}/${id}/compressed.jpg`, mimeType: 'image/jpeg', sizeBytes: buffer.length, width, height },
    { type: 'thumbnail', storageKey: `${tenantId}/${id}/thumbnail.webp`, mimeType: 'image/webp', sizeBytes: thumb.length, width: 240, height: 180 },
    { type: 'webp', storageKey: `${tenantId}/${id}/webp.webp`, mimeType: 'image/webp', sizeBytes: webp.length, width, height },
    ...extraVariants,
  ];

  await prisma.mediaAsset.upsert({
    where: { id },
    create: {
      id,
      tenantId,
      branchId,
      category: 'DENTAL_IMAGE',
      ownerType,
      ownerId,
      patientId,
      originalFilename: filename,
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(buffer.length),
      status: 'READY',
      virusScanStatus: 'CLEAN',
      storageKey: originalKey,
      variants,
      metadata: {
        format: 'jpeg',
        width,
        height,
        exifStripped: true,
        clinical: {
          imagingType,
          title,
          toothNumbers,
          encounterId,
          ...clinicalExtra,
        },
      },
      comparisonGroupId,
      comparisonRole,
      uploadedBy,
      processedAt: new Date(),
    },
    update: {
      variants,
      metadata: {
        format: 'jpeg',
        width,
        height,
        exifStripped: true,
        clinical: {
          imagingType,
          title,
          toothNumbers,
          encounterId,
          ...clinicalExtra,
        },
      },
      status: 'READY',
      processedAt: new Date(),
    },
  });
}

export async function seedDemoImaging(prisma, {
  tenantId,
  branchId,
  ownerId,
  sarahId,
  omarId,
  encounterSarahId,
}) {
  const comparisonGroupId = 'c1000000-0000-4000-8000-000000000001';
  const cbctId = 'f1000000-0000-4000-8000-000000000010';
  const sliceCount = 32;
  const sliceSize = 256;

  const demoImages = [
    { id: 'f1000000-0000-4000-8000-000000000001', patientId: sarahId, imagingType: 'xray', title: 'Periapical #9 — pre-op', toothNumbers: [9], w: 900, h: 700, factory: makeXrayLike },
    { id: 'f1000000-0000-4000-8000-000000000002', patientId: sarahId, imagingType: 'xray', title: 'Bitewing right', toothNumbers: [2, 3], w: 900, h: 700, factory: makeXrayLike },
    { id: 'f1000000-0000-4000-8000-000000000003', patientId: sarahId, imagingType: 'panoramic', title: 'Panoramic baseline', w: 1400, h: 500, factory: makePanoramic },
    { id: 'f1000000-0000-4000-8000-000000000004', patientId: sarahId, imagingType: 'intraoral', title: 'Occlusal upper', toothNumbers: [8, 9], w: 800, h: 600, factory: () => makeIntraoral(800, 600, 0) },
    { id: 'f1000000-0000-4000-8000-000000000005', patientId: sarahId, imagingType: 'intraoral', title: 'Buccal #24', toothNumbers: [24], w: 800, h: 600, factory: () => makeIntraoral(800, 600, 1) },
    { id: 'f1000000-0000-4000-8000-000000000006', patientId: sarahId, imagingType: 'before', title: 'Whitening — before', comparisonGroupId, comparisonRole: 'BEFORE', w: 800, h: 600, factory: () => makeIntraoral(800, 600, 0) },
    { id: 'f1000000-0000-4000-8000-000000000007', patientId: sarahId, imagingType: 'after', title: 'Whitening — after', comparisonGroupId, comparisonRole: 'AFTER', w: 800, h: 600, factory: () => makeIntraoral(800, 600, 1) },
    { id: 'f1000000-0000-4000-8000-000000000008', patientId: sarahId, imagingType: 'treatment', title: 'Composite #24 post-op', toothNumbers: [24], encounterId: encounterSarahId, w: 900, h: 700, factory: makeXrayLike },
    { id: 'f1000000-0000-4000-8000-000000000009', patientId: omarId, imagingType: 'xray', title: 'Full mouth series — anterior', w: 900, h: 700, factory: makeXrayLike },
  ];

  // Additional library entries for Sarah — exercises virtualized gallery (20+)
  for (let i = 0; i < 14; i++) {
    demoImages.push({
      id: `f1000000-0000-4000-8000-${String(11 + i).padStart(12, '0')}`,
      patientId: sarahId,
      imagingType: i % 3 === 0 ? 'xray' : i % 3 === 1 ? 'intraoral' : 'treatment',
      title: `Archive series ${i + 1} — tooth ${10 + (i % 8)}`,
      toothNumbers: [10 + (i % 8)],
      w: 800,
      h: 600,
      factory: i % 2 === 0 ? makeXrayLike : () => makeIntraoral(800, 600, i % 4),
    });
  }

  for (const img of demoImages) {
    const buffer = await img.factory(img.w, img.h);
    await persistImageAsset(prisma, {
      id: img.id,
      tenantId,
      branchId,
      patientId: img.patientId,
      ownerType: 'patient',
      ownerId: img.patientId,
      uploadedBy: ownerId,
      filename: `${img.title.replace(/\s+/g, '-').toLowerCase()}.jpg`,
      imagingType: img.imagingType,
      title: img.title,
      toothNumbers: img.toothNumbers,
      encounterId: img.encounterId,
      comparisonGroupId: img.comparisonGroupId ?? null,
      comparisonRole: img.comparisonRole ?? null,
      buffer,
      width: img.w,
      height: img.h,
    });
  }

  const sliceVariants = [];
  for (let i = 0; i < sliceCount; i++) {
    const sliceBuf = await makeCbctSlice(sliceSize, i, sliceCount);
    const key = `${tenantId}/${cbctId}/slice-${i}.jpg`;
    await writeBuffer(storagePath(tenantId, cbctId, `slice-${i}`, 'jpg'), sliceBuf);
    sliceVariants.push({
      type: `slice-${i}`,
      storageKey: key,
      mimeType: 'image/jpeg',
      sizeBytes: sliceBuf.length,
      width: sliceSize,
      height: sliceSize,
    });
  }

  const midSlice = await makeCbctSlice(sliceSize, Math.floor(sliceCount / 2), sliceCount);
  await persistImageAsset(prisma, {
    id: cbctId,
    tenantId,
    branchId,
    patientId: sarahId,
    ownerType: 'patient',
    ownerId: sarahId,
    uploadedBy: ownerId,
    filename: 'cbct-maxilla-demo.jpg',
    imagingType: 'cbct',
    title: 'CBCT — maxilla / mandible (demo volume)',
    toothNumbers: [],
    buffer: midSlice,
    width: sliceSize,
    height: sliceSize,
    extraVariants: sliceVariants,
    clinicalExtra: {
      cbct: {
        sliceCount,
        sliceWidth: sliceSize,
        sliceHeight: sliceSize,
        voxelSpacing: { x: 0.3, y: 0.3, z: 0.3 },
        dicomSeriesUid: '1.2.840.demo.cbct.sarah',
      },
    },
  });

  console.log(`Seeded ${demoImages.length + 1} demo imaging assets (${sliceCount} CBCT slices).`);
}
