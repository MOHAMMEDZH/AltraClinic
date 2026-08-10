/**
 * Seeds Plans metadata only and plants an UNINITIALIZED Draft on plan.lite.
 */
import { PrismaClient } from '@prisma/client';
import { PlatformPlansSeedService } from '../application/plan-seed.service';

async function main() {
  const prisma = new PrismaClient();
  const wrapper = {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> => {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
        return fn(tx as unknown as PrismaClient);
      });
    },
  };
  const seed = new PlatformPlansSeedService(wrapper as never);
  await seed.seedAll({ includeCommercialDefinitions: false });
  const lite = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
  const existing = await prisma.platformPlanVersion.findFirst({
    where: { planId: lite.id, lifecycle: 'DRAFT' },
  });
  if (!existing) {
    await prisma.platformPlanVersion.create({
      data: {
        planId: lite.id,
        versionNumber: 1,
        lifecycle: 'DRAFT',
        systemSeeded: true,
        commercialDefinitionOwnership: 'UNINITIALIZED',
        translations: {
          create: [
            { locale: 'en-US', releaseLabel: 'Uninit', shortDescription: 'u' },
            { locale: 'ar-SY', releaseLabel: 'غ', shortDescription: 'غ' },
          ],
        },
      },
    });
  } else {
    await prisma.platformPlanVersionEntitlement.deleteMany({ where: { planVersionId: existing.id } });
    await prisma.platformPlanVersionLimit.deleteMany({ where: { planVersionId: existing.id } });
    await prisma.platformPlanVersion.update({
      where: { id: existing.id },
      data: {
        commercialDefinitionOwnership: 'UNINITIALIZED',
        systemSeeded: true,
        publicationFingerprint: null,
        publishedAt: null,
      },
    });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, uninitDraftReady: true })}\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`${(err as Error)?.message ?? 'seed_failed'}\n`);
  process.exit(1);
});
