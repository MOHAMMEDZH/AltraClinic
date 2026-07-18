/**
 * Phase 41e runtime delivery gate — evidence only (no architecture changes).
 *
 * Proves: intent → job → process → adapter → receipt → history
 * Proves: retry scheduling + dead_letter terminal status via non-prod force-fail metadata
 * Probes: Activity (history/attempts + process status) and Audit search (honest result)
 *
 * Requires API running with NODE_ENV=development and BACKGROUND_WORKERS_ENABLED!=false
 * so DeliveryWorkerService is initialized (manual process endpoint also exercises the same processor).
 */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const TENANT_ID = 'a1000000-0000-4000-8000-000000000001';
const OWNER = { email: 'owner@demo.clinic', password: 'Owner123!' };

const evidence = {
  startedAt: new Date().toISOString(),
  auth: {},
  happyPath: {},
  retryDeadLetter: {},
  activity: {},
  audit: {},
  errors: [],
};

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        email: OWNER.email,
        password: OWNER.password,
        tenantId: TENANT_ID,
        deviceName: 'phase41e-runtime-gate',
      }),
    });
    const loginBody = await json(loginRes);
    evidence.auth.loginStatus = loginRes.status;
    evidence.auth.loginHasAccessToken = Boolean(loginBody.accessToken);
    evidence.auth.loginHasUserId = Boolean(loginBody.userId || loginBody.user?.id);

    if (!loginRes.ok || !loginBody.accessToken) {
      throw new Error(`login failed: ${loginRes.status} ${JSON.stringify(loginBody)}`);
    }

    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginBody.accessToken}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    const me = await json(meRes);
    evidence.auth.meStatus = meRes.status;
    evidence.auth.userId = me.userId;
    if (!me.userId) throw new Error('GET /auth/me missing userId');

    const headers = {
      Authorization: `Bearer ${loginBody.accessToken}`,
      'x-tenant-id': TENANT_ID,
      'Content-Type': 'application/json',
    };

    const title = `41e-runtime-gate ${Date.now()}`;
    const createRes = await fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recipientId: me.userId,
        channel: 'in-app',
        title,
        body: 'Phase 41e runtime gate — in-app test provider only.',
        priority: 'medium',
      }),
    });
    const created = await json(createRes);
    evidence.happyPath.createStatus = createRes.status;
    evidence.happyPath.notificationId = created.notificationId;
    evidence.happyPath.intentId = created.intentId;
    if (!createRes.ok) throw new Error(`create failed: ${JSON.stringify(created)}`);

    let entry = null;
    for (let i = 0; i < 40; i++) {
      const histRes = await fetch(`${API_BASE}/notifications/communication-history?limit=25`, {
        headers,
      });
      const hist = await json(histRes);
      entry = (hist.entries || []).find((e) => e.title === title) ?? null;
      if (entry?.jobId) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    evidence.happyPath.historyFound = Boolean(entry);
    evidence.happyPath.jobId = entry?.jobId ?? null;
    evidence.happyPath.historyStatus = entry?.status ?? null;

    if (!entry?.jobId) throw new Error('communication-history missing created job');

    if (entry.status !== 'completed' || !entry.receipt) {
      const processRes = await fetch(
        `${API_BASE}/notifications/delivery-jobs/${entry.jobId}/process`,
        { method: 'POST', headers },
      );
      const processed = await json(processRes);
      evidence.happyPath.processStatusHttp = processRes.status;
      evidence.happyPath.processResult = processed;
    }

    const detailRes = await fetch(
      `${API_BASE}/notifications/communication-history/${entry.jobId}`,
      { headers },
    );
    const detail = await json(detailRes);
    evidence.happyPath.detailStatus = detailRes.status;
    evidence.happyPath.receipt = detail.receipt ?? null;
    evidence.happyPath.attempts = detail.attempts ?? [];
    evidence.happyPath.finalJobStatus = detail.status;
    evidence.activity.happyPathAttempts = detail.attempts?.length ?? 0;
    evidence.activity.happyPathReceipt = detail.receipt?.status ?? null;

    // --- Retry + dead letter via non-prod gate metadata on a dedicated job ---
    const forceIntentId = randomUUID();
    const forceMessageId = randomUUID();
    const forceJobId = randomUUID();
    const idem = `41e-gate-fail-${Date.now()}`;

    await prisma.notificationIntent.create({
      data: {
        id: forceIntentId,
        tenantId: TENANT_ID,
        recipientId: me.userId,
        requestedChannels: ['in-app'],
        idempotencyKey: idem,
        title: `41e-force-fail ${Date.now()}`,
        body: 'Controlled failure for retry/DLQ gate',
        metadata: { deliveryGateForceFail: true, deliveryEngine: '41d' },
        producerModuleId: 'phase41e.runtime-gate',
        status: 'dispatched',
      },
    });
    await prisma.notificationMessage.create({
      data: {
        id: forceMessageId,
        tenantId: TENANT_ID,
        intentId: forceIntentId,
        title: '41e-force-fail',
        body: 'Controlled failure for retry/DLQ gate',
        locale: 'en',
      },
    });
    await prisma.deliveryJob.create({
      data: {
        id: forceJobId,
        tenantId: TENANT_ID,
        intentId: forceIntentId,
        messageId: forceMessageId,
        channel: 'in-app',
        providerKey: 'in-app-inbox',
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 2,
      },
    });

    const retry1 = await fetch(`${API_BASE}/notifications/delivery-jobs/${forceJobId}/process`, {
      method: 'POST',
      headers,
    });
    const retry1Body = await json(retry1);
    const jobAfter1 = await prisma.deliveryJob.findUnique({ where: { id: forceJobId } });
    evidence.retryDeadLetter.attempt1 = {
      http: retry1.status,
      result: retry1Body,
      jobStatus: jobAfter1?.status,
      attemptCount: jobAfter1?.attemptCount,
      scheduledAt: jobAfter1?.scheduledAt,
      failureReason: jobAfter1?.failureReason,
    };

    // Clear lease / pending for second attempt
    await prisma.deliveryJob.update({
      where: { id: forceJobId },
      data: { status: 'pending', leaseExpiresAt: null, leasedAt: null },
    });

    const retry2 = await fetch(`${API_BASE}/notifications/delivery-jobs/${forceJobId}/process`, {
      method: 'POST',
      headers,
    });
    const retry2Body = await json(retry2);
    const jobAfter2 = await prisma.deliveryJob.findUnique({ where: { id: forceJobId } });
    const receiptFail = await prisma.notificationReceipt.findUnique({ where: { jobId: forceJobId } });
    const attempts = await prisma.deliveryAttempt.findMany({
      where: { jobId: forceJobId },
      orderBy: { attemptedAt: 'asc' },
    });

    evidence.retryDeadLetter.attempt2 = {
      http: retry2.status,
      result: retry2Body,
      jobStatus: jobAfter2?.status,
      attemptCount: jobAfter2?.attemptCount,
      deadLetteredAt: jobAfter2?.deadLetteredAt,
      failureReason: jobAfter2?.failureReason,
    };
    evidence.retryDeadLetter.receipt = receiptFail;
    evidence.retryDeadLetter.attempts = attempts.map((a) => ({
      success: a.success,
      error: a.error,
      providerKey: a.providerKey,
      attemptedAt: a.attemptedAt,
    }));

    evidence.activity.retryStatuses = [retry1Body?.status, retry2Body?.status];

    // Audit probe — delivery pipeline may not write Enterprise AuditEntry (Activity is SoR for delivery ops)
    const auditRes = await fetch(
      `${API_BASE}/audit/entries?resourceType=notification&limit=5`,
      { headers },
    );
    const auditBody = await json(auditRes);
    evidence.audit.searchHttp = auditRes.status;
    evidence.audit.searchBody = auditBody;
    evidence.audit.note =
      'Delivery lifecycle observability is DeliveryActivityEmitterService (kind=notification.delivery.activity). Enterprise AuditEntry is primarily for config mutations.';

    evidence.completedAt = new Date().toISOString();
    evidence.verdict = {
      happyPathDelivered:
        evidence.happyPath.receipt?.status === 'DELIVERED' ||
        evidence.happyPath.processResult?.status === 'delivered' ||
        evidence.happyPath.finalJobStatus === 'completed',
      retryScheduled:
        evidence.retryDeadLetter.attempt1?.result?.status === 'retryable' ||
        evidence.retryDeadLetter.attempt1?.jobStatus === 'pending',
      deadLetter:
        evidence.retryDeadLetter.attempt2?.result?.status === 'dead_letter' ||
        evidence.retryDeadLetter.attempt2?.jobStatus === 'dead_letter',
    };

    const outPath = new URL('./phase41e-runtime-gate-evidence.json', import.meta.url);
    writeFileSync(outPath, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    console.log(`\nWROTE ${outPath.pathname}`);

    const ok =
      evidence.verdict.happyPathDelivered &&
      evidence.verdict.retryScheduled &&
      evidence.verdict.deadLetter;
    process.exit(ok ? 0 : 2);
  } catch (err) {
    evidence.errors.push(String(err?.stack || err));
    console.error(JSON.stringify(evidence, null, 2));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
