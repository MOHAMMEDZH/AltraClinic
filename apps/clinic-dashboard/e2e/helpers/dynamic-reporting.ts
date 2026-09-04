import { expect, type Page } from '@playwright/test';

export const REPORTING_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_REPORTING_ROLLBACK_URL ?? 'http://127.0.0.1:5176';

const HUB_REPORT_IDS = new Set(['catalog', 'builder', 'export-center']);

export function reportsRegion(page: Page) {
  return page.locator('#reports-region');
}

export async function clearReportPreferences(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('clinic-report-favorites');
    localStorage.removeItem('clinic-report-recents');
  });
}


export function reportCatalogSection(page: Page) {
  return page.getByRole('region', { name: /report catalog/i }).first();
}

export function categoryCatalogSection(page: Page) {
  return page.getByRole('region', { name: /report catalog/i }).last();
}

export async function gotoReportingHome(page: Page) {
  const reportsLink = page.getByRole('navigation').getByRole('link', { name: 'Reports', exact: true });
  if ((await reportsLink.count()) > 0) {
    await reportsLink.first().click();
    await page.waitForURL(/\/reports/, { timeout: 20_000 });
  } else {
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
  }
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  // Focused Vite boots occasionally fail the first dynamic import of ReportingHomePage.
  if ((await page.getByRole('heading', { name: /Unexpected Application Error/i }).count()) > 0) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  }
  await waitForReportingLoaded(page);
}

export async function gotoReportingPath(page: Page, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/reports' || normalized === '/reports/') {
    await gotoReportingHome(page);
    return;
  }

  if (!page.url().includes('/reports')) {
    await gotoReportingHome(page);
  }

  if (normalized === '/reports/builder') {
    if (!page.url().includes('/reports/builder')) {
      if ((await page.getByRole('link', { name: 'Report builder' }).count()) === 0) {
        await gotoReportingHome(page);
      }
      await page.getByRole('link', { name: 'Report builder' }).first().click();
    }
  } else if (normalized === '/reports/export') {
    if (!page.url().includes('/reports/export')) {
      if ((await page.getByRole('link', { name: 'Export center' }).count()) === 0) {
        await gotoReportingHome(page);
      }
      await page.getByRole('link', { name: 'Export center' }).first().click();
    }
  } else if (normalized.startsWith('/reports/category/')) {
    const categoryId = normalized.split('/').pop() ?? '';
    const categoryLabels: Record<string, RegExp> = {
      billing: /Billing/i,
      scheduling: /Scheduling/i,
      dental: /Dental/i,
    };
    const label = categoryLabels[categoryId];
    if (label) {
      const categoryLink = page
        .getByRole('navigation', { name: /report categories/i })
        .getByRole('link', { name: label });
      if ((await categoryLink.count()) > 0) {
        await categoryLink.click();
      } else {
        await page.goto(normalized, { waitUntil: 'domcontentloaded' });
      }
    } else {
      await page.goto(normalized, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('alert')).toContainText(/category not found|not found/i, { timeout: 30_000 });
      return;
    }
  } else {
    await page.goto(normalized, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForURL((url) => url.pathname.startsWith(normalized), { timeout: 20_000 }).catch(() => undefined);
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);

  const notFoundAlert = page.getByRole('alert').filter({ hasText: /not found/i });
  if (await notFoundAlert.first().isVisible({ timeout: 15_000 }).catch(() => false)) {
    return;
  }

  const isReportDetailRoute =
    /^\/reports\/[^/]+$/.test(normalized) && normalized !== '/reports/builder' && normalized !== '/reports/export';
  if (isReportDetailRoute) {
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /report not found|not found/i })
        .or(page.locator('#reports-region'))
        .or(page.getByRole('heading', { level: 1 })),
    ).toBeVisible({ timeout: 30_000 });
    return;
  }

  await waitForReportingLoaded(page);
}


