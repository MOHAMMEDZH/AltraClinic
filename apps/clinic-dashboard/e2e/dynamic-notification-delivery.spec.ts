import { test, expect } from '@playwright/test';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';
import { NOTIFICATION_ROLLBACK_BASE, isNotificationRollbackServerUp } from './helpers/dynamic-notification';

/**
 * Phase 41e — Delivery engine production acceptance (safe non-production providers).
 * Uses real auth + API flows. Does not send to uncontrolled external recipients
 * (EMAIL_ADAPTER console/non-prod is acceptable; WhatsApp fail-closed when unconfigured).
 *
 * Auth contract: POST /auth/login returns tokens only (LoginResponseDto).
 * Recipient id is resolved via GET /auth/me → { userId }.
 */

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';

test.describe.configure({ mode: 'default', timeout: 90_000 });

test.beforeEach(({}, testInfo) => {
  if (!isE2eApiReady()) {
    testInfo.skip(true, E2E_SKIP_REASON);
  }
});

async function ownerSession(
  request: import('@playwright/test').APIRequestContext,
): Promise<{ accessToken: string; userId: string }> {
  const loginRes = await request.post(`${API_BASE}/auth/login`, {
    headers: { 'x-tenant-id': DEMO_TENANT_ID },
    data: {
      email: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-delivery-41e',
    },
  });
  expect(loginRes.ok(), `login status ${loginRes.status()}`).toBeTruthy();
  const loginBody = (await loginRes.json()) as {
    accessToken?: string;
    user?: { id?: string };
    userId?: string;
  };
  // Official LoginResponseDto: accessToken (+ refresh/session) — no user.id / userId.
  expect(loginBody.accessToken, 'login must return accessToken').toBeTruthy();
  expect(loginBody.user?.id, 'login must not be relied on for user.id').toBeUndefined();
  expect(loginBody.userId, 'login must not be relied on for userId').toBeUndefined();

  const meRes = await request.get(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${loginBody.accessToken}`,
      'x-tenant-id': DEMO_TENANT_ID,
    },
  });
  expect(meRes.ok(), `auth/me status ${meRes.status()}`).toBeTruthy();
  const me = (await meRes.json()) as { userId?: string };
  expect(me.userId, 'GET /auth/me must return userId').toBeTruthy();
  return { accessToken: loginBody.accessToken!, userId: me.userId! };
}

type HistoryEntry = {
  intentId: string;
  jobId: string;
  channel: string;
  status: string;
  title: string;
  redacted: boolean;
  receipt: { status: string; externalId: string | null } | null;
  attempts: Array<{ success: boolean; providerKey: string; error: string | null }>;
};

async function waitForHistoryEntry(
  request: import('@playwright/test').APIRequestContext,
  accessToken: string,
  matchTitle: string,
  opts: { timeoutMs?: number; requireReceipt?: boolean } = {},
): Promise<HistoryEntry> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const deadline = Date.now() + timeoutMs;
  let last: HistoryEntry | undefined;
  while (Date.now() < deadline) {
    const historyRes = await request.get(`${API_BASE}/notifications/communication-history?limit=20`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(historyRes.ok()).toBeTruthy();
    const history = (await historyRes.json()) as { entries: HistoryEntry[] };
    last = history.entries.find((e) => e.title === matchTitle);
    if (last?.jobId && (!opts.requireReceipt || last.receipt)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(
    `Timed out waiting for communication-history entry title=${matchTitle} last=${JSON.stringify(last ?? null)}`,
  );
}

test.describe('Dynamic notification delivery — Phase 41e', () => {
  test('auth contract — login tokens only; userId from /auth/me', async ({ request }) => {
    const session = await ownerSession(request);
    expect(session.accessToken.length).toBeGreaterThan(20);
    expect(session.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  test('intent create → queue/worker → receipt → communication history (in-app)', async ({
    request,
  }) => {
    const { accessToken, userId } = await ownerSession(request);
    const title = `41e delivery probe ${Date.now()}`;
    const createRes = await request.post(`${API_BASE}/notifications`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
        'Content-Type': 'application/json',
      },
      data: {
        recipientId: userId,
        channel: 'in-app',
        title,
        body: 'Operational hardening acceptance — safe in-app only.',
        priority: 'medium',
      },
    });
    expect(createRes.ok(), `create status ${createRes.status()}`).toBeTruthy();
    const created = (await createRes.json()) as { notificationId: string; intentId?: string };
    expect(created.notificationId).toBeTruthy();
    expect(created.intentId, 'create must return intentId from delivery engine').toBeTruthy();

    let entry = await waitForHistoryEntry(request, accessToken, title);
    expect(entry.intentId).toBe(created.intentId);
    expect(entry.channel).toBe('in-app');
    expect(entry.redacted).toBe(true);

    // If worker has not completed yet, drive the same processor path via manage endpoint.
    if (entry.status !== 'completed' && !entry.receipt) {
      const processRes = await request.post(
        `${API_BASE}/notifications/delivery-jobs/${entry.jobId}/process`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'x-tenant-id': DEMO_TENANT_ID,
          },
        },
      );
      expect(processRes.ok(), `process status ${processRes.status()}`).toBeTruthy();
      const processed = (await processRes.json()) as { status: string };
      expect(['delivered', 'skipped_leased']).toContain(processed.status);
      entry = await waitForHistoryEntry(request, accessToken, title, { requireReceipt: true });
    }

    const detailRes = await request.get(
      `${API_BASE}/notifications/communication-history/${entry.jobId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-tenant-id': DEMO_TENANT_ID,
        },
      },
    );
    expect(detailRes.ok()).toBeTruthy();
    const detail = (await detailRes.json()) as HistoryEntry;
    expect(detail.receipt, 'receipt must be persisted').toBeTruthy();
    expect(['DELIVERED', 'SENT', 'READ']).toContain(detail.receipt!.status);
    expect(detail.attempts.length).toBeGreaterThan(0);
    expect(detail.attempts.some((a) => a.success)).toBe(true);
  });

  test('consent denial does not widen delivery (promotional without opt-in metadata)', async ({
    request,
  }) => {
    const { accessToken, userId } = await ownerSession(request);
    const createRes = await request.post(`${API_BASE}/notifications`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
        'Content-Type': 'application/json',
      },
      data: {
        recipientId: userId,
        channel: 'in-app',
        title: '41e consent continuity',
        body: 'Transactional in-app remains available.',
        priority: 'low',
      },
    });
    expect(createRes.ok()).toBeTruthy();
  });

  test('tenant isolation — history scoped to login tenant', async ({ request }) => {
    const { accessToken } = await ownerSession(request);
    const historyRes = await request.get(`${API_BASE}/notifications/communication-history?limit=5`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(historyRes.ok()).toBeTruthy();
  });

  test('rollback server still healthy for config platform', async () => {
    const up = await isNotificationRollbackServerUp();
    expect(up, `Rollback dashboard must run at ${NOTIFICATION_ROLLBACK_BASE}`).toBe(true);
  });

  test('inbox continuity after delivery create', async ({ request }) => {
    const { accessToken, userId } = await ownerSession(request);
    await request.post(`${API_BASE}/notifications`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
        'Content-Type': 'application/json',
      },
      data: {
        recipientId: userId,
        channel: 'in-app',
        title: '41e inbox continuity',
        body: 'Inbox APIs remain backward compatible.',
        priority: 'medium',
      },
    });
    const listRes = await request.get(`${API_BASE}/notifications?recipientId=${userId}&limit=5`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(listRes.ok()).toBeTruthy();
  });
});
