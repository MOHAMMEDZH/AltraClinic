import { Inject, Injectable } from '@nestjs/common';
import {
  ClinicalServiceLifecycle,
  ClinicalServiceProvenance,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import {
  assertLifecycleTransition,
  isEditableLifecycle,
} from '../domain/clinical-catalog.lifecycle';
import {
  ClinicalCatalogConflictError,
  ClinicalCatalogErrorCode,
  ClinicalCatalogForbiddenError,
  ClinicalCatalogNotFoundError,
  ClinicalCatalogValidationError,
} from '../domain/clinical-catalog.errors';
import { isTenantCanonicalWriteEnabled } from '../domain/feature-flag.helpers';
import {
  CLINICAL_LOCALES,
  assertStableKeyImmutable,
  validateStableKeyNamespace,
} from '../domain/stable-key.helpers';
import {
  CLINICAL_CATALOG_AUDIT_LOG,
  ClinicalCatalogAuditLog,
} from './ports/clinical-catalog-audit-log.port';
import type {
  CreateClinicalServiceDraftDto,
  TranslationInputDto,
  UpdateClinicalServiceDraftDto,
} from './dto/clinical-catalog.dto';

export interface ClinicalCatalogActorContext {
  actorId: string;
  actorRoles: string[];
  tenantId: string | null;
  isPlatform: boolean;
}

@Injectable()
export class ClinicalCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(CLINICAL_CATALOG_AUDIT_LOG)
    private readonly auditLog: ClinicalCatalogAuditLog,
  ) {}

  async listServices(
    actor: ClinicalCatalogActorContext,
    query: { lifecycle?: string; provenance?: string; search?: string } = {},
  ) {
    const where = this.buildListWhere(actor, query);
    return this.prisma.withPlatformBypass(async (client) =>
      client.canonicalClinicalServiceDefinition.findMany({
        where,
        include: { translations: true },
        orderBy: [{ stableKey: 'asc' }],
      }),
    );
  }

  async getService(actor: ClinicalCatalogActorContext, serviceId: string) {
    const service = await this.loadService(serviceId);
    this.assertReadable(actor, service);
    return service;
  }

  async createDraft(actor: ClinicalCatalogActorContext, body: CreateClinicalServiceDraftDto) {
    this.assertCreateAuthority(actor, body.provenance);
    await this.assertTenantWriteFlag(actor, body.provenance);
    validateStableKeyNamespace(body.provenance, body.stableKey, actor.tenantId);

    const tenantId =
      body.provenance === 'SYSTEM_CANONICAL' ? null : actor.tenantId ?? null;
    if (body.provenance === 'TENANT_CUSTOM' && !tenantId) {
      throw new ClinicalCatalogForbiddenError('Tenant context required for TENANT_CUSTOM.');
    }

    this.validateTranslations(body.translations, false);

    return this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.canonicalClinicalServiceDefinition.findUnique({
        where: { stableKey: body.stableKey },
      });
      if (existing) {
        throw new ClinicalCatalogConflictError('stableKey already exists.');
      }

      const created = await client.canonicalClinicalServiceDefinition.create({
        data: {
          tenantId,
          provenance: body.provenance,
          stableKey: body.stableKey,
          domain: body.domain ?? 'GENERAL',
          categoryKey: body.categoryKey ?? null,
          defaultDurationMin: body.defaultDurationMin ?? null,
          lifecycle: 'DRAFT',
          translations: {
            create: body.translations.map((t) => this.translationCreate(t)),
          },
        },
        include: { translations: true },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId: this.auditTenantId(actor, tenantId),
        action: 'clinical_catalog.service.create_draft',
        resourceId: created.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: `Created clinical service draft ${created.stableKey}`,
        descriptionAr: `تم إنشاء مسودة خدمة سريرية ${created.stableKey}`,
        details: {
          stableKey: created.stableKey,
          provenance: created.provenance,
        },
      });

      return created;
    });
  }

  async updateDraft(
    actor: ClinicalCatalogActorContext,
    serviceId: string,
    body: UpdateClinicalServiceDraftDto,
  ) {
    const existing = await this.loadService(serviceId);
    this.assertMutable(actor, existing);
    if (!isEditableLifecycle(existing.lifecycle)) {
      throw new ClinicalCatalogValidationError(
        'Only DRAFT services may be edited.',
        ClinicalCatalogErrorCode.LIFECYCLE_INVALID,
      );
    }

    if (body.stableKey !== undefined) {
      assertStableKeyImmutable(existing.lifecycle, body.stableKey, existing.stableKey);
      validateStableKeyNamespace(existing.provenance, body.stableKey, existing.tenantId);
    }

    if (body.translations?.length) {
      this.validateTranslations(body.translations, false);
    }

    return this.prisma.withPlatformBypass(async (client) => {
      if (body.stableKey && body.stableKey !== existing.stableKey) {
        const collision = await client.canonicalClinicalServiceDefinition.findUnique({
          where: { stableKey: body.stableKey },
        });
        if (collision) {
          throw new ClinicalCatalogConflictError('stableKey already exists.');
        }
      }

      await client.canonicalClinicalServiceDefinition.update({
        where: { id: serviceId },
        data: {
          stableKey: body.stableKey,
          domain: body.domain,
          categoryKey: body.categoryKey,
          defaultDurationMin: body.defaultDurationMin,
        },
      });

      if (body.translations?.length) {
        for (const translation of body.translations) {
          await client.clinicalServiceTranslation.upsert({
            where: {
              clinicalServiceId_locale: {
                clinicalServiceId: serviceId,
                locale: translation.locale,
              },
            },
            create: {
              clinicalServiceId: serviceId,
              ...this.translationCreate(translation),
            },
            update: this.translationCreate(translation),
          });
        }
      }

      const updated = await client.canonicalClinicalServiceDefinition.findUniqueOrThrow({
        where: { id: serviceId },
        include: { translations: true },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId: this.auditTenantId(actor, updated.tenantId),
        action: 'clinical_catalog.service.update_draft',
        resourceId: updated.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: `Updated clinical service draft ${updated.stableKey}`,
        descriptionAr: `تم تحديث مسودة خدمة سريرية ${updated.stableKey}`,
      });

      return updated;
    });
  }

  async publish(actor: ClinicalCatalogActorContext, serviceId: string) {
    const existing = await this.loadService(serviceId);
    this.assertMutable(actor, existing);
    assertLifecycleTransition(existing.lifecycle, 'PUBLISHED');
    this.assertBilingualPublishReady(existing.translations);

    return this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.canonicalClinicalServiceDefinition.update({
        where: { id: serviceId },
        data: {
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          publishedBy: actor.actorId,
        },
        include: { translations: true },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId: this.auditTenantId(actor, updated.tenantId),
        action: 'clinical_catalog.service.publish',
        resourceId: updated.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: `Published clinical service ${updated.stableKey}`,
        descriptionAr: `تم نشر الخدمة السريرية ${updated.stableKey}`,
      });

      return updated;
    });
  }

  async deprecate(actor: ClinicalCatalogActorContext, serviceId: string) {
    const existing = await this.loadService(serviceId);
    this.assertMutable(actor, existing);
    assertLifecycleTransition(existing.lifecycle, 'DEPRECATED');

    return this.transitionLifecycle(actor, serviceId, 'DEPRECATED', {
      deprecatedAt: new Date(),
      deprecatedBy: actor.actorId,
    });
  }

  async inactivate(actor: ClinicalCatalogActorContext, serviceId: string) {
    const existing = await this.loadService(serviceId);
    this.assertMutable(actor, existing);
    assertLifecycleTransition(existing.lifecycle, 'INACTIVE');

    return this.transitionLifecycle(actor, serviceId, 'INACTIVE', {
      inactivatedAt: new Date(),
      inactivatedBy: actor.actorId,
    });
  }

  async resolveTenantActor(userSub: string, roles: string[]): Promise<ClinicalCatalogActorContext> {
    const tenant = await this.tenantContext.resolve();
    return {
      actorId: userSub,
      actorRoles: roles,
      tenantId: tenant.tenantId,
      isPlatform: false,
    };
  }

  platformActor(userSub: string, roles: string[]): ClinicalCatalogActorContext {
    return {
      actorId: userSub,
      actorRoles: roles,
      tenantId: null,
      isPlatform: true,
    };
  }

  private async transitionLifecycle(
    actor: ClinicalCatalogActorContext,
    serviceId: string,
    lifecycle: ClinicalServiceLifecycle,
    extra: Prisma.CanonicalClinicalServiceDefinitionUpdateInput,
  ) {
    return this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.canonicalClinicalServiceDefinition.update({
        where: { id: serviceId },
        data: { lifecycle, ...extra },
        include: { translations: true },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId: this.auditTenantId(actor, updated.tenantId),
        action: `clinical_catalog.service.${lifecycle.toLowerCase()}`,
        resourceId: updated.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: `Clinical service ${updated.stableKey} → ${lifecycle}`,
        descriptionAr: `الخدمة السريرية ${updated.stableKey} → ${lifecycle}`,
      });

      return updated;
    });
  }

  private buildListWhere(
    actor: ClinicalCatalogActorContext,
    query: { lifecycle?: string; provenance?: string; search?: string },
  ): Prisma.CanonicalClinicalServiceDefinitionWhereInput {
    const where: Prisma.CanonicalClinicalServiceDefinitionWhereInput = {};

    if (query.lifecycle) {
      where.lifecycle = query.lifecycle as ClinicalServiceLifecycle;
    }
    if (query.provenance) {
      where.provenance = query.provenance as ClinicalServiceProvenance;
    }
    if (query.search?.trim()) {
      where.OR = [
        { stableKey: { contains: query.search.trim(), mode: 'insensitive' } },
        {
          translations: {
            some: { displayName: { contains: query.search.trim(), mode: 'insensitive' } },
          },
        },
      ];
    }

    if (actor.isPlatform) {
      return where;
    }

    const tenantId = actor.tenantId;
    if (!tenantId) {
      throw new ClinicalCatalogForbiddenError('Tenant context required.');
    }

    return {
      AND: [
        where,
        {
          OR: [{ provenance: 'SYSTEM_CANONICAL' }, { tenantId, provenance: 'TENANT_CUSTOM' }],
        },
      ],
    };
  }

  private async loadService(serviceId: string) {
    const service = await this.prisma.withPlatformBypass((client) =>
      client.canonicalClinicalServiceDefinition.findUnique({
        where: { id: serviceId },
        include: { translations: true },
      }),
    );
    if (!service) {
      throw new ClinicalCatalogNotFoundError();
    }
    return service;
  }

  private assertReadable(
    actor: ClinicalCatalogActorContext,
    service: { provenance: ClinicalServiceProvenance; tenantId: string | null },
  ) {
    if (actor.isPlatform) return;
    if (service.provenance === 'SYSTEM_CANONICAL') return;
    if (service.tenantId !== actor.tenantId) {
      throw new ClinicalCatalogForbiddenError(
        'Cross-tenant clinical service access denied.',
        ClinicalCatalogErrorCode.TENANT_ISOLATION,
      );
    }
  }

  private assertMutable(
    actor: ClinicalCatalogActorContext,
    service: {
      provenance: ClinicalServiceProvenance;
      tenantId: string | null;
      lifecycle: ClinicalServiceLifecycle;
    },
  ) {
    this.assertReadable(actor, service);
    if (!actor.isPlatform && service.provenance === 'SYSTEM_CANONICAL') {
      throw new ClinicalCatalogForbiddenError(
        'Tenants cannot mutate SYSTEM_CANONICAL services.',
        ClinicalCatalogErrorCode.SYSTEM_CANONICAL_MUTATION_DENIED,
      );
    }
  }

  private assertCreateAuthority(
    actor: ClinicalCatalogActorContext,
    provenance: ClinicalServiceProvenance,
  ) {
    if (provenance === 'SYSTEM_CANONICAL' && !actor.isPlatform) {
      throw new ClinicalCatalogForbiddenError(
        'SYSTEM_CANONICAL services require platform authority.',
        ClinicalCatalogErrorCode.SYSTEM_CANONICAL_MUTATION_DENIED,
      );
    }
    if (provenance === 'TENANT_CUSTOM' && actor.isPlatform) {
      throw new ClinicalCatalogValidationError(
        'Platform callers must not create TENANT_CUSTOM services.',
      );
    }
  }

  private async assertTenantWriteFlag(
    actor: ClinicalCatalogActorContext,
    provenance: ClinicalServiceProvenance,
  ) {
    if (actor.isPlatform || provenance !== 'TENANT_CUSTOM') {
      return;
    }
    const tenantId = actor.tenantId;
    if (!tenantId) return;

    const tenant = await this.prisma.withPlatformBypass((client) =>
      client.tenant.findUnique({ where: { id: tenantId }, select: { features: true } }),
    );
    const features = (tenant?.features ?? {}) as Record<string, unknown>;
    if (!isTenantCanonicalWriteEnabled(features)) {
      throw new ClinicalCatalogForbiddenError(
        'Tenant canonical catalog writes are disabled (catalog.canonical.write=false).',
        ClinicalCatalogErrorCode.FEATURE_FLAG_BLOCKED,
      );
    }
  }

  private assertBilingualPublishReady(
    translations: Array<{ locale: string; displayName: string }>,
  ) {
    for (const locale of CLINICAL_LOCALES) {
      const row = translations.find((t) => t.locale === locale);
      if (!row?.displayName?.trim()) {
        throw new ClinicalCatalogValidationError(
          `Publish requires ${locale} displayName.`,
          ClinicalCatalogErrorCode.BILINGUAL_REQUIRED,
        );
      }
    }
  }

  private validateTranslations(translations: TranslationInputDto[], requireAll: boolean) {
    if (!translations.length && requireAll) {
      throw new ClinicalCatalogValidationError('At least one translation is required.');
    }
    for (const t of translations) {
      if (!CLINICAL_LOCALES.includes(t.locale as (typeof CLINICAL_LOCALES)[number])) {
        throw new ClinicalCatalogValidationError(`Unsupported locale: ${t.locale}`);
      }
      if (!t.displayName?.trim()) {
        throw new ClinicalCatalogValidationError('displayName is required.');
      }
    }
  }

  private translationCreate(t: TranslationInputDto) {
    return {
      locale: t.locale,
      displayName: t.displayName.trim(),
      shortDescription: t.shortDescription?.trim() ?? null,
      longDescription: t.longDescription?.trim() ?? null,
    };
  }

  private auditTenantId(
    actor: ClinicalCatalogActorContext,
    serviceTenantId: string | null,
  ): string {
    if (serviceTenantId) return serviceTenantId;
    return actor.tenantId ?? PLATFORM_AUDIT_SENTINEL_TENANT_ID;
  }
}
