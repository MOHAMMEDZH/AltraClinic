import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const dashboardServer = {
  command: 'npm run dev',
  url: `http://127.0.0.1:${dashboardPort}`,
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
  url: `http://127.0.0.1:${rollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const searchRollbackServer = {
  command: `npx vite --port ${searchRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_SEARCH_ONLY: 'true',
  },
  url: `http://127.0.0.1:${searchRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const reportingRollbackServer = {
  command: `npx vite --port ${reportingRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_REPORTING_ONLY: 'true',
  },
  url: `http://127.0.0.1:${reportingRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const analyticsRollbackServer = {
  command: `npx vite --port ${analyticsRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_ANALYTICS_ONLY: 'true',
  },
  url: `http://127.0.0.1:${analyticsRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const whiteLabelRollbackServer = {
  command: `npx vite --port ${whiteLabelRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_WHITE_LABEL_ONLY: 'true',
  },
  url: `http://127.0.0.1:${whiteLabelRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const branchRollbackServer = {
  command: `npx vite --port ${branchRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_BRANCH_ONLY: 'true',
  },
  url: `http://127.0.0.1:${branchRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const activityRollbackServer = {
  command: `npx vite --port ${activityRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_ACTIVITY_ONLY: 'true',
  },
  url: `http://127.0.0.1:${activityRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const auditRollbackServer = {
  command: `npx vite --port ${auditRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_AUDIT_ONLY: 'true',
  },
  url: `http://127.0.0.1:${auditRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const journeyRollbackServer = {
  command: `npx vite --port ${journeyRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_JOURNEY_ONLY: 'true',
  },
  url: `http://127.0.0.1:${journeyRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const notificationRollbackServer = {
  command: `npx vite --port ${notificationRollbackPort} --strictPort`,
  env: {
    ...process.env,
    VITE_USE_STATIC_NOTIFICATION_ONLY: 'true',
  },
  url: `http://127.0.0.1:${notificationRollbackPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const apiServer = {
  // Workers are disabled when NODE_ENV=test (apps/api/.env default). Playwright must run
  // the API with development so the BullMQ delivery worker can connect.
  command: 'npm run dev',
  cwd: apiDir,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    BACKGROUND_WORKERS_ENABLED: 'true',
  },
  url: `http://127.0.0.1:${apiPort}`,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
};

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

function buildWebServers() {
  if (skipWebServer) return undefined;
  if (process.env.CI) {
    return [
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
