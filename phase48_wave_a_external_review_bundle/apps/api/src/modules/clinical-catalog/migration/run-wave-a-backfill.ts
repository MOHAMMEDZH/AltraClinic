/**
 * Phase 48 Wave A — idempotent backfill entrypoint (no Nest AppModule bootstrap).
 * Run: node scripts/phase48-wave-a-backfill.mjs
 */
import { PrismaClient } from '@prisma/client';
import { WaveABackfillService } from './wave-a-backfill.service';

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
  const backfill = new WaveABackfillService(wrapper as never);
  const summary = await backfill.run();
  process.stdout.write(`${JSON.stringify({ ok: true, ...summary })}\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`${(err as Error)?.message ?? 'wave_a_backfill_failed'}\n`);
  process.exit(1);
});
