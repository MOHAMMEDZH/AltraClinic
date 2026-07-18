import type { Locator, Page } from '@playwright/test';

/** Seeded demo patient with an active queue ticket (Sarah Hassan). */
export const DEMO_SARAH_PATIENT_ID = 'b1000000-0000-4000-8000-000000000001';

/** Patient name from a table row link (excludes avatar initials). */
export async function patientNameFromRowLink(link: Locator): Promise<string> {
  const nested = link.locator('span span').first();
  if ((await nested.count()) > 0) {
    return (await nested.textContent())?.trim() ?? '';
  }
  return (await link.textContent())?.trim() ?? '';
}

export async function gotoPatientDetail(page: Page, patientId: string, tab?: string) {
  const query = tab ? `?tab=${tab}` : '';
  const detailResponse = page.waitForResponse(
    (resp) => resp.url().includes(`/patients/${patientId}`) && resp.request().method() === 'GET',
    { timeout: 20_000 },
  );
  await page.goto(`/patients/${patientId}${query}`);
  await detailResponse;
  await page.locator('#patients-detail-region').waitFor({ state: 'visible', timeout: 15_000 });
}
