/**
 * Flexible Step 21 — immutability matrix I01–I12 (PostgreSQL).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  cleanupAuditCenterTables,
  clearAuditFailureInjection,
  createAuditStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  ensureAuditImmutabilityTrigger,
  matrixAction,
  platformDbSecurityEnabled,
  seedAuditEntry,
} from './audit-center-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 21 Audit Center immutability matrix I01-I12 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restore: () => void;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    restore = enableAuditCenter();
    await ensureAuditImmutabilityTrigger(prisma);
  });

  afterAll(async () => {
    restore();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearAuditFailureInjection();
    await cleanupAuditCenterTables(prisma);
  });

  it('I01: application denyUpdate rejects mutation', async () => {
    const stack = createAuditStack(prisma);
    await expect(stack.query.denyUpdate()).rejects.toMatchObject({ code: 'immutable', httpStatus: 405 });
  });

  it('I02: application denyDelete rejects deletion', async () => {
    const stack = createAuditStack(prisma);
    await expect(stack.query.denyDelete()).rejects.toMatchObject({ code: 'immutable', httpStatus: 405 });
  });

  it('I03: query service exposes denyUpdate not update API', async () => {
    const stack = createAuditStack(prisma);
    expect(typeof stack.query.denyUpdate).toBe('function');
    expect((stack.query as { update?: unknown }).update).toBeUndefined();
  });

  it('I04: query service exposes denyDelete not delete API', async () => {
    const stack = createAuditStack(prisma);
    expect(typeof stack.query.denyDelete).toBe('function');
    expect((stack.query as { delete?: unknown }).delete).toBeUndefined();
  });

  it('I05: raw SQL UPDATE on audit_entries denied by trigger', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-i05-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const row = await seedAuditEntry(prisma, { actorId: user.id });
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "audit_entries" SET "reason" = 'hacked' WHERE "id" = $1::uuid`,
        row.id,
      ),
    ).rejects.toBeTruthy();
    const still = await prisma.auditEntry.findUnique({ where: { id: row.id } });
    expect(still?.reason).toBe('test reason');
  });

  it('I06: raw SQL DELETE on audit_entries denied by trigger', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-i06-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const row = await seedAuditEntry(prisma, { actorId: user.id });
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "audit_entries" WHERE "id" = $1::uuid`, row.id),
    ).rejects.toBeTruthy();
    expect(await prisma.auditEntry.count({ where: { id: row.id } })).toBe(1);
  });

  it('I07: bulk UPDATE denied by immutability trigger', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-i07-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id, action: 'platform.test.bulk.1' });
    await seedAuditEntry(prisma, { actorId: user.id, action: 'platform.test.bulk.2' });
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "audit_entries" SET "reason" = 'bulk' WHERE "tenantId" = $1::uuid AND "category" = 'test'`,
        PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      ),
    ).rejects.toBeTruthy();
  });

  it('I08: Platform Owner role cannot bypass audit_entries trigger', async () => {
    const owner = await createPlatformUserFixture(prisma, {
      email: `ac-i08-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const row = await seedAuditEntry(prisma, { actorId: owner.id });
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "audit_entries" SET "actorRoles" = ARRAY['platform_owner'] WHERE "id" = $1::uuid`,
        row.id,
      ),
    ).rejects.toBeTruthy();
  });

  it('I09: platform_feature_flag_history UPDATE/DELETE denied when table exists', async () => {
    const flagCount = await prisma.platformFeatureFlag.count();
    if (flagCount === 0) {
      const user = await createPlatformUserFixture(prisma, {
        email: `ac-i09-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const flag = await prisma.platformFeatureFlag.create({
        data: {
          canonicalKey: `audit.i09.${randomUUID().slice(0, 8)}`,
          displayName: 'I09',
          description: 'immutability',
          ownerTeam: 'ops',
          category: 'test',
          effect: 'OPERATIONAL_ENABLEMENT',
          status: 'ACTIVE',
          createdByPlatformUserId: user.id,
          updatedByPlatformUserId: user.id,
        },
      });
      const hist = await prisma.platformFeatureFlagHistory.create({
        data: {
          flagId: flag.id,
          actorPlatformUserId: user.id,
          operation: 'CREATE',
          reason: 'i09 seed',
          correlationId: randomUUID(),
          beforeSummaryJson: { v: 0 },
          afterSummaryJson: { v: 1 },
        },
      });
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "platform_feature_flag_history" SET "reason" = 'hack' WHERE "id" = $1::uuid`,
          hist.id,
        ),
      ).rejects.toBeTruthy();
      await expect(
        prisma.$executeRawUnsafe(
          `DELETE FROM "platform_feature_flag_history" WHERE "id" = $1::uuid`,
          hist.id,
        ),
      ).rejects.toBeTruthy();
      return;
    }
    const hist = await prisma.platformFeatureFlagHistory.findFirst();
    if (!hist) return;
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "platform_feature_flag_history" SET "reason" = 'hack' WHERE "id" = $1::uuid`,
        hist.id,
      ),
    ).rejects.toBeTruthy();
  });

  it('I10: correction appends linked event rather than rewriting original', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-i10-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const originalId = randomUUID();
    const correlationId = randomUUID();
    const original = await seedAuditEntry(prisma, {
      actorId: user.id,
      action: matrixAction('platform_override.approved'),
      category: 'override',
      resourceType: 'platform_override',
      resourceId: originalId,
      correlationId,
      reason: 'original decision',
    });
    const correction = await seedAuditEntry(prisma, {
      actorId: user.id,
      action: matrixAction('platform_override.correction'),
      category: 'override',
      resourceType: 'platform_override',
      resourceId: originalId,
      correlationId,
      reason: `correction for ${original.id}`,
      details: { correctsEntryId: original.id },
    });
    const still = await prisma.auditEntry.findUnique({ where: { id: original.id } });
    expect(still?.reason).toBe('original decision');
    expect(await prisma.auditEntry.count({ where: { correlationId } })).toBe(2);
    expect(correction.reason).toContain(original.id);
  });

  it('I11: DROP TRIGGER only in harness cleanup not application routes', async () => {
    const harnessSrc = readFileSync(join(__dirname, 'audit-center-db.harness.ts'), 'utf8');
    const controllerSrc = readFileSync(
      join(__dirname, '../controllers/platform-audit-center.controller.ts'),
      'utf8',
    );
    expect(harnessSrc).toContain('DROP TRIGGER IF EXISTS audit_entries_immutable');
    expect(controllerSrc).not.toContain('DROP TRIGGER');
    expect(controllerSrc).not.toContain('DELETE FROM "audit_entries"');
  });

  it('I12: controller has no Patch/Put/Delete routes for audit entries', async () => {
    const src = readFileSync(
      join(__dirname, '../controllers/platform-audit-center.controller.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/@(Patch|Put|Delete)\([^)]*audit\/entries/);
    expect(src).not.toContain('@Patch(');
    expect(src).not.toContain('@Put(');
    expect(src).not.toContain('@Delete(');
  });
});
