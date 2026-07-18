/**
 * Workflow center load test — seeds 100k+ rows and benchmarks list queries.
 *
 * Usage:
 *   node scripts/workflow-load-test.mjs
 *   node scripts/workflow-load-test.mjs --count=100000
 *   node scripts/workflow-load-test.mjs --benchmark-only
 *   node scripts/workflow-load-test.mjs --cleanup
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = join(__dirname, '..', 'workflow-load-test-results.json');

export const LOAD_TEST_TENANT_ID = 'a1000000-0000-4000-8000-000000000001';
export const LOAD_TEST_MIN_COUNT = 100_000;

const THRESHOLDS_MS = {
  firstPage: 300,
  deepPage: 450,
  search: 650,
  overviewCount: 900,
  activeCount: 450,
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
    FROM workflows
    WHERE "tenantId" = ${LOAD_TEST_TENANT_ID}::uuid
      AND "nameEn" LIKE 'Load test workflow #%'
  `;
  return rows[0]?.count ?? 0;
}

async function seedLoadTestWorkflows(prisma, targetCount) {
  const existing = await countLoadTestRows(prisma);
  if (existing >= targetCount) {
    console.log(`  ✓ Already have ${existing.toLocaleString()} load-test workflows (target ${targetCount.toLocaleString()})`);
    return existing;
  }

  const toInsert = targetCount - existing;
  console.log(`  Seeding ${toInsert.toLocaleString()} load-test workflows…`);
  const batchSize = 5_000;
  const started = Date.now();

  for (let offset = 0; offset < toInsert; offset += batchSize) {
    const batch = Math.min(batchSize, toInsert - offset);
    const seriesStart = existing + offset;
    const rows = Array.from({ length: batch }, (_, i) => {
      const n = seriesStart + i;
      return {
        id: `f9000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
        tenantId: LOAD_TEST_TENANT_ID,
        nameEn: `Load test workflow #${n}`,
        nameAr: `اختبار ${n}`,
        descriptionEn: 'Load test',
        descriptionAr: 'اختبار',
        steps: ['Review', 'Complete'],
        currentStepIndex: 0,
        status: n % 50 === 0 ? 'FAILED' : 'ACTIVE',
        createdBy: LOAD_TEST_TENANT_ID,
        dataContext: { loadTest: true },
      };
    });
    await prisma.workflow.createMany({ data: rows, skipDuplicates: true });
    const done = offset + batch;
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(`\r  Inserted ${done.toLocaleString()} / ${toInsert.toLocaleString()} (${elapsed}s)`);
  }
  console.log('');

  const total = await countLoadTestRows(prisma);
  console.log(`  ✓ Total load-test workflows: ${total.toLocaleString()} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  return total;
}

async function cleanupLoadTestWorkflows(prisma) {
  const deleted = await prisma.$executeRaw`
    DELETE FROM workflows
    WHERE "tenantId" = ${LOAD_TEST_TENANT_ID}::uuid
      AND "nameEn" LIKE 'Load test workflow #%'
  `;
  console.log(`  ✓ Removed ${Number(deleted).toLocaleString()} load-test workflows`);
  return Number(deleted);
}

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { label, durationMs, result };
}

export async function runWorkflowLoadBenchmarks(prisma) {
  const total = await countLoadTestRows(prisma);
  if (total < LOAD_TEST_MIN_COUNT) {
    throw new Error(`Need at least ${LOAD_TEST_MIN_COUNT.toLocaleString()} load-test rows, found ${total.toLocaleString()}`);
  }

  const benchmarks = [];

  benchmarks.push(
    await timed('firstPage', () =>
      prisma.workflow.findMany({
        where: { tenantId: LOAD_TEST_TENANT_ID },
        orderBy: { updatedAt: 'desc' },
        take: 51,
      }),
    ),
  );

  const medianRow = await prisma.$queryRaw`
    SELECT "updatedAt"
    FROM workflows
    WHERE "tenantId" = ${LOAD_TEST_TENANT_ID}::uuid
      AND "nameEn" LIKE 'Load test workflow #%'
    ORDER BY "updatedAt" DESC
    OFFSET ${Math.floor(total / 2)}::int
    LIMIT 1
  `;
  const medianUpdatedAt = medianRow[0]?.updatedAt;
  if (medianUpdatedAt) {
    benchmarks.push(
      await timed('deepPage', () =>
        prisma.workflow.findMany({
          where: {
            tenantId: LOAD_TEST_TENANT_ID,
            updatedAt: { lt: medianUpdatedAt },
          },
          orderBy: { updatedAt: 'desc' },
          take: 51,
        }),
      ),
    );
  }

  benchmarks.push(
    await timed('search', () =>
      prisma.workflow.findMany({
        where: {
          tenantId: LOAD_TEST_TENANT_ID,
          OR: [
            { nameEn: { contains: 'Load test workflow #50000', mode: 'insensitive' } },
            { descriptionEn: { contains: '50000', mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 51,
      }),
    ),
  );

  benchmarks.push(
    await timed('overviewCount', () =>
      prisma.workflow.count({ where: { tenantId: LOAD_TEST_TENANT_ID } }),
    ),
  );

  benchmarks.push(
    await timed('activeCount', () =>
      prisma.workflow.count({ where: { tenantId: LOAD_TEST_TENANT_ID, status: 'ACTIVE' } }),
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
              : 'activeCount';
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
    console.log('\n=== Workflow Center Load Test ===\n');

    if (args.cleanup) {
      await cleanupLoadTestWorkflows(prisma);
      return;
    }

    if (!args.benchmarkOnly) {
      await seedLoadTestWorkflows(prisma, args.count);
    }

    if (args.seedOnly) {
      return;
    }

    console.log('\n  Running benchmarks…');
    const report = await runWorkflowLoadBenchmarks(prisma);
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

if (process.argv[1] && process.argv[1].endsWith('workflow-load-test.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
