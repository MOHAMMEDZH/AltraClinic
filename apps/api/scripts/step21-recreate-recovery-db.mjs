import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const db = `booking_step21_${Date.now()}_test`;
const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const url = `postgresql://booking:booking_test@localhost:5433/${db}?connection_limit=25&pool_timeout=60&connect_timeout=30&schema=public`;

const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
await admin.$executeRawUnsafe(`SET lock_timeout = '10000'`);
await admin.$executeRawUnsafe(`SET statement_timeout = 30000`);
await admin.$executeRawUnsafe(`CREATE DATABASE ${db}`);
await admin.$disconnect();
console.log('CREATED', db);

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: apiRoot,
  env: { ...process.env, DATABASE_URL: url },
  shell: true,
  stdio: 'inherit',
  timeout: 180_000,
});
if ((migrate.status ?? 1) !== 0) process.exit(migrate.status ?? 1);
console.log('READY_URL', url);
