#!/usr/bin/env node
/**
 * Ensures at least one PUBLISHED Plan Version exists for Step 16 suites.
 * Product seed only creates Draft commercial definitions; tests promote one Draft.
 */
import { createHash, randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

process.env.INTEGRATION_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';
process.env.DATABASE_URL = process.env.INTEGRATION_DATABASE_URL;

function run(args) {
  const result = spawnSync('npx', args, {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed: npx ${args.join(' ')}`);
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.INTEGRATION_DATABASE_URL } },
});

try {
  await prisma.$connect();
  const dash = await prisma.healthcareCatalogItem.findUnique({
    where: { canonicalKey: 'module.dashboard' },
  });
  if (!dash) {
    run([
      'ts-node',
      '--transpile-only',
      'src/modules/platform-healthcare-catalog/seed/run-healthcare-catalog-seed.ts',
    ]);
  }
  run([
    'ts-node',
    '--transpile-only',
    'src/modules/platform-plans/seed/run-platform-plans-seed.ts',
  ]);

  let published = await prisma.platformPlanVersion.count({
    where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },
  });
  if (published < 1) {
    const draft = await prisma.platformPlanVersion.findFirst({
      where: { lifecycle: 'DRAFT', plan: { canonicalKey: { not: 'plan.business' } } },
      include: { plan: true, entitlements: true, limits: true },
    });
    if (!draft) throw new Error('No Draft Plan Version available to publish for fixtures.');
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          plan: draft.plan.canonicalKey,
          entitlements: draft.entitlements.map((e) => e.catalogItemId).sort(),
          limits: draft.limits
            .map((l) => `${l.catalogItemId}:${l.valueText}:${l.unlimited}`)
            .sort(),
        }),
      )
      .digest('hex');
    await prisma.platformPlanVersion.update({
      where: { id: draft.id },
      data: {
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByPlatformUserId: randomUUID(),
        publicationFingerprint: fingerprint,
        publicationReason: 'step16_test_fixture_publish',
      },
    });
  }
  published = await prisma.platformPlanVersion.count({
    where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },
  });
  console.log(JSON.stringify({ ok: true, publishedPlanVersions: published }));
  if (published < 1) throw new Error('No published Plan Versions after fixture publish.');
} finally {
  await prisma.$disconnect();
}
