import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Supply PLATFORM_MFA_ENCRYPTION_KEY for the Playwright-managed API child when CI
 * forces NODE_ENV=development (BullMQ workers) but the job env has no explicit key.
 * Never logs or returns key material to callers beyond the env object itself.
 * Explicit non-empty caller keys are preserved exactly.
 */
export function resolveApiWebServerMfaEncryptionKey(
  inheritedEnv: NodeJS.ProcessEnv,
): string | undefined {
  // Preserve an explicit nonblank key byte-for-byte (do not return a trimmed copy).
  const explicit = inheritedEnv.PLATFORM_MFA_ENCRYPTION_KEY;
  if (explicit && explicit.trim().length > 0) {
    return explicit;
  }
  const ci = inheritedEnv.CI;
  const isCi = ci === 'true' || ci === '1' || ci === 'TRUE';
  if (!isCi) {
    return undefined;
  }
  // 48 random bytes → 96 hex chars; API child only; never log.
  return randomBytes(48).toString('hex');
}

const configDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardPort = Number(process.env.PLAYWRIGHT_DASHBOARD_PORT ?? 5173);
const rollbackPort = Number(process.env.PLAYWRIGHT_ROLLBACK_PORT ?? 5174);
const searchRollbackPort = Number(process.env.PLAYWRIGHT_SEARCH_ROLLBACK_PORT ?? 5175);
const reportingRollbackPort = Number(process.env.PLAYWRIGHT_REPORTING_ROLLBACK_PORT ?? 5176);
const analyticsRollbackPort = Number(process.env.PLAYWRIGHT_ANALYTICS_ROLLBACK_PORT ?? 5177);
const whiteLabelRollbackPort = Number(process.env.PLAYWRIGHT_WHITE_LABEL_ROLLBACK_PORT ?? 5178);
const branchRollbackPort = Number(process.env.PLAYWRIGHT_BRANCH_ROLLBACK_PORT ?? 5179);
const activityRollbackPort = Number(process.env.PLAYWRIGHT_ACTIVITY_ROLLBACK_PORT ?? 5180);
const auditRollbackPort = Number(process.env.PLAYWRIGHT_AUDIT_ROLLBACK_PORT ?? 5181);
const journeyRollbackPort = Number(process.env.PLAYWRIGHT_JOURNEY_ROLLBACK_PORT ?? 5182);
const notificationRollbackPort = Number(process.env.PLAYWRIGHT_NOTIFICATION_ROLLBACK_PORT ?? 5183);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 3000);
const apiDir = path.resolve(configDir, '../api');

// Wait for the Vite entry transform — HTML shell on `/` alone is not SPA-ready.
const dashboardEntryPath = '/src/main.tsx';

const dashboardServer = {
  command: 'npm run dev',
  url: `http://127.0.0.1:${dashboardPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const dashboardRollbackServer = {
  command: `npx vite --port ${rollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_ROUTES_ONLY: 'true',
    VITE_USE_STATIC_DASHBOARD_ONLY: 'true',
  },
  url: `http://127.0.0.1:${rollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const searchRollbackServer = {
  command: `npx vite --port ${searchRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_SEARCH_ONLY: 'true',
  },
  url: `http://127.0.0.1:${searchRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const reportingRollbackServer = {
  command: `npx vite --port ${reportingRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_REPORTING_ONLY: 'true',
  },
  url: `http://127.0.0.1:${reportingRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const analyticsRollbackServer = {
  command: `npx vite --port ${analyticsRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_ANALYTICS_ONLY: 'true',
  },
  url: `http://127.0.0.1:${analyticsRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const whiteLabelRollbackServer = {
  command: `npx vite --port ${whiteLabelRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_WHITE_LABEL_ONLY: 'true',
  },
  url: `http://127.0.0.1:${whiteLabelRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const branchRollbackServer = {
  command: `npx vite --port ${branchRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_BRANCH_ONLY: 'true',
  },
  url: `http://127.0.0.1:${branchRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const activityRollbackServer = {
  command: `npx vite --port ${activityRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_ACTIVITY_ONLY: 'true',
  },
  url: `http://127.0.0.1:${activityRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const auditRollbackServer = {
  command: `npx vite --port ${auditRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_AUDIT_ONLY: 'true',
  },
  url: `http://127.0.0.1:${auditRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const journeyRollbackServer = {
  command: `npx vite --port ${journeyRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_JOURNEY_ONLY: 'true',
  },
  url: `http://127.0.0.1:${journeyRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const notificationRollbackServer = {
  command: `npx vite --port ${notificationRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_NOTIFICATION_ONLY: 'true',
  },
  url: `http://127.0.0.1:${notificationRollbackPort}${dashboardEntryPath}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

/**
 * Resolve Redis URL for the Playwright-managed API child.
 *
 * Clinic Dashboard Inventory E2E does not run Redis. Deleting REDIS_URL is
 * insufficient: `loadRedisConfig()` defaults to `redis://localhost:6379`, so an
 * ambient Redis would persist `public_ip` / `tenant_user` counters across API
 * process restarts and exhaust production budgets mid-batch.
 *
 * Contract (Playwright API child only):
 * - PLAYWRIGHT_REDIS_URL set → that exact validated URL.
 * - PLAYWRIGHT_REDIS_URL unset → REDIS_URL=redis://127.0.0.1:63999 +
 *   CI_REDIS_ABSENCE_ENFORCEMENT=1 so Nest ignores ambient .env REDIS_URL.
 * Generic CI with intentional Redis is unchanged (flag not set outside this child).
 */
export function resolveApiWebServerRedisUrl(
  inheritedEnv: NodeJS.ProcessEnv = process.env,
): string {
  // Honor only the env object under test / webServer snapshot — never fall back to
  // live process.env when an explicit inherited bag is passed (vitest isolation).
  const pinned = inheritedEnv.PLAYWRIGHT_REDIS_URL?.trim();
  if (pinned) {
    return pinned;
  }
  // Unreachable port: optional Redis stays unavailable → limiter pass-through.
  return 'redis://127.0.0.1:63999';
}

/** Host:port only (no credentials) for evidence / diagnostics. */
export function formatRedisUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'rediss:' ? '6380' : '6379');
    return `${parsed.hostname}:${port}`;
  } catch {
    return 'unparseable-redis-url';
  }
}

