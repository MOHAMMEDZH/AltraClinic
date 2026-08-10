/**
 * Idempotent healthcare catalog seed entrypoint.
 * Run: npm run seed:healthcare-catalog
 */
import { PrismaClient } from '@prisma/client';
import { HealthcareCatalogSeedService } from '../application/catalog-seed.service';

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
  const seed = new HealthcareCatalogSeedService(wrapper as never);
  const result = await seed.seedAll();
  // Structured success only — no credentials. Inventory vs persisted are both reported.
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      inventoryItems: result.items,
      inventoryAliasesUpserted: result.aliases,
      inventoryRulesUpserted: result.rules,
      persisted: result.persisted,
    })}\n`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`${(err as Error)?.message ?? 'seed_failed'}\n`);
  process.exit(1);
});
