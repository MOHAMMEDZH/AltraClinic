/**
 * One-pass helper: if booking_test is wedged, create/use a unique recovery DB and print JSON.
 */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const primary =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';

const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
try {
  await admin.$connect();
  await admin.$queryRawUnsafe('SELECT 1 AS ok');
  const rows = await admin.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = 'booking_test'`,
  );
  const n = rows[0]?.n ?? 0;
  if (n > 40) {
    await admin.$executeRawUnsafe(`SET lock_timeout = '10000'`);
    await admin.$executeRawUnsafe(`SET statement_timeout = 30000`);
    const db = `booking_step21_${Date.now()}_test`;
    await admin.$executeRawUnsafe(`CREATE DATABASE ${db}`);
    const url = `postgresql://booking:booking_test@localhost:5433/${db}?connection_limit=25&pool_timeout=60&connect_timeout=30&schema=public`;
    await admin.$disconnect();
    const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: url },
      shell: true,
      stdio: 'inherit',
      timeout: 180_000,
    });
    if ((migrate.status ?? 1) !== 0) process.exit(migrate.status ?? 1);
    process.stdout.write(JSON.stringify({ switch: true, booking_test_backends: n, url, db }));
  } else {
    process.stdout.write(JSON.stringify({ switch: false, booking_test_backends: n, url: primary }));
  }
} finally {
  try {
    await admin.$disconnect();
  } catch {
    /* ignore */
  }
}