export async function waitForReportingLoaded(page: Page) {
  const region = reportsRegion(page);
  const reportCatalogRegion = page.getByRole('region', { name: /report catalog/i }).first();
  const accessDenied = page.getByText(/do not have permission|access denied|ليس لديك/i).first();
  const topHeading = page
    .getByRole('heading', { name: /Report builder|Export center|Reporting|التقارير/i, level: 1 })
    .first();

  // Wait for either the reporting region itself or an access-denied / fallback UI.
  // CI sometimes renders #reports-region in the DOM but keeps it hidden while
  // the permission UI is visible.
  await expect(region.or(reportCatalogRegion).or(accessDenied).or(topHeading).first()).toBeVisible({
    timeout: 45_000,
  });

  if ((await region.count()) > 0) {
    // If the user is explicitly access denied, #reports-region may intentionally remain hidden.
    if (await accessDenied.isVisible().catch(() => false)) return;

    await expect(region).toBeVisible({ timeout: 30_000 });
    await region.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 45_000 }).catch(() => undefined);
    await expect(region).not.toHaveAttribute('aria-busy', 'true', { timeout: 45_000 }).catch(() => undefined);
  }
}

export async function reportCatalogTitles(page: Page): Promise<string[]> {
  const titles = reportCatalogSection(page).locator('h3');
  const count = await titles.count();
  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = await titles.nth(i).innerText();
    if (text.trim()) result.push(text.trim());
  }
  return result;
}

export async function countReportCatalogCards(page: Page): Promise<number> {
  return reportCatalogSection(page).locator('h3').count();
}

export async function assertReportCatalogContains(page: Page, titlePattern: RegExp | string) {
  await expect(
    reportCatalogSection(page).getByRole('heading', { name: titlePattern, level: 3 }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function assertReportCatalogExcludes(page: Page, titlePattern: RegExp | string) {
  await expect(
    reportCatalogSection(page).getByRole('heading', { name: titlePattern, level: 3 }),
  ).toHaveCount(0);
}

export async function assertReportingAccessDenied(page: Page) {
  await expect(reportsRegion(page).getByText(/do not have permission|access denied|ليس لديك/i)).toBeVisible({
    timeout: 30_000,
  });
}

export function accessibleReportIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload: { reportId?: string; userAccessible?: boolean };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'reporting') continue;
      const reportId = ext.payload?.reportId;
      if (!reportId || HUB_REPORT_IDS.has(reportId)) continue;
      const accessible =
        typeof ext.userAccessible === 'boolean'
          ? ext.userAccessible
          : typeof ext.payload?.userAccessible === 'boolean'
            ? ext.payload.userAccessible
            : mod.userAccessible && ext.userVisible !== false;
      if (!accessible) continue;
      ids.add(reportId);
    }
  }
  return [...ids].sort();
}

export function countReportingExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  return body.modules.flatMap((mod) => mod.extensions.filter((ext) => ext.kind === 'reporting')).length;
}

export async function countRegistryBootstrapRequests(
  page: Page,
  action: () => Promise<void>,
): Promise<number> {
  let count = 0;
  const handler = (resp: { url: () => string; request: () => { method: () => string } }) => {
    if (
      resp.url().includes('/tenant/modules/registry/bootstrap') &&
      resp.request().method() === 'GET'
    ) {
      count += 1;
    }
  };
  page.on('response', handler);
  await action();
  await page.waitForTimeout(1_000);
  page.off('response', handler);
  return count;
}

export async function loginOnReportingRollbackBase(
  page: Page,
  baseUrl: string,
  credentials: { tenantId: string; email: string; password: string },
) {
  await page.goto(`${baseUrl}/login`);
  const loginForm = page.locator('form').first();
  await loginForm.waitFor({ timeout: 20_000 });
  await loginForm.locator('input[autocomplete="organization"]').fill(credentials.tenantId);
  await loginForm.locator('input[type="email"]').fill(credentials.email);
  await loginForm.locator('input[type="password"]').fill(credentials.password);
  await loginForm.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

export async function isReportingRollbackServerUp(): Promise<boolean> {
  return fetch(REPORTING_ROLLBACK_BASE, { signal: AbortSignal.timeout(10_000) })
    .then((response) => response.ok)
    .catch(() => false);
}
