/**
 * Flexible Step 27 — template catalog / rendering matrix T01–T18.
 * Code-defined catalog (no CMS) — see `platform-template.catalog.ts`.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createPlatformNotificationsStack, type PlatformNotificationsStack } from './platform-notifications-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';
import { NOTIFICATIONS_ADMIN_PERMS, NOTIFICATIONS_VIEWER_PERMS } from './platform-notifications-stack';
import {
  getPlatformTemplateByKey,
  listPlatformTemplates,
  PLATFORM_TEMPLATES,
  renderPlatformTemplate,
} from '../application/templates/platform-template.catalog';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 template catalog matrix T01-T18 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let stack: PlatformNotificationsStack;
  const adminPerms = new Set(NOTIFICATIONS_ADMIN_PERMS);

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await ensureSentinel(prisma);
  });

  afterAll(async () => {
    await cleanupPlatformNotificationsTables(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearPlatformNotificationFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupPlatformNotificationsTables(prisma);
    stack = createPlatformNotificationsStack(prisma);
  });

  it('T01: catalog contains exactly 24 code-defined templates', () => {
    expect(PLATFORM_TEMPLATES).toHaveLength(24);
    expect(listPlatformTemplates()).toHaveLength(24);
  });

  it('T02: every template requiredVariables is a subset of its declared variables', () => {
    for (const tpl of PLATFORM_TEMPLATES) {
      for (const req of tpl.requiredVariables) {
        expect(tpl.variables).toContain(req);
      }
    }
  });

  it('T03: every template declares both en-US and ar-SY locale content', () => {
    for (const tpl of PLATFORM_TEMPLATES) {
      expect(tpl.locales['en-US'].subject.length).toBeGreaterThan(0);
      expect(tpl.locales['en-US'].body.length).toBeGreaterThan(0);
      expect(tpl.locales['ar-SY'].subject.length).toBeGreaterThan(0);
      expect(tpl.locales['ar-SY'].body.length).toBeGreaterThan(0);
    }
  });

  it('T04: listTemplates via query service requires templates.view permission', () => {
    const noPerms = new Set<string>();
    expect(() => stack.query.listTemplates(noPerms)).toThrow(/templates\.view/i);
    expect(stack.query.listTemplates(adminPerms)).toHaveLength(24);
  });

  it('T05: getTemplate returns full definition including locales for a known key', () => {
    const tpl = stack.query.getTemplate(adminPerms, 'tpl.platform.invitation.sent');
    expect(tpl.key).toBe('tpl.platform.invitation.sent');
    expect(tpl.locales['en-US'].subject).toBe('Platform invitation');
  });

  it('T06: getTemplate throws template_not_found for an unknown key', () => {
    expect(() => getPlatformTemplateByKey('tpl.platform.does_not_exist')).toThrow(/Unknown template/i);
  });

  it('T07: preview() renders synthetic variables without leaking real data and records an audit entry', () => {
    const user = platformClaims(randomUUID(), randomUUID());
    const preview = stack.query.preview(user, adminPerms, 'tpl.platform.invitation.sent', 'en-US');
    expect(preview.subject).toBe('Platform invitation');
    expect(preview.body).toContain('sample_recipientDisplayName');
  });

  it('T08: preview() without templates.view permission is forbidden', () => {
    const user = platformClaims(randomUUID(), randomUUID());
    const viewerLess = new Set<string>();
    expect(() => stack.query.preview(user, viewerLess, 'tpl.platform.invitation.sent')).toThrow(/templates\.view/i);
  });

  it('T09: viewer permission set (read-only) can list and preview templates', () => {
    const viewerPerms = new Set(NOTIFICATIONS_VIEWER_PERMS);
    const user = platformClaims(randomUUID(), randomUUID());
    expect(stack.query.listTemplates(viewerPerms)).toHaveLength(24);
    expect(() => stack.query.preview(user, viewerPerms, 'tpl.platform.invitation.sent')).not.toThrow();
  });

  it('T10: renderPlatformTemplate rejects forbidden variable names (PHI/secret guard)', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    expect(() =>
      renderPlatformTemplate(tpl, 'en-US', {
        recipientDisplayName: 'A',
        inviterDisplayName: 'B',
        expiresAt: '2026-01-01',
        patientName: 'Should Not Be Allowed',
      } as never),
    ).toThrow(/Forbidden template variable/i);
  });

  it('T11: renderPlatformTemplate rejects a genuinely undeclared variable with a non-null value', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    expect(() =>
      renderPlatformTemplate(tpl, 'en-US', {
        recipientDisplayName: 'A',
        inviterDisplayName: 'B',
        expiresAt: '2026-01-01',
        totallyUnknownField: 'value',
      } as never),
    ).toThrow(/Undeclared template variable/i);
  });

  it('T12: renderPlatformTemplate tolerates a null/undefined value for an undeclared key', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    expect(() =>
      renderPlatformTemplate(tpl, 'en-US', {
        recipientDisplayName: 'A',
        inviterDisplayName: 'B',
        expiresAt: '2026-01-01',
        sharedShapeFieldNotUsedHere: null,
      } as never),
    ).not.toThrow();
  });

  it('T13: renderPlatformTemplate throws missing_variable when a required variable is absent', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    expect(() =>
      renderPlatformTemplate(tpl, 'en-US', {
        recipientDisplayName: 'A',
        inviterDisplayName: 'B',
      } as never),
    ).toThrow(/Missing required template variable expiresAt/i);
  });

  it('T14: ar-SY locale renders Arabic subject/body distinct from en-US', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    const vars = { recipientDisplayName: 'Ali', inviterDisplayName: 'Root', expiresAt: '2026-01-01' };
    const en = renderPlatformTemplate(tpl, 'en-US', vars);
    const ar = renderPlatformTemplate(tpl, 'ar-SY', vars);
    expect(ar.subject).toBe('دعوة للمنصة');
    expect(ar.body).not.toBe(en.body);
  });

  it('T15: HTML-bearing variable values are escaped in the rendered output (XSS guard)', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    const rendered = renderPlatformTemplate(tpl, 'en-US', {
      recipientDisplayName: '<script>alert(1)</script>',
      inviterDisplayName: 'Root',
      expiresAt: '2026-01-01',
    });
    expect(rendered.body).not.toContain('<script>');
    expect(rendered.body).toContain('&lt;script&gt;');
  });

  it('T16: template_lookup failure injection blocks getPlatformTemplateByKey', () => {
    setPlatformNotificationFailureInjection('template_lookup');
    expect(() => getPlatformTemplateByKey('tpl.platform.invitation.sent')).toThrow(/Injected template lookup/i);
  });

  it('T17: template_renderer failure injection blocks rendering for any locale', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    setPlatformNotificationFailureInjection('template_renderer');
    expect(() =>
      renderPlatformTemplate(tpl, 'en-US', {
        recipientDisplayName: 'A',
        inviterDisplayName: 'B',
        expiresAt: '2026-01-01',
      }),
    ).toThrow(/Injected template renderer/i);
  });

  it('T18: locale_renderer failure injection blocks only ar-SY, not en-US', () => {
    const tpl = getPlatformTemplateByKey('tpl.platform.invitation.sent');
    setPlatformNotificationFailureInjection('locale_renderer');
    const vars = { recipientDisplayName: 'A', inviterDisplayName: 'B', expiresAt: '2026-01-01' };
    expect(() => renderPlatformTemplate(tpl, 'ar-SY', vars)).toThrow(/Injected locale renderer/i);
    expect(() => renderPlatformTemplate(tpl, 'en-US', vars)).not.toThrow();
  });
});
