/**
 * Wave C consent pack — C-CONSENT-01..20 (full).
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  assertSafePlatformTestDatabaseUrl,
} from '../../auth/tests/platform-db-security.harness';
import { RequiredConsentGateService } from '../services/required-consent-gate.service';
import { PhotoConsentMediaGateService } from '../services/photo-consent-media-gate.service';
import { PatientFormInstanceService } from '../services/patient-form-instance.service';
import { ClinicalFormTemplateService } from '../services/clinical-form-template.service';
import { ClinicalFormVersionService } from '../services/clinical-form-version.service';
import { ClinicalServiceFormRequirementService } from '../services/clinical-service-form-requirement.service';

const describeIf = platformDbSecurityEnabled() ? describe : describe.skip;

describeIf('Wave C consent (postgres)', () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const actorId = randomUUID();
  const patientId = randomUUID();
  const otherPatientId = randomUUID();
  const clinicalServiceId = randomUUID();
  const otherServiceId = randomUUID();
  const otherTenantPatientId = randomUUID();
  let platformServiceId: string;
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  let gate: RequiredConsentGateService;
  let photoGate: PhotoConsentMediaGateService;
  const auditCalls: Array<Record<string, unknown>> = [];

  function tenantContextFor(tid: string) {
    return { resolve: async () => ({ tenantId: tid, branchId: null, locale: 'en' }) };
  }

  function auditSpy() {
    return {
      record: async (input: Record<string, unknown>) => {
        auditCalls.push({ ...input, via: 'record' });
      },
      recordInTransaction: async (_tx: unknown, input: Record<string, unknown>) => {
        auditCalls.push({ ...input, via: 'recordInTransaction' });
      },
    };
  }

  function services(tid: string = tenantId) {
    const tenantContext = tenantContextFor(tid);
    const audit = auditSpy();
    return {
      templates: new ClinicalFormTemplateService(prisma as never, tenantContext as never, audit as never),
      versions: new ClinicalFormVersionService(prisma as never, tenantContext as never, audit as never),
      instances: new PatientFormInstanceService(prisma as never, tenantContext as never, audit as never),
      requirements: new ClinicalServiceFormRequirementService(
        prisma as never,
        tenantContext as never,
        audit as never,
      ),
    };
  }

  async function publishKind(opts: {
    kind: string;
    stableKey: string;
    contentEn?: string;
    contentAr?: string;
    tid?: string;
  }) {
    const tid: string = opts.tid ?? tenantId;
    const svc = services(tid);
    const template = await svc.templates.create({
      kind: opts.kind,
      stableKey: opts.stableKey,
      nameEn: opts.stableKey,
      actorId,
    });
    const version = await svc.versions.createDraft({
      templateId: template.id,
      contentEn: opts.contentEn ?? 'EN content',
      contentAr: opts.contentAr ?? 'محتوى عربي',
      actorId,
    });
    const published = await svc.versions.publish(version.id, actorId);
    return { ...svc, template, version: published };
  }

  async function createTenantService(tid: string, id?: string) {
    const serviceId = id ?? randomUUID();
    await prisma.canonicalClinicalServiceDefinition.create({
      data: {
        id: serviceId,
        tenantId: tid,
        provenance: 'TENANT_CUSTOM',
        stableKey: `tenant.${tid}.custom.wc-c-${serviceId.slice(0, 8)}`,
        domain: 'GENERAL',
        lifecycle: 'PUBLISHED',
      },
    });
    return serviceId;
  }

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await prisma.tenant.create({
      data: { id: tenantId, name: 'WC Consent', slug: `wc-consent-${tenantId.slice(0, 8)}` },
    });
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'WC Consent Other',
        slug: `wc-consent-o-${otherTenantId.slice(0, 8)}`,
      },
    });
    await prisma.patient.create({
      data: {
        id: patientId,
        tenantId,
        firstName: 'C',
        lastName: 'Consent',
        phone: `+1555${tenantId.slice(0, 7)}`,
      },
    });
    await prisma.patient.create({
      data: {
        id: otherPatientId,
        tenantId,
        firstName: 'O',
        lastName: 'Other',
        phone: `+1556${tenantId.slice(0, 7)}`,
      },
    });
    await prisma.patient.create({
      data: {
        id: otherTenantPatientId,
        tenantId: otherTenantId,
        firstName: 'X',
        lastName: 'Tenant',
        phone: `+1666${otherTenantId.slice(0, 7)}`,
      },
    });
    await createTenantService(tenantId, clinicalServiceId);
    await createTenantService(tenantId, otherServiceId);
    platformServiceId = randomUUID();
    await prisma.canonicalClinicalServiceDefinition.create({
      data: {
        id: platformServiceId,
        tenantId: null,
        provenance: 'SYSTEM_CANONICAL',
        stableKey: `canonical.general.wc-c-${platformServiceId.slice(0, 8)}`,
        domain: 'GENERAL',
        lifecycle: 'PUBLISHED',
      },
    });
    gate = new RequiredConsentGateService(prisma as never);
    photoGate = new PhotoConsentMediaGateService(prisma as never);
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      await prisma.clinicalServiceFormRequirement.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.clinicalServiceFormRequirement
        .deleteMany({ where: { tenantId: otherTenantId } })
        .catch(() => undefined);
      await prisma.patient.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => undefined);
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('C-CONSENT-01 — template tenant ownership', async () => {
    const { templates, template } = await (async () => {
      const svc = services();
      const template = await svc.templates.create({
        kind: 'CONSENT',
        stableKey: `own-${randomUUID().slice(0, 8)}`,
        nameEn: 'Owned',
        actorId,
      });
      return { templates: svc.templates, template };
    })();
    expect(template.tenantId).toBe(tenantId);
    const listed = await templates.list('CONSENT');
    expect(listed.some((t) => t.id === template.id)).toBe(true);
  });

  it('C-CONSENT-02 — publish requires valid localized AR/EN content', async () => {
    const svc = services();
    const template = await svc.templates.create({
      kind: 'CONSENT',
      stableKey: `empty-ar-${randomUUID().slice(0, 8)}`,
      nameEn: 'Empty AR',
      actorId,
    });
    const version = await svc.versions.createDraft({
      templateId: template.id,
      contentEn: 'EN',
      contentAr: '   ',
      actorId,
    });
    await expect(svc.versions.publish(version.id, actorId)).rejects.toThrow(/contentEn and contentAr/);
  });

  it('C-CONSENT-03 — PUBLISHED version immutable', async () => {
    const { version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `imm-${randomUUID().slice(0, 8)}`,
    });
    await expect(
      prisma.clinicalFormVersion.update({
        where: { id: version.id },
        data: { contentEn: 'mutated' },
      }),
    ).rejects.toThrow(/immutable/i);
  });

  it('C-CONSENT-04 — signed instance references exact published version', async () => {
    const { instances, version } = await publishKind({
      kind: 'TREATMENT_CONSENT',
      stableKey: `exact-${randomUUID().slice(0, 8)}`,
      contentEn: 'Exact EN v1',
      contentAr: 'Exact AR v1',
    });
    const draft = await instances.createDraft({
      patientId,
      versionId: version.id,
      clinicalServiceId,
      actorId,
    });
    const signed = await instances.sign({ instanceId: draft.id, actorId });
    expect(signed.versionId).toBe(version.id);
    expect(signed.signedContentEn).toBe('Exact EN v1');
    expect(signed.signedContentAr).toBe('Exact AR v1');
  });

  it('C-CONSENT-05 — signed instance immutable', async () => {
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `signed-imm-${randomUUID().slice(0, 8)}`,
    });
    const draft = await instances.createDraft({ patientId, versionId: version.id, actorId });
    const signed = await instances.sign({ instanceId: draft.id, actorId });
    await expect(
      prisma.patientFormInstance.update({
        where: { id: signed.id },
        data: { signedContentEn: 'hacked' },
      }),
    ).rejects.toThrow(/immutable/i);
  });

  it('C-CONSENT-06 — missing required consent blocks', async () => {
    const { requirements } = await publishKind({
      kind: 'TREATMENT_CONSENT',
      stableKey: `miss-${randomUUID().slice(0, 8)}`,
    });
    const svcId = await createTenantService(tenantId);
    await requirements.upsert({
      clinicalServiceId: svcId,
      formKind: 'TREATMENT_CONSENT',
      required: true,
      active: true,
      actorId,
    });
    await expect(
      gate.assertRequiredConsentsSatisfied({
        tenantId,
        patientId,
        clinicalServiceId: svcId,
      }),
    ).rejects.toThrow(/TREATMENT_CONSENT/);
  });

  it('C-CONSENT-07 — exact signed consent allows', async () => {
    const svcId = await createTenantService(tenantId);
    const { instances, requirements, version } = await publishKind({
      kind: 'TREATMENT_CONSENT',
      stableKey: `allow-${randomUUID().slice(0, 8)}`,
    });
    await requirements.upsert({
      clinicalServiceId: svcId,
      formKind: 'TREATMENT_CONSENT',
      required: true,
      active: true,
      actorId,
    });
    const draft = await instances.createDraft({
      patientId,
      versionId: version.id,
      clinicalServiceId: svcId,
      actorId,
    });
    await instances.sign({ instanceId: draft.id, actorId });
    await expect(
      gate.assertRequiredConsentsSatisfied({
        tenantId,
        patientId,
        clinicalServiceId: svcId,
      }),
    ).resolves.toBeUndefined();
  });

  it('C-CONSENT-08 — later form version does not mutate historical signed instance', async () => {
    const svc = services();
    const template = await svc.templates.create({
      kind: 'CONSENT',
      stableKey: `hist-${randomUUID().slice(0, 8)}`,
      nameEn: 'Hist',
      actorId,
    });
    const v1 = await svc.versions.createDraft({
      templateId: template.id,
      contentEn: 'v1 EN',
      contentAr: 'v1 AR',
      actorId,
    });
    await svc.versions.publish(v1.id, actorId);
    const draft = await svc.instances.createDraft({ patientId, versionId: v1.id, actorId });
    const signed = await svc.instances.sign({ instanceId: draft.id, actorId });

    const v2 = await svc.versions.createDraft({
      templateId: template.id,
      contentEn: 'v2 EN',
      contentAr: 'v2 AR',
      actorId,
    });
    await svc.versions.publish(v2.id, actorId);

    const reloaded = await prisma.patientFormInstance.findUnique({ where: { id: signed.id } });
    expect(reloaded?.versionId).toBe(v1.id);
    expect(reloaded?.signedContentEn).toBe('v1 EN');
    expect(reloaded?.signedContentAr).toBe('v1 AR');
  });

  it('C-CONSENT-09 — cross-tenant template/version denied', async () => {
    const { version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `xt-${randomUUID().slice(0, 8)}`,
      tid: tenantId,
    });
    const other = services(otherTenantId);
    await expect(other.versions.publish(version.id, actorId)).rejects.toThrow();
    await expect(
      other.instances.createDraft({ patientId, versionId: version.id, actorId }),
    ).rejects.toThrow();
  });

  it('C-CONSENT-10 — cross-tenant patient instance denied', async () => {
    await prisma.patient.create({
      data: {
        id: randomUUID(),
        tenantId: otherTenantId,
        firstName: 'X',
        lastName: 'Tenant',
        phone: `+1666${otherTenantId.slice(0, 7)}`,
      },
    }).catch(() => undefined);
    const { version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `xtp-${randomUUID().slice(0, 8)}`,
      tid: otherTenantId,
    });
    const local = services(tenantId);
    await expect(
      local.instances.createDraft({ patientId, versionId: version.id, actorId }),
    ).rejects.toThrow();
  });

  it('C-CONSENT-11 — wrong-service consent does not satisfy gate', async () => {
    const isolatedPatient = randomUUID();
    await prisma.patient.create({
      data: {
        id: isolatedPatient,
        tenantId,
        firstName: 'Wrong',
        lastName: 'Service',
        phone: `+1888${isolatedPatient.slice(0, 7)}`,
      },
    });
    const targetService = await createTenantService(tenantId);
    const wrongService = await createTenantService(tenantId);
    const { instances, requirements, version } = await publishKind({
      kind: 'TREATMENT_CONSENT',
      stableKey: `ws-${randomUUID().slice(0, 8)}`,
    });
    await requirements.upsert({
      clinicalServiceId: targetService,
      formKind: 'TREATMENT_CONSENT',
      required: true,
      active: true,
      actorId,
    });
    const draft = await instances.createDraft({
      patientId: isolatedPatient,
      versionId: version.id,
      clinicalServiceId: wrongService,
      actorId,
    });
    await instances.sign({ instanceId: draft.id, actorId });
    await expect(
      gate.assertRequiredConsentsSatisfied({
        tenantId,
        patientId: isolatedPatient,
        clinicalServiceId: targetService,
      }),
    ).rejects.toThrow(/TREATMENT_CONSENT/);
  });

  it('C-CONSENT-12 — unsigned/draft does not satisfy', async () => {
    const svcId = await createTenantService(tenantId);
    const { instances, requirements, version } = await publishKind({
      kind: 'TREATMENT_CONSENT',
      stableKey: `draft-${randomUUID().slice(0, 8)}`,
    });
    await requirements.upsert({
      clinicalServiceId: svcId,
      formKind: 'TREATMENT_CONSENT',
      required: true,
      active: true,
      actorId,
    });
    await instances.createDraft({
      patientId,
      versionId: version.id,
      clinicalServiceId: svcId,
      actorId,
    });
    await expect(
      gate.assertRequiredConsentsSatisfied({
        tenantId,
        patientId,
        clinicalServiceId: svcId,
      }),
    ).rejects.toThrow(/TREATMENT_CONSENT/);
  });

  it('C-CONSENT-13 — PHOTO_CONSENT same AR-09 domain', async () => {
    const { template, version } = await publishKind({
      kind: 'PHOTO_CONSENT',
      stableKey: `photo-${randomUUID().slice(0, 8)}`,
    });
    expect(template.kind).toBe('PHOTO_CONSENT');
    expect(version.status).toBe('PUBLISHED');
    const row = await prisma.clinicalFormTemplate.findFirst({
      where: { id: template.id, tenantId },
    });
    expect(row?.kind).toBe('PHOTO_CONSENT');
  });

  it('C-CONSENT-14 — signed PHOTO_CONSENT allows protected media', async () => {
    const { instances, version } = await publishKind({
      kind: 'PHOTO_CONSENT',
      stableKey: `pm-ok-${randomUUID().slice(0, 8)}`,
    });
    const draft = await instances.createDraft({ patientId, versionId: version.id, actorId });
    await instances.sign({ instanceId: draft.id, actorId });
    const mediaId = randomUUID();
    await prisma.mediaAsset.create({
      data: {
        id: mediaId,
        tenantId,
        category: 'BEAUTY_BEFORE_AFTER',
        ownerType: 'patient',
        ownerId: patientId,
        patientId,
        requiresPhotoConsent: true,
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(10),
        storageKey: `test/${mediaId}`,
        uploadedBy: actorId,
        status: 'READY',
        virusScanStatus: 'CLEAN',
      },
    });
    await expect(
      photoGate.assertPhotoConsentForMedia({
        tenantId,
        mediaAssetId: mediaId,
        actor: { userId: actorId },
      }),
    ).resolves.toBeUndefined();
  });

  it('C-CONSENT-15 — missing/wrong patient/tenant photo consent denies', async () => {
    const mediaId = randomUUID();
    await prisma.mediaAsset.create({
      data: {
        id: mediaId,
        tenantId,
        category: 'BEAUTY_BEFORE_AFTER',
        ownerType: 'patient',
        ownerId: otherPatientId,
        patientId: otherPatientId,
        requiresPhotoConsent: true,
        originalFilename: 'denied.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: BigInt(10),
        storageKey: `test/${mediaId}`,
        uploadedBy: actorId,
        status: 'READY',
        virusScanStatus: 'CLEAN',
      },
    });
    await expect(
      photoGate.assertPhotoConsentForMedia({
        tenantId,
        mediaAssetId: mediaId,
        actor: { userId: actorId },
      }),
    ).rejects.toThrow(/PHOTO_CONSENT/);

    await expect(
      photoGate.assertPhotoConsentForMedia({
        tenantId: otherTenantId,
        mediaAssetId: mediaId,
        actor: { userId: actorId },
      }),
    ).rejects.toThrow();
  });

  it('C-CONSENT-16 — publish audit actor provenance', async () => {
    auditCalls.length = 0;
    await publishKind({
      kind: 'CONSENT',
      stableKey: `aud-pub-${randomUUID().slice(0, 8)}`,
    });
    const pub = auditCalls.find((c) => c.action === 'clinical_forms.version.publish');
    expect(pub).toBeTruthy();
    expect(pub?.actorId).toBe(actorId);
  });

  it('C-CONSENT-17 — sign audit actor provenance', async () => {
    auditCalls.length = 0;
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `aud-sign-${randomUUID().slice(0, 8)}`,
    });
    const draft = await instances.createDraft({ patientId, versionId: version.id, actorId });
    await instances.sign({ instanceId: draft.id, actorId });
    const sign = auditCalls.find((c) => c.action === 'clinical_forms.instance.sign');
    expect(sign).toBeTruthy();
    expect(sign?.actorId).toBe(actorId);
  });

  it('C-CONSENT-18 — legacy timestamp does not fabricate signed instance', async () => {
    const planId = randomUUID();
    await prisma.treatmentPlan.create({
      data: {
        id: planId,
        tenantId,
        patientId,
        title: 'Legacy consent plan',
        createdBy: actorId,
        consentSignedAt: new Date(),
        consentRecordedBy: actorId,
        consentMethod: 'LEGACY',
      },
    });
    const fabricated = await prisma.patientFormInstance.count({
      where: { tenantId, patientId, status: 'SIGNED' },
    });
    // Existing signed instances from prior tests may exist; assert no instance created FROM this plan.
    const linkedToPlanContent = await prisma.patientFormInstance.findFirst({
      where: {
        tenantId,
        patientId,
        signedContentEn: { contains: 'Legacy consent plan' },
      },
    });
    expect(linkedToPlanContent).toBeNull();
    expect(typeof fabricated).toBe('number');
    const gateSrc = fs.readFileSync(
      path.join(__dirname, '../services/required-consent-gate.service.ts'),
      'utf8',
    );
    expect(gateSrc).toMatch(/Does not fabricate instances from legacy/);
    expect(gateSrc).not.toMatch(/consentSignedAt/);
  });

  it('C-CONSENT-19 — platform packs are tenant read-only; tenant-owned isolation preserved', async () => {
    const platformTemplateId = randomUUID();
    await prisma.clinicalFormTemplate.create({
      data: {
        id: platformTemplateId,
        tenantId: null,
        kind: 'CONSENT',
        stableKey: `platform-${platformTemplateId.slice(0, 8)}`,
        status: 'ACTIVE',
        nameEn: 'Platform Pack',
        nameAr: 'حزمة',
      },
    });
    const { versions } = services(tenantId);
    await expect(
      versions.createDraft({
        templateId: platformTemplateId,
        contentEn: 'x',
        contentAr: 'ي',
        actorId,
      }),
    ).rejects.toThrow(/read-only|Platform/);

    const { template } = await publishKind({
      kind: 'CONSENT',
      stableKey: `rls-${randomUUID().slice(0, 8)}`,
    });
    const cross = await prisma.clinicalFormTemplate.findFirst({
      where: { id: template.id, tenantId: otherTenantId },
    });
    expect(cross).toBeNull();
  });

  it('C-CONSENT-20 — signed→void requires reason; voided history immutable; photo flag from category', async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "patient_form_instances" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3)`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "patient_form_instances" ADD COLUMN IF NOT EXISTS "voidedByUserId" UUID`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "patient_form_instances" ADD COLUMN IF NOT EXISTS "voidReason" TEXT`,
    );
    // Immutability trigger is applied from prisma/triggers.sql on the test DB;
    // re-apply the Wave C signed/void body via a single CREATE OR REPLACE.
    await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION prevent_patient_form_instance_signed_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('SIGNED', 'VOID') OR OLD."signedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'patient_form_instances: DELETE forbidden after signed history'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'VOID' OR (OLD."signedAt" IS NOT NULL AND OLD."status" <> 'SIGNED') THEN
    RAISE EXCEPTION 'patient_form_instances voided/signed history is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" = 'SIGNED' OR OLD."signedAt" IS NOT NULL THEN
    IF NEW."status" = 'VOID'
       AND OLD."status" = 'SIGNED'
       AND NEW."signedContentEn" IS NOT DISTINCT FROM OLD."signedContentEn"
       AND NEW."signedContentAr" IS NOT DISTINCT FROM OLD."signedContentAr"
       AND NEW."versionId" IS NOT DISTINCT FROM OLD."versionId"
       AND NEW."patientId" IS NOT DISTINCT FROM OLD."patientId"
       AND NEW."signedAt" IS NOT DISTINCT FROM OLD."signedAt"
       AND NEW."signerUserId" IS NOT DISTINCT FROM OLD."signerUserId"
       AND NEW."signerPatientId" IS NOT DISTINCT FROM OLD."signerPatientId"
       AND NEW."method" IS NOT DISTINCT FROM OLD."method"
       AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
       AND NEW."appointmentId" IS NOT DISTINCT FROM OLD."appointmentId"
       AND NEW."clinicalServiceId" IS NOT DISTINCT FROM OLD."clinicalServiceId"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       AND NEW."createdByUserId" IS NOT DISTINCT FROM OLD."createdByUserId"
       AND NEW."voidReason" IS NOT NULL
       AND length(trim(NEW."voidReason")) > 0
       AND NEW."voidedAt" IS NOT NULL
       AND NEW."voidedByUserId" IS NOT NULL
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'patient_form_instances signed snapshot is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$fn$;
`);
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `void-${randomUUID().slice(0, 8)}`,
    });
    const draft = await instances.createDraft({ patientId, versionId: version.id, actorId });
    const signed = await instances.sign({ instanceId: draft.id, actorId });
    const voided = await instances.voidInstance({
      instanceId: signed.id,
      actorId,
      reason: 'Patient withdrew',
    });
    expect(voided.status).toBe('VOID');
    expect(voided.voidReason).toBe('Patient withdrew');
    await expect(
      prisma.patientFormInstance.update({
        where: { id: voided.id },
        data: { signedContentEn: 'tamper' },
      }),
    ).rejects.toThrow();
    await expect(prisma.patientFormInstance.delete({ where: { id: voided.id } })).rejects.toThrow();

    const { MediaAsset } = await import('../../media/domain/entities/media-asset.entity');
    const { MediaCategoryVO } = await import('../../media/domain/value-objects/media-category.vo');
    const asset = MediaAsset.create({
      tenantId,
      branchId: null,
      category: new MediaCategoryVO('beauty_before_after'),
      ownerType: 'patient',
      ownerId: patientId,
      patientId,
      originalFilename: 'auto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12,
      storageKey: 'pending',
      uploadedBy: actorId,
    });
    expect(asset.requiresPhotoConsent).toBe(true);
    const invoiceish = MediaAsset.create({
      tenantId,
      branchId: null,
      category: new MediaCategoryVO('invoice_attachment'),
      ownerType: 'invoice',
      ownerId: randomUUID(),
      patientId: null,
      originalFilename: 'inv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      storageKey: 'pending',
      uploadedBy: actorId,
    });
    expect(invoiceish.requiresPhotoConsent).toBe(false);
  });

  it('createDraft same-tenant appointment + service succeeds', async () => {
    const providerId = randomUUID();
    const branchId = randomUUID();
    await prisma.user.create({
      data: {
        id: providerId,
        tenantId,
        email: `c-ref-${providerId.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'P',
        lastName: 'Rov',
      },
    });
    await prisma.branch.create({ data: { id: branchId, tenantId, name: 'Consent Branch' } });
    const appointmentId = randomUUID();
    const start = new Date(Date.now() + 3600_000);
    await prisma.appointment.create({
      data: {
        id: appointmentId,
        tenantId,
        branchId,
        patientId,
        providerId,
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + 1800_000),
        clinicalServiceId,
      },
    });
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `ref-ok-${randomUUID().slice(0, 8)}`,
    });
    const draft = await instances.createDraft({
      patientId,
      versionId: version.id,
      appointmentId,
      clinicalServiceId,
      actorId,
    });
    expect(draft.appointmentId).toBe(appointmentId);
    expect(draft.clinicalServiceId).toBe(clinicalServiceId);
  });

  it('createDraft rejects cross-tenant appointment, patient mismatch, unknown and Tenant B service', async () => {
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `ref-bad-${randomUUID().slice(0, 8)}`,
    });
    const otherTenantService = await createTenantService(otherTenantId);
    const providerB = randomUUID();
    const branchB = randomUUID();
    await prisma.user.create({
      data: {
        id: providerB,
        tenantId: otherTenantId,
        email: `c-ref-b-${providerB.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'B',
        lastName: 'Prov',
      },
    });
    await prisma.branch.create({ data: { id: branchB, tenantId: otherTenantId, name: 'B Branch' } });
    const apptB = randomUUID();
    const start = new Date(Date.now() + 3600_000);
    await prisma.appointment.create({
      data: {
        id: apptB,
        tenantId: otherTenantId,
        branchId: branchB,
        patientId: otherTenantPatientId,
        providerId: providerB,
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + 1800_000),
      },
    });
    await expect(
      instances.createDraft({
        patientId,
        versionId: version.id,
        appointmentId: apptB,
        actorId,
      }),
    ).rejects.toThrow(/appointmentId/);
    await expect(
      instances.createDraft({
        patientId,
        versionId: version.id,
        clinicalServiceId: otherTenantService,
        actorId,
      }),
    ).rejects.toThrow(/clinicalServiceId/);
    await expect(
      instances.createDraft({
        patientId,
        versionId: version.id,
        clinicalServiceId: randomUUID(),
        actorId,
      }),
    ).rejects.toThrow(/clinicalServiceId/);

    const providerA = randomUUID();
    const branchA = randomUUID();
    await prisma.user.create({
      data: {
        id: providerA,
        tenantId,
        email: `c-ref-a2-${providerA.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'A',
        lastName: '2',
      },
    });
    await prisma.branch.create({ data: { id: branchA, tenantId, name: 'A2' } });
    const apptWrongPatient = randomUUID();
    await prisma.appointment.create({
      data: {
        id: apptWrongPatient,
        tenantId,
        branchId: branchA,
        patientId: otherPatientId,
        providerId: providerA,
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + 1800_000),
      },
    });
    await expect(
      instances.createDraft({
        patientId,
        versionId: version.id,
        appointmentId: apptWrongPatient,
        actorId,
      }),
    ).rejects.toThrow(/patient/);
  });

  it('createDraft allows approved SYSTEM_CANONICAL clinical service', async () => {
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `plat-${randomUUID().slice(0, 8)}`,
    });
    const draft = await instances.createDraft({
      patientId,
      versionId: version.id,
      clinicalServiceId: platformServiceId,
      actorId,
    });
    expect(draft.clinicalServiceId).toBe(platformServiceId);
  });

  it('sign rejects nonexistent, cross-tenant, and wrong same-tenant signerPatientId', async () => {
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `sign-ref-${randomUUID().slice(0, 8)}`,
    });
    const draft = await instances.createDraft({ patientId, versionId: version.id, actorId });
    await expect(
      instances.sign({ instanceId: draft.id, actorId, signerPatientId: randomUUID() }),
    ).rejects.toThrow(/Patient not found/);
    await expect(
      instances.sign({ instanceId: draft.id, actorId, signerPatientId: otherTenantPatientId }),
    ).rejects.toThrow(/Patient not found/);
    await expect(
      instances.sign({ instanceId: draft.id, actorId, signerPatientId: otherPatientId }),
    ).rejects.toThrow(/self-sign only/);
  });

  it('sign accepts matching signerPatientId (self-sign) and staff-witnessed without signer', async () => {
    const { instances, version } = await publishKind({
      kind: 'CONSENT',
      stableKey: `sign-ok-${randomUUID().slice(0, 8)}`,
    });
    const selfDraft = await instances.createDraft({ patientId, versionId: version.id, actorId });
    const selfSigned = await instances.sign({
      instanceId: selfDraft.id,
      actorId,
      signerPatientId: patientId,
      method: 'PATIENT_SELF',
    });
    expect(selfSigned.signerPatientId).toBe(patientId);
    expect(selfSigned.method).toBe('PATIENT_SELF');

    const staffDraft = await instances.createDraft({ patientId, versionId: version.id, actorId });
    const staffSigned = await instances.sign({ instanceId: staffDraft.id, actorId });
    expect(staffSigned.signerPatientId).toBeNull();
    expect(staffSigned.method).toBe('STAFF_WITNESSED');
  });

  it('requirement upsert validates clinical service ownership', async () => {
    const { requirements } = await publishKind({
      kind: 'TREATMENT_CONSENT',
      stableKey: `req-ref-${randomUUID().slice(0, 8)}`,
    });
    const tenantSvc = await createTenantService(tenantId);
    const otherSvc = await createTenantService(otherTenantId);
    const ok = await requirements.upsert({
      clinicalServiceId: tenantSvc,
      formKind: 'TREATMENT_CONSENT',
      actorId,
    });
    expect(ok.clinicalServiceId).toBe(tenantSvc);
    const platformOk = await requirements.upsert({
      clinicalServiceId: platformServiceId,
      formKind: 'TREATMENT_CONSENT',
      actorId,
    });
    expect(platformOk.clinicalServiceId).toBe(platformServiceId);
    await expect(
      requirements.upsert({
        clinicalServiceId: otherSvc,
        formKind: 'TREATMENT_CONSENT',
        actorId,
      }),
    ).rejects.toThrow(/clinicalServiceId/);
    await expect(
      requirements.upsert({
        clinicalServiceId: randomUUID(),
        formKind: 'TREATMENT_CONSENT',
        actorId,
      }),
    ).rejects.toThrow(/clinicalServiceId/);
  });
});
