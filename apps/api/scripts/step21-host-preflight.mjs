import { PrismaClient } from '@prisma/client';
import net from 'net';

function tcpProbe(host, port, ms = 3000) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const t = setTimeout(() => {
      try {
        s.destroy();
      } catch {}
      resolve(false);
    }, ms);
    s.once('connect', () => {
      clearTimeout(t);
      try {
        s.destroy();
      } catch {}
      resolve(true);
      });
    s.once('error', () => {
      clearTimeout(t);
      resolve(false);
    });
  });
}

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';

console.log('tcp5433', await tcpProbe('127.0.0.1', 5433));

const c = new PrismaClient({
  datasources: { db: { url: `${adminUrl}${adminUrl.includes('?') ? '&' : '?'}connect_timeout=5` } },
});
const timer = setTimeout(() => {
  console.log('PRISMA_TIMEOUT');
  process.exit(2);
}, 25000);

try {
  await c.$connect();
  await c.$queryRawUnsafe('SELECT 1 AS ok');
  const booking = await c.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = 'booking_test'`,
  );
  const total = await c.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid <> pg_backend_pid()`,
  );
  const longTx = await c.$queryRawUnsafe(`
    SELECT count(*)::int AS n
    FROM pg_stat_activity
    WHERE xact_start IS NOT NULL
      AND now() - xact_start > interval '5 minutes'
      AND pid <> pg_backend_pid()
  `);
  const idleInTx = await c.$queryRawUnsafe(`
    SELECT count(*)::int AS n
    FROM pg_stat_activity
    WHERE state = 'idle in transaction'
      AND pid <> pg_backend_pid()
  `);
  const blocking = await c.$queryRawUnsafe(`
    SELECT count(*)::int AS n
    FROM pg_locks
    WHERE NOT granted
  `);
  const sample = await c.$queryRawUnsafe(`
    SELECT pid, datname, state, wait_event_type, wait_event,
           backend_start::text AS backend_start,
           left(query, 80) AS q
    FROM pg_stat_activity
    WHERE datname = 'booking_test' AND pid <> pg_backend_pid()
    ORDER BY backend_start
    LIMIT 5
  `);
  console.log(
    JSON.stringify(
      {
        booking_test_backends: booking[0].n,
        total_backends: total[0].n,
        long_tx_gt_5m: longTx[0].n,
        idle_in_transaction: idleInTx[0].n,
        ungranted_locks: blocking[0].n,
        sample,
      },
      null,
      2,
    ),
  );
  clearTimeout(timer);
  await c.$disconnect();
} catch (e) {
  clearTimeout(timer);
  console.error('FAIL', e.message);
  process.exit(1);
}