/**
 * Build env for the Playwright-managed API webServer child.
 * Exported for unit tests — production Playwright still snapshots once at load.
 */
export function buildApiWebServerEnv(inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...inherited };
  const hasPinnedRedis = Boolean(inherited.PLAYWRIGHT_REDIS_URL?.trim());
  const redisUrl = resolveApiWebServerRedisUrl(inherited);
  env.REDIS_URL = redisUrl;
  env.REDIS_CONNECT_TIMEOUT_MS = inherited.REDIS_CONNECT_TIMEOUT_MS ?? '250';
  env.NODE_ENV = 'development';
  env.REDIS_OPTIONAL = 'true';
  // Purpose-specific: Nest loadRedisConfig honors this only for this child path.
  // Do not equate generic CI=true with Redis absence.
  if (hasPinnedRedis) {
    delete env.CI_REDIS_ABSENCE_ENFORCEMENT;
    env.BACKGROUND_WORKERS_ENABLED = inherited.BACKGROUND_WORKERS_ENABLED ?? 'true';
  } else {
    env.CI_REDIS_ABSENCE_ENFORCEMENT = '1';
    env.BACKGROUND_SCHEDULERS_ENABLED = inherited.BACKGROUND_SCHEDULERS_ENABLED ?? 'false';
    env.BACKGROUND_WORKERS_ENABLED = inherited.BACKGROUND_WORKERS_ENABLED ?? 'false';
  }
  // Safe diagnostic (host:port only) for child process / WebServer logs.
  env.PLAYWRIGHT_REDIS_RESOLVED_HOSTPORT = formatRedisUrlForLog(redisUrl);
  const mfaKey = resolveApiWebServerMfaEncryptionKey(inherited);
  if (mfaKey) {
    env.PLATFORM_MFA_ENCRYPTION_KEY = mfaKey;
  }
  return env;
}

const apiWebServerInheritedEnv = { ...process.env };
const apiWebServerEnv = buildApiWebServerEnv(apiWebServerInheritedEnv);

const apiServer = {
  // Workers are disabled when NODE_ENV=test (apps/api/.env default). Playwright must run
  // the API with development so the BullMQ delivery worker can connect.
  command: 'npm run dev',
  cwd: apiDir,
  env: apiWebServerEnv,
  // Playwright treats only HTTP 200–403 as ready (404 on `/` is never ready).
  url: `http://127.0.0.1:${apiPort}/health/ready`,
  reuseExistingServer: !process.env.CI,
  // CI boots API + 11 rollback Vite servers; cold ts-node-dev compile can exceed 180s locally.
  timeout: 360_000,
};

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

/**
 * WebServer profiles:
 * - full / default CI: API + dashboard + all rollback Vite ports (official 59 / npm run test:e2e).
 * - progressive-batch: API + dashboard + rollbacks needed by dynamic-* Batch A–C specs
 *   (reduces socket/TIME_WAIT pressure that produced ERR_NO_BUFFER_SPACE under ambient load).
 */
function buildWebServers() {
  if (skipWebServer) return undefined;
  const profile = (process.env.PLAYWRIGHT_WEBSERVER_PROFILE ?? '').trim().toLowerCase();
  const fullCiStack = [
    apiServer,
    dashboardServer,
    dashboardRollbackServer,
    searchRollbackServer,
    reportingRollbackServer,
    analyticsRollbackServer,
    whiteLabelRollbackServer,
    branchRollbackServer,
    activityRollbackServer,
    auditRollbackServer,
    journeyRollbackServer,
    notificationRollbackServer,
  ];
  if (profile === 'progressive-batch') {
    return [
      apiServer,
      dashboardServer,
      reportingRollbackServer,
      analyticsRollbackServer,
      whiteLabelRollbackServer,
      branchRollbackServer,
      searchRollbackServer,
    ];
  }
  if (process.env.CI || profile === 'full') {
    return fullCiStack;
  }
  return [
    dashboardServer,
    dashboardRollbackServer,
    searchRollbackServer,
    reportingRollbackServer,
    analyticsRollbackServer,
    whiteLabelRollbackServer,
    branchRollbackServer,
    activityRollbackServer,
    auditRollbackServer,
    journeyRollbackServer,
    notificationRollbackServer,
  ];
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${dashboardPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: buildWebServers(),
  globalSetup: './e2e/global-setup.ts',
});
