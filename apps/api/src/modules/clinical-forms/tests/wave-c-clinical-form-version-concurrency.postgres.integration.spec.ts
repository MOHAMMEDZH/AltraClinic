/**
 * Wave C Round 6 B1 — ClinicalFormVersion publish/createDraft concurrency (PostgreSQL).
 */
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { ClinicalFormTemplateService } from '../services/clinical-form-template.service';
import { ClinicalFormVersionService } from '../services/clinical-form-version.service';

jest.setTimeout(120_000);

const describeIf = platformDbSecurityEnabled() ? describe : describe.skip;

describeIf('Wave C clinical form version concurrency (postgres)', () => {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  let templates: ClinicalFormTemplateService;
  let versions: ClinicalFormVersionService;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await prisma.tenant.create({
      data: { id: tenantId, name: 'WC Form Concurrency', slug: `wc-fc-${tenantId.slice(0, 8)}` },
    });
    const tenantContext = { resolve: async () => ({ tenantId, branchId: null, locale: 'en' }) };
    const audit = { record: async () => undefined, recordInTransaction: async () => undefined };
    templates = new ClinicalFormTemplateService(prisma as never, tenantContext as never, audit as never);
    versions = new ClinicalFormVersionService(prisma as never, tenantContext as never, audit as never);
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

  async function seedTemplate(stableKey: string) {
    const template = await templates.create({
      kind: 'CONSENT',
      stableKey,
      nameEn: stableKey,
      actorId,
    });
    return template.id;
  }

  it('concurrent publish leaves exactly one PUBLISHED version per template', async () => {
    const templateId = await seedTemplate(`conc-pub-${randomUUID().slice(0, 8)}`);
    const v2 = await versions.createDraft({
      templateId,
      contentEn: 'EN v2',
      contentAr: 'AR v2',
      actorId,
    });
    const v3 = await versions.createDraft({
      templateId,
      contentEn: 'EN v3',
      contentAr: 'AR v3',
      actorId,
    });

    await Promise.all([versions.publish(v2.id, actorId), versions.publish(v3.id, actorId)]);

    const rows = await prisma.clinicalFormVersion.findMany({
      where: { templateId },
      orderBy: { version: 'asc' },
    });
    const published = rows.filter((r) => r.status === 'PUBLISHED');
    expect(published).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'SUPERSEDED').length).toBeGreaterThanOrEqual(1);
  });

  it('concurrent createDraft allocates unique monotonic version numbers', async () => {
    const templateId = await seedTemplate(`conc-draft-${randomUUID().slice(0, 8)}`);
    const [a, b] = await Promise.all([
      versions.createDraft({ templateId, contentEn: 'A', contentAr: 'A', actorId }),
      versions.createDraft({ templateId, contentEn: 'B', contentAr: 'B', actorId }),
    ]);
    expect(a.version).not.toBe(b.version);
    expect(new Set([a.version, b.version]).size).toBe(2);
  });

  it('repeated concurrent publish races remain stable', async () => {
    for (let i = 0; i < 3; i++) {
      const templateId = await seedTemplate(`conc-repeat-${i}-${randomUUID().slice(0, 6)}`);
      const d1 = await versions.createDraft({
        templateId,
        contentEn: 'one',
        contentAr: 'one',
        actorId,
      });
      const d2 = await versions.createDraft({
        templateId,
        contentEn: 'two',
        contentAr: 'two',
        actorId,
      });
      await Promise.all([versions.publish(d1.id, actorId), versions.publish(d2.id, actorId)]);
      const publishedCount = await prisma.clinicalFormVersion.count({
        where: { templateId, status: 'PUBLISHED' },
      });
      expect(publishedCount).toBe(1);
    }
  });
});
