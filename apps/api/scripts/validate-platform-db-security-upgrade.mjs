#!/usr/bin/env node
/**
 * Upgrade-path validation for 20260722180000_phase47_platform_rbac_db_security.
 *
 * 1) Creates isolated booking_test_upgrade
 * 2) Applies migrations through 20260721220000_phase47_platform_rbac
 * 3) Inserts duplicate pending invitations (legacy-compatible state)
 * 4) Applies the gate migration
 * 5) Asserts one pending remains, older rows superseded, index present
 *
 * Requires postgres-test. Sets safety flags for the isolated upgrade DB only.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const gateDirName = '20260722180000_phase47_platform_rbac_db_security';
const parkDir = path.join(apiRoot, 'prisma', '.parked-migrations-for-upgrade-test');
const upgradeDb = 'booking_test_upgrade';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const upgradeUrl = `postgresql://booking:booking_test@localhost:5433/${upgradeDb}?schema=public`;

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

async function withAdmin(fn) {
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$connect();
    return await fn(admin);
  } finally {
    await admin.$disconnect();
  }
}

function parkGateMigration() {
  fs.mkdirSync(parkDir, { recursive: true });
  const from = path.join(migrationsDir, gateDirName);
  const to = path.join(parkDir, gateDirName);
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

function restoreGateMigration() {
  const from = path.join(parkDir, gateDirName);
  const to = path.join(migrationsDir, gateDirName);
  if (fs.existsSync(from)) {
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
  }
  if (fs.existsSync(parkDir) && fs.readdirSync(parkDir).length === 0) {
    fs.rmdirSync(parkDir);
  }
}

async function main() {
  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb}`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    parkGateMigration();
    console.log('Deploying migrations through previous Step 08 RBAC migration...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prisma.$connect();
    try {
      const inviter = await prisma.platformUser.create({
        data: {
          email: `upgrade-inviter-${randomUUID()}@example.com`,
          passwordHash: '$2a$12$placeholderhashplaceholderhashplaceho',
          status: 'active',
          isActive: true,
          mfaEnabled: false,
        },
      });
      const invitee = await prisma.platformUser.create({
        data: {
          email: `upgrade-invitee-${randomUUID()}@example.com`,
          passwordHash: '$2a$12$placeholderhashplaceholderhashplaceho',
          status: 'pending_activation',
          isActive: true,
          mfaEnabled: false,
        },
      });

      const older = await prisma.platformUserInvitation.create({
        data: {
          platformUserId: invitee.id,
          email: invitee.email,
          tokenHash: createHash('sha256').update(`old-${randomUUID()}`).digest('hex'),
          invitedById: inviter.id,
          roleKeysJson: '[]',
          expiresAt: new Date(Date.now() + 3600_000),
          status: 'pending',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
      const newer = await prisma.platformUserInvitation.create({
        data: {
          platformUserId: invitee.id,
          email: invitee.email,
          tokenHash: createHash('sha256').update(`new-${randomUUID()}`).digest('hex'),
          invitedById: inviter.id,
          roleKeysJson: '[]',
          expiresAt: new Date(Date.now() + 3600_000),
          status: 'pending',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      });

      console.log('Restoring gate migration and deploying upgrade...');
      restoreGateMigration();
      run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

      const pending = await prisma.platformUserInvitation.findMany({
        where: { platformUserId: invitee.id, status: 'pending' },
      });
      const superseded = await prisma.platformUserInvitation.findMany({
        where: { platformUserId: invitee.id, status: 'superseded' },
      });
      if (pending.length !== 1) {
        throw new Error(`Expected 1 pending invitation, found ${pending.length}`);
      }
      if (pending[0].id !== newer.id) {
        throw new Error('Expected newest pending invitation to remain pending.');
      }
      if (!superseded.some((row) => row.id === older.id)) {
        throw new Error('Expected older pending invitation to become superseded.');
      }

      const indexes = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'platform_user_invitations'
          AND indexname = 'platform_user_invitations_one_pending_per_user'
      `;
      if (!Array.isArray(indexes) || indexes.length !== 1) {
        throw new Error('Partial unique index missing after upgrade.');
      }

      const users = await prisma.platformUser.count();
      if (users !== 2) {
        throw new Error('Upgrade unexpectedly changed Platform User count.');
      }

      console.log(
        JSON.stringify({
          ok: true,
          upgradeDb,
          pendingCount: pending.length,
          supersededCount: superseded.length,
          indexPresent: true,
          usersPreserved: users,
        }),
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    restoreGateMigration();
  }
}

main().catch((err) => {
  restoreGateMigration();
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
