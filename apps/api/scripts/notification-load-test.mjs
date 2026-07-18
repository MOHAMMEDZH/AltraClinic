/**
 * Notification Center load test — seeds 100k+ rows and benchmarks inbox queries.
 *
 * Usage:
 *   node scripts/notification-load-test.mjs
 *   node scripts/notification-load-test.mjs --count=100000
 *   node scripts/notification-load-test.mjs --benchmark-only
 *   node scripts/notification-load-test.mjs --cleanup
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = join(__dirname, '..', 'notification-load-test-results.json');

export const LOAD_TEST_TENANT_ID = 'a1000000-0000-4000-8000-000000000001';
export const LOAD_TEST_RECIPIENT_ID = 'a1000000-0000-4000-8000-000000000002';
export const LOAD_TEST_MIN_COUNT = 100_000;

const THRESHOLDS_MS = {
  firstPage: 250,
  deepPage: 400,
  search: 600,
  overviewCount: 800,
  unreadCount: 400,
};

function parseArgs(argv) {
  const args = { count: LOAD_TEST_MIN_COUNT, benchmarkOnly: false, cleanup: false, seedOnly: false };
  for (const arg of argv) {
    if (arg === '--benchmark-only') args.benchmarkOnly = true;
    else if (arg === '--cleanup') args.cleanup = true;
    else if (arg === '--seed-only') args.seedOnly = true;
    else if (arg.startsWith('--count=')) args.count = Math.max(1, parseInt(arg.split('=')[1], 10));
  }
  return args;
}

async function countLoadTestRows(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE "tenantId" = ${LOAD_TEST_TENANT_ID}::uuid
      AND "recipientId" = ${LOAD_TEST_RECIPIENT_ID}::uuid
      AND metadata->>'loadTest' = 'true'
  `;
  return rows[0]?.count ?? 0;
}

async function seedLoadTestNotifications(prisma, targetCount) {
  const existing = await countLoadTestRows(prisma);
  if (existing >= targetCount) {
    console.log(`  ✓ Already have ${existing.toLocaleString()} load-test notifications (target ${targetCount.toLocaleString()})`);
    return existing;
  }

  const toInsert = targetCount - existing;
  console.log(`  Seeding ${toInsert.toLocaleString()} load-test notifications…`);
  const batchSize = 10_000;
  const started = Date.now();

  for (let offset = 0; offset < toInsert; offset += batchSize) {
    const batch = Math.min(batchSize, toInsert - offset);
    const seriesStart = existing + offset + 1;
    await prisma.$executeRaw`
      INSERT INTO notifications (
        id,
        "tenantId",
        "recipientId",
        channel,
        title,
        body,
        priority,
        status,
        "isStarred",
        "isArchived",
        "retryCount",
        metadata,
        "sentAt",
        "deliveredAt",
        "createdAt",
        "updatedAt"
      )
      SELECT
        gen_random_uuid(),
        ${LOAD_TEST_TENANT_ID}::uuid,
        ${LOAD_TEST_RECIPIENT_ID}::uuid,
        'IN_APP'::notification_channel,
        'Load test notification #' || gs::text,
        'Synthetic body for load test row ' || gs::text,
        'MEDIUM'::notification_priority,
        'DELIVERED'::notification_status,
        false,
        false,
        0,
        jsonb_build_object('loadTest', true, 'seq', gs),
        NOW(),
        NOW(),
        NOW() - (gs * interval '1 second'),
        NOW()
      FROM generate_series(${seriesStart}::int, ${seriesStart + batch - 1}::int) AS gs
    `;
    const done = offset + batch;
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(`\r  Inserted ${done.toLocaleString()} / ${toInsert.toLocaleString()} (${elapsed}s)`);
  }
  console.log('');

  const total = await countLoadTestRows(prisma);
  console.log(`  ✓ Total load-test notifications: ${total.toLocaleString()} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  return total;
}

async function cleanupLoadTestNotifications(prisma) {
  const deleted = await prisma.$executeRaw`
    DELETE FROM notifications
    WHERE "tenantId" = ${LOAD_TEST_TENANT_ID}::uuid
      AND metadata->>'loadTest' = 'true'
  `;
  console.log(`  ✓ Removed ${Number(deleted).toLocaleString()} load-test notifications`);
  return Number(deleted);
}

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { label, durationMs, result };
}

export async function runNotificationLoadBenchmarks(prisma) {
  const total = await countLoadTestRows(prisma);
  if (total < LOAD_TEST_MIN_COUNT) {
    throw new Error(`Need at least ${LOAD_TEST_MIN_COUNT.toLocaleString()} load-test rows, found ${total.toLocaleString()}`);
  }

  const benchmarks = [];

  benchmarks.push(
    await timed('firstPage', () =>
      prisma.notification.findMany({
        where: {
          tenantId: LOAD_TEST_TENANT_ID,
          recipientId: LOAD_TEST_RECIPIENT_ID,
          isArchived: false,
          status: { not: 'DRAFT' },
        },
        orderBy: { createdAt: 'desc' },
        take: 51,
      }),
    ),
  );

  const medianRow = await prisma.$queryRaw`
    SELECT "createdAt"
    FROM notifications
    WHERE "tenantId" = ${LOAD_TEST_TENANT_ID}::uuid
      AND "recipientId" = ${LOAD_TEST_RECIPIENT_ID}::uuid
      AND metadata->>'loadTest' = 'true'
    ORDER BY "createdAt" DESC
    OFFSET ${Math.floor(total / 2)}::int
    LIMIT 1
  `;
  const medianCreatedAt = medianRow[0]?.createdAt;
  if (medianCreatedAt) {
    benchmarks.push(
      await timed('deepPage', () =>
        prisma.notification.findMany({
          where: {
            tenantId: LOAD_TEST_TENANT_ID,
            recipientId: LOAD_TEST_RECIPIENT_ID,
            isArchived: false,
            status: { not: 'DRAFT' },
            createdAt: { lt: medianCreatedAt },
          },
          orderBy: { createdAt: 'desc' },
          take: 51,
        }),
      ),
    );
  }

  benchmarks.push(
    await timed('search', () =>
      prisma.notification.findMany({
        where: {
          tenantId: LOAD_TEST_TENANT_ID,
          recipientId: LOAD_TEST_RECIPIENT_ID,
          isArchived: false,
          status: { not: 'DRAFT' },
          OR: [
            { title: { contains: 'Load test notification #50000', mode: 'insensitive' } },
            { body: { contains: '50000', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 51,
      }),
    ),
  );

  benchmarks.push(
    await timed('overviewCount', () =>
      prisma.notification.count({
        where: { tenantId: LOAD_TEST_TENANT_ID, recipientId: LOAD_TEST_RECIPIENT_ID },
      }),
    ),
  );

  benchmarks.push(
    await timed('unreadCount', () =>
      prisma.notification.count({
        where: {
          tenantId: LOAD_TEST_TENANT_ID,
          recipientId: LOAD_TEST_RECIPIENT_ID,
          readAt: null,
          isArchived: false,
        },
      }),
    ),
  );

  const checks = benchmarks.map((b) => {
    const thresholdKey =
      b.label === 'firstPage'
        ? 'firstPage'
        : b.label === 'deepPage'
          ? 'deepPage'
          : b.label === 'search'
            ? 'search'
            : b.label === 'overviewCount'
              ? 'overviewCount'
              : 'unreadCount';
    const thresholdMs = THRESHOLDS_MS[thresholdKey];
    const passed = b.durationMs <= thresholdMs;
    const rowCount = Array.isArray(b.result) ? b.result.length : b.result;
    return {
      name: b.label,
      durationMs: b.durationMs,
      thresholdMs,
      passed,
      rowCount,
    };
  });

  return {
    totalRows: total,
    benchmarks: checks,
    passed: checks.every((c) => c.passed),
    ranAt: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    console.log('\n=== Notification Center Load Test ===\n');

    if (args.cleanup) {
      await cleanupLoadTestNotifications(prisma);
      return;
    }

    if (!args.benchmarkOnly) {
      await seedLoadTestNotifications(prisma, args.count);
    }

    if (args.seedOnly) {
      return;
    }

    console.log('\n  Running benchmarks…');
    const report = await runNotificationLoadBenchmarks(prisma);
    writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2));

    for (const bench of report.benchmarks) {
      const status = bench.passed ? 'PASS' : 'FAIL';
      console.log(
        `  [${status}] ${bench.name}: ${bench.durationMs}ms (threshold ${bench.thresholdMs}ms, rows ${bench.rowCount})`,
      );
    }

    console.log(`\n  Total load-test rows: ${report.totalRows.toLocaleString()}`);
    console.log(`  Results written to ${RESULTS_PATH}`);
    console.log(report.passed ? '\n  ✓ All benchmarks passed\n' : '\n  ✗ One or more benchmarks failed\n');

    if (!report.passed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith('notification-load-test.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
