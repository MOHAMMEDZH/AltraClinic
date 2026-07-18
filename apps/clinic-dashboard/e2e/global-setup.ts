import { execSync } from 'node:child_process';

import path from 'node:path';

import { fileURLToPath } from 'node:url';

import type { FullConfig } from '@playwright/test';

import { writeE2eApiReadyFlag } from './helpers/api-ready';



const configDir = path.dirname(fileURLToPath(import.meta.url));

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 3000);

const dashboardPort = Number(process.env.PLAYWRIGHT_DASHBOARD_PORT ?? 5173);

const apiBase = process.env.PLAYWRIGHT_API_URL ?? `http://127.0.0.1:${apiPort}`;

const dashboardBase = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${dashboardPort}`;

const apiDir = path.resolve(configDir, '../../api');



async function globalSetup(_config: FullConfig) {

  // Playwright globalSetup runs before webServer boot — in CI the API is started by webServer.

  if (process.env.CI) {

    writeE2eApiReadyFlag(true);

    return;

  }



  let ready = false;

  try {

    const res = await fetch(`${apiBase}/auth/login`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },

      body: JSON.stringify({

        email: 'owner@demo.clinic',

        password: 'Owner123!',

        tenantId: 'a1000000-0000-4000-8000-000000000001',

        deviceName: 'playwright-setup',

      }),

    });

    ready = res.ok;

    if (!ready) {

      console.warn(

        `[e2e] API login probe failed (${res.status}). Start the API on ${apiBase} and run \`npx prisma db seed\` in apps/api.`,

      );

    }

  } catch {

    console.warn(

      `[e2e] API unreachable at ${apiBase}. Start \`npm run dev\` in apps/api before running Playwright tests.`,

    );

  }



  if (ready) {

    try {

      const databaseUrl =
        process.env.DATABASE_URL ??
        'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';
      execSync('npx prisma db seed', {
        cwd: apiDir,
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });

    } catch {

      console.warn('[e2e] prisma db seed failed — inventory workflow tests may fail on stale demo data.');

    }

    try {
      execSync('docker exec booking-system-redis-test redis-cli FLUSHDB', { stdio: 'inherit' });
    } catch {
      console.warn('[e2e] Redis FLUSHDB skipped — rate-limit keys may persist across runs.');
    }

    try {

      await fetch(dashboardBase, { signal: AbortSignal.timeout(15_000) });

    } catch {

      console.warn(

        `[e2e] Dashboard warmup skipped at ${dashboardBase} — Playwright webServer will start it.`,

      );

    }

  }



  writeE2eApiReadyFlag(ready);

}



export default globalSetup;


