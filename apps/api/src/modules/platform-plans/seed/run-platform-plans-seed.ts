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
  const result = await seed.seedAll({ includeCommercialDefinitions: true });
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      inventoryPlans: result.plans,
      inventoryAliasesUpserted: result.aliases,
      draftVersionsSeeded: result.draftVersionsSeeded,
      entitlementsSeeded: result.entitlementsSeeded,
      limitsSeeded: result.limitsSeeded,
      persisted: result.persisted,
    })}\n`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`${(err as Error)?.message ?? 'seed_failed'}\n`);
  process.exit(1);
});
