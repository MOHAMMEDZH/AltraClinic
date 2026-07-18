import type { Page } from '@playwright/test';
import { DEMO_OWNER } from './demo-credentials';
import { login } from './auth';

export async function gotoAppointments(page: Page, query = '') {
  await login(page, DEMO_OWNER);
  await page.goto(`/appointments${query ? `?${query}` : ''}`);
  await page.locator('#scheduling-region').waitFor({ state: 'visible', timeout: 20_000 });
}
