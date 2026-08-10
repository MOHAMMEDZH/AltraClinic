/**
 * Release 47 Step 12 — Healthcare Catalog item & compatibility application service.
 * Metadata SoR only — does not call LicensingEngineService for grants.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { CorrelationContextService } from '../../observability/application/logging/correlation-context.service';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import {
  evaluateCompatibilitySelection,
  wouldCreateDependencyCycle,
} from '../domain/compatibility.evaluator';
import {
  canTransitionLifecycle,
  isHighImpactLifecycleTransition,
  type CatalogLifecycle,
} from '../domain/lifecycle.state-machine';
import { buildCatalogDriftReport } from './catalog-drift.detector';
import { CatalogIdempotencyService } from './catalog-idempotency.service';
import type {
  AddCatalogAliasRequestDto,
  CatalogItemDetailDto,
  CatalogListResponseDto,
  CatalogReferencesDto,
  CatalogRuleDto,
  CreateCatalogItemRequestDto,
  LifecycleTransitionRequestDto,
  RetireCatalogAliasRequestDto,
  UpdateCatalogItemRequestDto,
  ValidateSelectionRequestDto,
} from './dto/catalog.dto';
import type { HealthcareCatalogAuditLog } from './ports/catalog-audit-log.port';
import {
  CATALOG_ICON_ALLOWLIST,
  CATALOG_LOCALES,
  KIND_MANAGE_PERMISSION,
  KIND_VIEW_PERMISSION,
  PLATFORM_HEALTHCARE_CATALOG_AUDIT_LOG,
  PLATFORM_HEALTHCARE_CATALOG_CONFIG,
  isAllowedCatalogLocale,
  isValidCanonicalKey,
  type CatalogKindName,
} from '../platform-healthcare-catalog.tokens';
import type { PlatformHealthcareCatalogConfig } from '../config/platform-healthcare-catalog.config';

const LIMIT_VALUE_TYPES = new Set(['INTEGER', 'DECIMAL', 'DURATION', 'BYTES', 'COUNT']);
const LIMIT_UNITS = new Set([
  'count',
  'users',
  'providers',
  'branches',
  'bytes',
  'megabytes',
  'gigabytes',
  'days',
  'hours',
  'minutes',
  'percent',
]);

@Injectable()
export class HealthcareCatalogService {
  private readonly logger = new Logger(HealthcareCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: PlatformAuthorizationService,
    @Inject(PLATFORM_HEALTHCARE_CATALOG_CONFIG)
    private readonly config: PlatformHealthcareCatalogConfig,
    @Inject(PLATFORM_HEALTHCARE_CATALOG_AUDIT_LOG)
    private readonly audit: HealthcareCatalogAuditLog,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly assurance: PlatformAssuranceService,
    private readonly idempotency: CatalogIdempotencyService,
    @Optional() private readonly correlation?: CorrelationContextService,
  ) {}

  async listItems(
    claims: JwtClaimsVO,
    query: {
      kind?: string;
      lifecycle?: string;
      search?: string;
      missingTranslation?: string;
      page?: string;
      pageSize?: string;
    },
  ): Promise<CatalogListResponseDto> {
    const permissions = await this.permissions(claims);
    this.requireAnyCatalogView(permissions);

    if (query.kind) {
      this.requireKindView(permissions, query.kind as CatalogKindName);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(
      this.config.maxPageSize,
      Math.max(1, Number(query.pageSize) || this.config.defaultPageSize),
    );
    const where: Prisma.HealthcareCatalogItemWhereInput = {};
    if (query.kind) {
      where.kind = query.kind as never;
    } else {
      const viewable = (
        Object.entries(KIND_VIEW_PERMISSION) as Array<[CatalogKindName, string]>
      )
        .filter(([, perm]) => permissions.has(perm))
        .map(([kind]) => kind);
      if (viewable.length === 0) {
        return {
          generatedAt: new Date().toISOString(),
          items: [],
          pagination: { page, pageSize, total: 0, hasNextPage: false },
        };
      }
      where.kind = { in: viewable as never };
    }
    if (query.lifecycle) where.lifecycle = query.lifecycle as never;
    if (query.search?.trim()) {
      const term = query.search.trim().slice(0, this.config.maxSearchLength);
      where.OR = [
        { canonicalKey: { contains: term, mode: 'insensitive' } },
        {
          translations: {
            some: { displayName: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }

    return this.prisma.withPlatformBypass(async (client) => {
      const [total, rows] = await Promise.all([
        client.healthcareCatalogItem.count({ where }),
        client.healthcareCatalogItem.findMany({
          where,
          include: {
            translations: true,
            _count: {
              select: {
                aliases: true,
                rulesAsSubject: true,
                rulesAsTarget: true,
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { canonicalKey: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      let items = rows.map((row) => {
        const locales = new Set(row.translations.map((t) => t.locale));
        const missing = CATALOG_LOCALES.filter((l) => !locales.has(l));
        const en = row.translations.find((t) => t.locale === 'en-US');
        return {
          id: row.id,
          canonicalKey: row.canonicalKey,
          kind: row.kind,
          lifecycle: row.lifecycle,
          sortOrder: row.sortOrder,
          version: row.version,
          systemSeeded: row.systemSeeded,
          displayName: en?.displayName ?? row.canonicalKey,
          missingTranslations: [...missing],
          referenceCount:
            row._count.aliases + row._count.rulesAsSubject + row._count.rulesAsTarget,
        };
      });

      if (query.missingTranslation === 'true') {
        items = items.filter((i) => i.missingTranslations.length > 0);
      }

      return {
        generatedAt: new Date().toISOString(),
        items,
        pagination: {
          page,
          pageSize,
          total: query.missingTranslation === 'true' ? items.length : total,
          hasNextPage: page * pageSize < total,
        },
      };
    });
  }

  async getItem(claims: JwtClaimsVO, id: string): Promise<CatalogItemDetailDto> {
    const permissions = await this.permissions(claims);
    const row = await this.loadItem(id);
    if (!row) throw new NotFoundException('Catalog item not found.');
    this.requireKindView(permissions, row.kind as CatalogKindName);
    return this.toDetail(row);
  }

  async createItem(
    claims: JwtClaimsVO,
    body: CreateCatalogItemRequestDto,
    idempotencyKey?: string | null,
  ): Promise<CatalogItemDetailDto> {
    const permissions = await this.permissions(claims);
    const kind = body.kind as CatalogKindName;
    this.requireKindManage(permissions, kind);

    if (!isValidCanonicalKey(kind, body.canonicalKey)) {
      throw new BadRequestException('Invalid canonical key for kind.');
    }
    this.validateTranslations(body.translations);
    this.validateLimitMetadata(kind, body.limit);
    if (body.iconKey && !(CATALOG_ICON_ALLOWLIST as readonly string[]).includes(body.iconKey)) {
      throw new BadRequestException('Icon key is not allowlisted.');
    }

    const fingerprintPayload = {
      kind: body.kind,
      canonicalKey: body.canonicalKey.trim(),
      sortOrder: body.sortOrder ?? 0,
      iconKey: body.iconKey ?? null,
      parentCanonicalKey: body.parentCanonicalKey ?? null,
      owningModuleCanonicalKey: body.owningModuleCanonicalKey ?? null,
      // Hash locale+names for conflict detection without persisting descriptions.
      translationFingerprint: body.translations.map((tr) => ({
        locale: tr.locale,
        displayName: tr.displayName.trim(),
        shortDescription: tr.shortDescription.trim(),
      })),
      limit: body.limit ?? null,
    };
    const requestHash = this.idempotency.fingerprint(fingerprintPayload);
    let pendingIdem:
      | { idempotencyKey: string; requestHash: string }
      | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'catalog.createItem',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') {
        return this.getItem(claims, gate.resultResourceId);
      }
      pendingIdem = {
        idempotencyKey: gate.idempotencyKey,
        requestHash: gate.requestHash,
      };
    }

    try {
      const created = await this.prisma.withPlatformBypass(async (client) => {
        const parentId = await this.resolveParentId(client, kind, body.parentCanonicalKey, null);
        const owningModuleId = await this.resolveOwningModuleId(
          client,
          kind,
          body.owningModuleCanonicalKey,
        );

        const row = await client.healthcareCatalogItem.create({
          data: {
            canonicalKey: body.canonicalKey.trim(),
            kind,
            lifecycle: 'DRAFT',
            sortOrder: body.sortOrder ?? 0,
            iconKey: body.iconKey ?? null,
            parentItemId: parentId,
            owningModuleItemId: owningModuleId,
            systemSeeded: false,
            limitValueType: body.limit?.valueType as never,
            limitUnit: body.limit?.unit,
            limitMin: body.limit?.min ?? null,
            limitMax: body.limit?.max ?? null,
            limitZeroValid: body.limit?.zeroValid,
            limitUnlimitedSupported: body.limit?.unlimitedSupported,
            translations: {
              create: body.translations.map((tr) => ({
                locale: tr.locale,
                displayName: tr.displayName.trim().slice(0, 200),
                shortDescription: tr.shortDescription.trim().slice(0, 500),
                longDescription: tr.longDescription?.slice(0, 4000) ?? null,
                helpText: tr.helpText?.slice(0, 500) ?? null,
              })),
            },
          },
          include: {
            translations: true,
            aliases: true,
            parent: true,
            owningModule: true,
          },
        });

        if (pendingIdem) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'catalog.createItem',
            idempotencyKey: pendingIdem.idempotencyKey,
            requestHash: pendingIdem.requestHash,
            resultResourceType: 'item',
            resultResourceId: row.id,
          });
        }

        await this.appendSuccessAudit(client, claims, 'healthcare_catalog.item.created', row.id, {
          canonicalKey: row.canonicalKey,
          kind: row.kind,
          result: 'success',
        });

        return row;
      });

      return this.toDetail(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Rejection after a rolled-back unique-constraint violation — best-effort, non-authoritative evidence.
        await this.safeAudit(claims, 'healthcare_catalog.item.create_rejected', claims.sub, {
          canonicalKey: body.canonicalKey.trim(),
          kind,
          result: 'duplicate_key',
        });
        throw new ConflictException('Canonical key already exists.');
      }
      throw err;
    }
  }

  async updateItem(
    claims: JwtClaimsVO,
    id: string,
    body: UpdateCatalogItemRequestDto,
  ): Promise<CatalogItemDetailDto> {
    const permissions = await this.permissions(claims);
    const existing = await this.loadItem(id);
    if (!existing) throw new NotFoundException('Catalog item not found.');
    this.requireKindManage(permissions, existing.kind as CatalogKindName);
    if (body.translations) this.validateTranslations(body.translations);
    if (body.limit) this.validateLimitMetadata(existing.kind as CatalogKindName, body.limit);
    if (body.iconKey && !(CATALOG_ICON_ALLOWLIST as readonly string[]).includes(body.iconKey)) {
      throw new BadRequestException('Icon key is not allowlisted.');
    }

    try {
      const updated = await this.prisma.withPlatformBypass(async (client) => {
        const parentId =
          body.parentCanonicalKey === undefined
            ? undefined
            : await this.resolveParentId(
                client,
                existing.kind as CatalogKindName,
                body.parentCanonicalKey,
                id,
              );
        const owningModuleId =
          body.owningModuleCanonicalKey === undefined
            ? undefined
            : await this.resolveOwningModuleId(
                client,
                existing.kind as CatalogKindName,
                body.owningModuleCanonicalKey,
              );

        const result = await client.healthcareCatalogItem.updateMany({
          where: { id, version: body.expectedVersion },
          data: {
            sortOrder: body.sortOrder ?? undefined,
            iconKey: body.iconKey === undefined ? undefined : body.iconKey,
            ...(parentId !== undefined ? { parentItemId: parentId } : {}),
            ...(owningModuleId !== undefined ? { owningModuleItemId: owningModuleId } : {}),
            version: { increment: 1 },
            ...(existing.kind === 'LIMIT' && body.limit
              ? {
                  limitValueType: body.limit.valueType as never,
                  limitUnit: body.limit.unit,
                  limitMin: body.limit.min ?? null,
                  limitMax: body.limit.max ?? null,
                  limitZeroValid: body.limit.zeroValid,
                  limitUnlimitedSupported: body.limit.unlimitedSupported,
                }
              : {}),
          },
        });
        if (result.count !== 1) {
          throw new ConflictException('Stale version — reload and retry.');
        }

        if (body.translations) {
          for (const tr of body.translations) {
            await client.healthcareCatalogTranslation.upsert({
              where: { itemId_locale: { itemId: id, locale: tr.locale } },
              create: {
                itemId: id,
                locale: tr.locale,
                displayName: tr.displayName.trim().slice(0, 200),
                shortDescription: tr.shortDescription.trim().slice(0, 500),
                longDescription: tr.longDescription?.slice(0, 4000) ?? null,
                helpText: tr.helpText?.slice(0, 500) ?? null,
              },
              update: {
                displayName: tr.displayName.trim().slice(0, 200),
                shortDescription: tr.shortDescription.trim().slice(0, 500),
                longDescription: tr.longDescription?.slice(0, 4000) ?? null,
                helpText: tr.helpText?.slice(0, 500) ?? null,
              },
            });
          }
        }

        const row = await client.healthcareCatalogItem.findUniqueOrThrow({
          where: { id },
          include: {
            translations: true,
            aliases: true,
            parent: true,
            owningModule: true,
          },
        });

        // business mutation staging complete → append SUCCESS audit before commit
        // (D04/D05 injection points, where present, land between staging and here).
        await this.appendSuccessAudit(client, claims, 'healthcare_catalog.item.updated', id, {
          canonicalKey: existing.canonicalKey,
          kind: existing.kind,
          fields: body.translations ? 'translations,metadata' : 'metadata',
          expectedVersion: String(body.expectedVersion),
          resultingVersion: String(row.version),
          result: 'success',
        });

        return row;
      });

      return this.toDetail(updated);
    } catch (err) {
      if (err instanceof ConflictException && /Stale version/i.test(err.message)) {
        // Rejection after a rolled-back OCC conflict — best-effort, non-authoritative evidence.
        await this.safeAudit(claims, 'healthcare_catalog.item.update_rejected', id, {
          canonicalKey: existing.canonicalKey,
          kind: existing.kind,
          expectedVersion: String(body.expectedVersion),
          result: 'stale_version',
        });
      }
      throw err;
    }
  }

  async transitionLifecycle(
    claims: JwtClaimsVO,
    id: string,
    to: CatalogLifecycle,
    body: LifecycleTransitionRequestDto,
  ): Promise<CatalogItemDetailDto> {
    const permissions = await this.permissions(claims);
    const existing = await this.loadItem(id);
    if (!existing) throw new NotFoundException('Catalog item not found.');
    this.requireKindManage(permissions, existing.kind as CatalogKindName);
    await this.requireFreshStepUp(claims);

    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }
    if (!canTransitionLifecycle(existing.lifecycle as CatalogLifecycle, to)) {
      throw new BadRequestException(
        `Transition ${existing.lifecycle} → ${to} is not allowed.`,
      );
    }
    if (
      !isHighImpactLifecycleTransition(existing.lifecycle as CatalogLifecycle, to)
    ) {
      throw new BadRequestException('Transition is not permitted.');
    }

    if (to === 'RETIRED') {
      const refs = await this.countActiveReferences(id);
      if (refs.activeRules > 0) {
        throw new ConflictException(
          'Cannot retire item with active compatibility-rule references.',
        );
      }
    }

    try {
      const updated = await this.prisma.withPlatformBypass(async (client) => {
        const result = await client.healthcareCatalogItem.updateMany({
          where: { id, version: body.expectedVersion },
          data: {
            lifecycle: to,
            version: { increment: 1 },
            replacementCanonicalKey: body.replacementCanonicalKey ?? undefined,
          },
        });
        if (result.count !== 1) {
          throw new ConflictException('Stale version — reload and retry.');
        }
        const row = await client.healthcareCatalogItem.findUniqueOrThrow({
          where: { id },
          include: {
            translations: true,
            aliases: true,
            parent: true,
            owningModule: true,
          },
        });

        await this.appendSuccessAudit(
          client,
          claims,
          `healthcare_catalog.item.${to.toLowerCase()}`,
          id,
          {
            canonicalKey: existing.canonicalKey,
            kind: existing.kind,
            from: existing.lifecycle,
            to,
            reasonCategory: 'lifecycle',
            expectedVersion: String(body.expectedVersion),
            resultingVersion: String(row.version),
            result: 'success',
          },
        );

        return row;
      });

      return this.toDetail(updated);
    } catch (err) {
      if (err instanceof ConflictException && /Stale version/i.test(err.message)) {
        // Rejection after a rolled-back OCC conflict — best-effort, non-authoritative evidence.
        await this.safeAudit(claims, 'healthcare_catalog.item.lifecycle_rejected', id, {
          canonicalKey: existing.canonicalKey,
          kind: existing.kind,
          to,
          expectedVersion: String(body.expectedVersion),
          result: 'stale_version',
        });
      }
      throw err;
    }
  }

  async addAlias(
    claims: JwtClaimsVO,
    itemId: string,
    body: AddCatalogAliasRequestDto,
  ): Promise<CatalogItemDetailDto> {
    const permissions = await this.permissions(claims);
    const existing = await this.loadItem(itemId);
    if (!existing) throw new NotFoundException('Catalog item not found.');
    this.requireKindManage(permissions, existing.kind as CatalogKindName);

    const aliasValue = body.aliasValue?.trim();
    const sourceNamespace = body.sourceNamespace?.trim();
    if (!aliasValue || aliasValue.length > 128) {
      throw new BadRequestException('Invalid alias value.');
    }
    if (!sourceNamespace || sourceNamespace.length > 64) {
      throw new BadRequestException('Invalid alias namespace.');
    }
    if (aliasValue === existing.canonicalKey) {
      throw new ConflictException('Alias cannot collide with the canonical key.');
    }

    try {
      const updated = await this.prisma.withPlatformBypass(async (client) => {
        const bumped = await client.healthcareCatalogItem.updateMany({
          where: { id: itemId, version: body.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (bumped.count !== 1) {
          throw new ConflictException('Stale version — reload and retry.');
        }
        await client.healthcareCatalogAlias.create({
          data: {
            itemId,
            aliasValue,
            sourceNamespace,
            lifecycle: 'ACTIVE',
            reason: body.reason?.trim().slice(0, 500) ?? null,
          },
        });
        const row = await client.healthcareCatalogItem.findUniqueOrThrow({
          where: { id: itemId },
          include: {
            translations: true,
            aliases: true,
            parent: true,
            owningModule: true,
          },
        });

        await this.appendSuccessAudit(client, claims, 'healthcare_catalog.alias.added', itemId, {
          canonicalKey: existing.canonicalKey,
          kind: existing.kind,
          aliasNamespace: sourceNamespace,
          result: 'success',
        });

        return row;
      });

      return this.toDetail(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Rejection after a rolled-back unique-constraint violation — best-effort, non-authoritative evidence.
        await this.safeAudit(claims, 'healthcare_catalog.alias.add_rejected', itemId, {
          canonicalKey: existing.canonicalKey,
          kind: existing.kind,
          aliasNamespace: sourceNamespace,
          result: 'duplicate_alias',
        });
        throw new ConflictException('Alias already exists in this namespace.');
      }
      throw err;
    }
  }

  async retireAlias(
    claims: JwtClaimsVO,
    itemId: string,
    aliasId: string,
    body: RetireCatalogAliasRequestDto,
  ): Promise<CatalogItemDetailDto> {
    const permissions = await this.permissions(claims);
    const existing = await this.loadItem(itemId);
    if (!existing) throw new NotFoundException('Catalog item not found.');
    this.requireKindManage(permissions, existing.kind as CatalogKindName);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new BadRequestException('Reason is required.');
    }

    const alias = existing.aliases.find((a) => a.id === aliasId);
    if (!alias) throw new NotFoundException('Alias not found.');
    if (alias.lifecycle === 'RETIRED') {
      return this.toDetail(existing);
    }

    const legacyInUse =
      alias.sourceNamespace === 'legacy_clinic_type' &&
      (await this.countLegacyFacilityUsageForAlias(alias.aliasValue)) > 0;
    if (legacyInUse) {
      await this.requireFreshStepUp(claims);
    }

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const bumped = await client.healthcareCatalogItem.updateMany({
        where: { id: itemId, version: body.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (bumped.count !== 1) {
        throw new ConflictException('Stale version — reload and retry.');
      }
      await client.healthcareCatalogAlias.update({
        where: { id: aliasId },
        data: {
          lifecycle: 'RETIRED',
          retiredAt: new Date(),
          reason: body.reason.trim().slice(0, 500),
        },
      });
      const row = await client.healthcareCatalogItem.findUniqueOrThrow({
        where: { id: itemId },
        include: {
          translations: true,
          aliases: true,
          parent: true,
          owningModule: true,
        },
      });

      await this.appendSuccessAudit(client, claims, 'healthcare_catalog.alias.retired', itemId, {
        canonicalKey: existing.canonicalKey,
        kind: existing.kind,
        aliasNamespace: alias.sourceNamespace,
        reasonCategory: 'alias_retire',
        result: 'success',
      });

      return row;
    });

    return this.toDetail(updated);
  }

  async getReferences(claims: JwtClaimsVO, id: string): Promise<CatalogReferencesDto> {
    const permissions = await this.permissions(claims);
    const item = await this.loadItem(id);
    if (!item) throw new NotFoundException('Catalog item not found.');
    this.requireKindView(permissions, item.kind as CatalogKindName);

    return this.prisma.withPlatformBypass(async (client) => {
      const [aliasCount, subjectRules, targetRules, legacyFacility, depRules] =
        await Promise.all([
          client.healthcareCatalogAlias.count({ where: { itemId: id } }),
          client.healthcareCatalogCompatibilityRule.findMany({
            where: { subjectItemId: id },
            select: { id: true },
            take: 50,
          }),
          client.healthcareCatalogCompatibilityRule.findMany({
            where: { targetItemId: id },
            select: { id: true },
            take: 50,
          }),
          item.kind === 'FACILITY_TYPE'
            ? this.countLegacyFacilityUsage(client, item.canonicalKey)
            : Promise.resolve(0),
          client.healthcareCatalogCompatibilityRule.findMany({
            where: {
              subjectItemId: id,
              ruleType: { in: ['REQUIRES', 'REQUIRES_ANY_OF'] },
              lifecycle: { in: ['ACTIVE', 'DRAFT'] },
            },
            include: { target: true },
            take: 50,
          }),
        ]);

      return {
        itemId: id,
        canonicalKey: item.canonicalKey,
        buckets: [
          {
            sourceType: 'aliases',
            count: aliasCount,
            availability: 'available',
          },
          {
            sourceType: 'dependencies',
            count: depRules.length,
            availability: 'available',
            keys: depRules.map((r) => r.target.canonicalKey),
          },
          {
            sourceType: 'compatibility_rules',
            count: subjectRules.length + targetRules.length,
            availability: 'available',
          },
          {
            sourceType: 'runtime_module_registry',
            count: item.kind === 'MODULE' ? 1 : 0,
            availability: 'available',
          },
          {
            sourceType: 'runtime_feature_registry',
            count: item.kind === 'FEATURE' ? 1 : 0,
            availability: 'available',
          },
          {
            sourceType: 'runtime_limit_registry',
            count: item.kind === 'LIMIT' ? 1 : 0,
            availability: 'available',
          },
          {
            sourceType: 'legacy_facility_usage',
            count: legacyFacility,
            availability: 'available',
          },
          {
            sourceType: 'plan_references',
            count: 0,
            availability: 'unavailable',
            reasonCode: 'step13_plans',
          },
          {
            sourceType: 'addon_references',
            count: 0,
            availability: 'unavailable',
            reasonCode: 'step15_addons',
          },
          {
            sourceType: 'override_references',
            count: 0,
            availability: 'unavailable',
            reasonCode: 'step15_overrides',
          },
        ],
      };
    });
  }

  async listRules(claims: JwtClaimsVO): Promise<{ items: CatalogRuleDto[] }> {
    const permissions = await this.permissions(claims);
    if (!permissions.has('compatibility-rule.view')) {
      throw new ForbiddenException('Missing compatibility-rule.view permission.');
    }
    const rows = await this.prisma.withPlatformBypass((client) =>
      client.healthcareCatalogCompatibilityRule.findMany({
        include: { subject: true, target: true },
        orderBy: [{ createdAt: 'asc' }],
        take: this.config.maxPageSize,
      }),
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        ruleType: r.ruleType,
        subjectKey: r.subject.canonicalKey,
        targetKey: r.target.canonicalKey,
        anyOfGroupKey: r.anyOfGroupKey,
        lifecycle: r.lifecycle,
        explanationEn: r.explanationEn,
        explanationAr: r.explanationAr,
        version: r.version,
        systemSeeded: r.systemSeeded,
      })),
    };
  }

  async createRule(
    claims: JwtClaimsVO,
    body: {
      ruleType: string;
      subjectKey: string;
      targetKey: string;
      anyOfGroupKey?: string;
      explanationEn: string;
      explanationAr: string;
    },
    idempotencyKey?: string | null,
  ): Promise<CatalogRuleDto> {
    const permissions = await this.permissions(claims);
    if (!permissions.has('compatibility-rule.manage')) {
      throw new ForbiddenException('Missing compatibility-rule.manage permission.');
    }
    if (body.subjectKey === body.targetKey) {
      throw new BadRequestException('Self-reference is not allowed.');
    }

    const fingerprintPayload = {
      ruleType: body.ruleType,
      subjectKey: body.subjectKey,
      targetKey: body.targetKey,
      anyOfGroupKey: body.anyOfGroupKey ?? '',
      explanationEn: body.explanationEn.trim(),
      explanationAr: body.explanationAr.trim(),
    };
    const requestHash = this.idempotency.fingerprint(fingerprintPayload);
    let pendingIdem:
      | { idempotencyKey: string; requestHash: string }
      | null = null;
    if (idempotencyKey?.trim()) {
      const gate = await this.idempotency.beginOrReplay({
        actorId: claims.sub,
        operation: 'catalog.createRule',
        idempotencyKey: idempotencyKey.trim(),
        requestHash,
      });
      if (gate.kind === 'replay') {
        return this.getRuleById(claims, gate.resultResourceId);
      }
      pendingIdem = {
        idempotencyKey: gate.idempotencyKey,
        requestHash: gate.requestHash,
      };
    }

    const created = await this.prisma.withPlatformBypass(async (client) => {
      const subject = await client.healthcareCatalogItem.findUnique({
        where: { canonicalKey: body.subjectKey },
      });
      const target = await client.healthcareCatalogItem.findUnique({
        where: { canonicalKey: body.targetKey },
      });
      if (!subject || !target) {
        throw new BadRequestException('Subject or target catalog item not found.');
      }
      if (target.lifecycle === 'RETIRED') {
        throw new BadRequestException('Cannot reference a retired catalog item.');
      }

      if (body.ruleType === 'REQUIRES' || body.ruleType === 'REQUIRES_ANY_OF') {
        const existingEdges = await client.healthcareCatalogCompatibilityRule.findMany({
          where: {
            ruleType: { in: ['REQUIRES', 'REQUIRES_ANY_OF'] },
            lifecycle: { in: ['ACTIVE', 'DRAFT'] },
          },
          include: { subject: true, target: true },
        });
        const edges = existingEdges.map((e) => ({
          from: e.subject.canonicalKey,
          to: e.target.canonicalKey,
        }));
        if (wouldCreateDependencyCycle(edges, body.subjectKey, body.targetKey)) {
          // Rejection before any row is staged — best-effort, non-authoritative evidence.
          await this.safeAudit(claims, 'healthcare_catalog.rule.create_rejected', claims.sub, {
            ruleType: body.ruleType,
            subjectKey: body.subjectKey,
            targetKey: body.targetKey,
            result: 'dependency_cycle',
          });
          throw new ConflictException('Dependency cycle detected.');
        }
      }

      if (body.ruleType === 'ALLOWED_FOR' || body.ruleType === 'NOT_ALLOWED_FOR') {
        const opposite = body.ruleType === 'ALLOWED_FOR' ? 'NOT_ALLOWED_FOR' : 'ALLOWED_FOR';
        const contradiction = await client.healthcareCatalogCompatibilityRule.findFirst({
          where: {
            ruleType: opposite,
            subjectItemId: subject.id,
            targetItemId: target.id,
            lifecycle: { in: ['ACTIVE', 'DRAFT'] },
          },
        });
        if (contradiction) {
          // Rejection before any row is staged — best-effort, non-authoritative evidence.
          await this.safeAudit(claims, 'healthcare_catalog.rule.create_rejected', claims.sub, {
            ruleType: body.ruleType,
            subjectKey: body.subjectKey,
            targetKey: body.targetKey,
            result: 'contradiction',
          });
          throw new ConflictException('Contradictory compatibility rule exists.');
        }
      }

      try {
        const row = await client.healthcareCatalogCompatibilityRule.create({
          data: {
            ruleType: body.ruleType as never,
            subjectItemId: subject.id,
            targetItemId: target.id,
            anyOfGroupKey: body.anyOfGroupKey ?? '',
            lifecycle: 'DRAFT',
            explanationEn: body.explanationEn.trim().slice(0, 500),
            explanationAr: body.explanationAr.trim().slice(0, 500),
            systemSeeded: false,
          },
          include: { subject: true, target: true },
        });
        if (pendingIdem) {
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'catalog.createRule',
            idempotencyKey: pendingIdem.idempotencyKey,
            requestHash: pendingIdem.requestHash,
            resultResourceType: 'rule',
            resultResourceId: row.id,
          });
        }

        await this.appendSuccessAudit(client, claims, 'healthcare_catalog.rule.created', row.id, {
          ruleType: row.ruleType,
          subjectKey: row.subject.canonicalKey,
          targetKey: row.target.canonicalKey,
          result: 'success',
        });

        return row;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // Rejection after a rolled-back unique-constraint violation — best-effort, non-authoritative evidence.
          await this.safeAudit(claims, 'healthcare_catalog.rule.create_rejected', claims.sub, {
            ruleType: body.ruleType,
            subjectKey: body.subjectKey,
            targetKey: body.targetKey,
            result: 'duplicate_rule',
          });
          throw new ConflictException('Equivalent compatibility rule already exists.');
        }
        throw err;
      }
    });

    const dto: CatalogRuleDto = {
      id: created.id,
      ruleType: created.ruleType,
      subjectKey: created.subject.canonicalKey,
      targetKey: created.target.canonicalKey,
      anyOfGroupKey: created.anyOfGroupKey,
      lifecycle: created.lifecycle,
      explanationEn: created.explanationEn,
      explanationAr: created.explanationAr,
      version: created.version,
      systemSeeded: created.systemSeeded,
    };

    return dto;
  }

  private async getRuleById(claims: JwtClaimsVO, ruleId: string): Promise<CatalogRuleDto> {
    const permissions = await this.permissions(claims);
    if (!permissions.has('compatibility-rule.view') && !permissions.has('compatibility-rule.manage')) {
      throw new ForbiddenException('Missing compatibility-rule.view permission.');
    }
    const row = await this.prisma.withPlatformBypass((client) =>
      client.healthcareCatalogCompatibilityRule.findUnique({
        where: { id: ruleId },
        include: { subject: true, target: true },
      }),
    );
    if (!row) throw new NotFoundException('Compatibility rule not found.');
    return {
      id: row.id,
      ruleType: row.ruleType,
      subjectKey: row.subject.canonicalKey,
      targetKey: row.target.canonicalKey,
      anyOfGroupKey: row.anyOfGroupKey,
      lifecycle: row.lifecycle,
      explanationEn: row.explanationEn,
      explanationAr: row.explanationAr,
      version: row.version,
      systemSeeded: row.systemSeeded,
    };
  }

  async transitionRuleLifecycle(
    claims: JwtClaimsVO,
    ruleId: string,
    to: 'ACTIVE' | 'RETIRED',
    expectedVersion: number,
    reason: string,
  ): Promise<CatalogRuleDto> {
    const permissions = await this.permissions(claims);
    if (!permissions.has('compatibility-rule.manage')) {
      throw new ForbiddenException('Missing compatibility-rule.manage permission.');
    }
    await this.requireFreshStepUp(claims);
    if (!reason?.trim()) throw new BadRequestException('Reason is required.');

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.healthcareCatalogCompatibilityRule.findUnique({
        where: { id: ruleId },
        include: { subject: true, target: true },
      });
      if (!existing) throw new NotFoundException('Compatibility rule not found.');
      if (!canTransitionLifecycle(existing.lifecycle as CatalogLifecycle, to)) {
        throw new BadRequestException(
          `Rule transition ${existing.lifecycle} → ${to} not allowed.`,
        );
      }
      const result = await client.healthcareCatalogCompatibilityRule.updateMany({
        where: { id: ruleId, version: expectedVersion },
        data: { lifecycle: to, version: { increment: 1 } },
      });
      if (result.count !== 1) {
        throw new ConflictException('Stale version — reload and retry.');
      }
      const row = await client.healthcareCatalogCompatibilityRule.findUniqueOrThrow({
        where: { id: ruleId },
        include: { subject: true, target: true },
      });

      await this.appendSuccessAudit(
        client,
        claims,
        `healthcare_catalog.rule.${to.toLowerCase()}`,
        ruleId,
        {
          ruleType: row.ruleType,
          subjectKey: row.subject.canonicalKey,
          targetKey: row.target.canonicalKey,
          reasonCategory: 'lifecycle',
          expectedVersion: String(expectedVersion),
          resultingVersion: String(row.version),
          result: 'success',
        },
      );

      return row;
    });

    return {
      id: updated.id,
      ruleType: updated.ruleType,
      subjectKey: updated.subject.canonicalKey,
      targetKey: updated.target.canonicalKey,
      anyOfGroupKey: updated.anyOfGroupKey,
      lifecycle: updated.lifecycle,
      explanationEn: updated.explanationEn,
      explanationAr: updated.explanationAr,
      version: updated.version,
      systemSeeded: updated.systemSeeded,
    };
  }

  async validateSelection(claims: JwtClaimsVO, body: ValidateSelectionRequestDto) {
    const permissions = await this.permissions(claims);
    this.requireAnyCatalogView(permissions);

    return this.prisma.withPlatformBypass(async (client) => {
      const [items, rules] = await Promise.all([
        client.healthcareCatalogItem.findMany({
          select: { canonicalKey: true, kind: true, lifecycle: true },
        }),
        client.healthcareCatalogCompatibilityRule.findMany({
          include: { subject: true, target: true },
        }),
      ]);

      const result = evaluateCompatibilitySelection(
        body,
        items.map((i) => ({
          canonicalKey: i.canonicalKey,
          kind: i.kind,
          lifecycle: i.lifecycle as CatalogLifecycle,
        })),
        rules.map((r) => ({
          id: r.id,
          ruleType: r.ruleType as never,
          subjectKey: r.subject.canonicalKey,
          targetKey: r.target.canonicalKey,
          anyOfGroupKey: r.anyOfGroupKey,
          lifecycle: r.lifecycle as CatalogLifecycle,
        })),
      );

      await this.safeAudit(
        claims,
        'healthcare_catalog.selection.validated',
        PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        {
          valid: String(result.valid),
          violationCount: String(result.violations.length),
        },
      );

      return result;
    });
  }

  async driftReport(claims: JwtClaimsVO) {
    const permissions = await this.permissions(claims);
    this.requireAnyCatalogView(permissions);

    return this.prisma.withPlatformBypass(async (client) => {
      const items = await client.healthcareCatalogItem.findMany({
        include: { translations: true, aliases: true },
      });
      return buildCatalogDriftReport(
        items.map((i) => ({
          canonicalKey: i.canonicalKey,
          kind: i.kind,
          lifecycle: i.lifecycle,
          locales: i.translations.map((t) => t.locale),
        })),
        items.flatMap((i) =>
          i.aliases.map((a) => ({
            canonicalKey: i.canonicalKey,
            kind: i.kind,
            aliasValue: a.aliasValue,
            sourceNamespace: a.sourceNamespace,
            lifecycle: a.lifecycle,
          })),
        ),
      );
    });
  }

  private async loadItem(id: string) {
    return this.prisma.withPlatformBypass((client) =>
      client.healthcareCatalogItem.findUnique({
        where: { id },
        include: {
          translations: true,
          aliases: true,
          parent: true,
          owningModule: true,
        },
      }),
    );
  }

  private toDetail(
    row: NonNullable<Awaited<ReturnType<HealthcareCatalogService['loadItem']>>>,
  ): CatalogItemDetailDto {
    const locales = new Set(row.translations.map((t) => t.locale));
    return {
      id: row.id,
      canonicalKey: row.canonicalKey,
      kind: row.kind,
      lifecycle: row.lifecycle,
      sortOrder: row.sortOrder,
      iconKey: row.iconKey,
      parentCanonicalKey: row.parent?.canonicalKey ?? null,
      owningModuleCanonicalKey: row.owningModule?.canonicalKey ?? null,
      version: row.version,
      systemSeeded: row.systemSeeded,
      replacementCanonicalKey: row.replacementCanonicalKey,
      translations: row.translations.map((t) => ({
        locale: t.locale,
        displayName: t.displayName,
        shortDescription: t.shortDescription,
        longDescription: t.longDescription,
        helpText: t.helpText,
        incomplete: !locales.has('en-US') || !locales.has('ar-SY'),
      })),
      aliases: row.aliases.map((a) => ({
        id: a.id,
        aliasValue: a.aliasValue,
        sourceNamespace: a.sourceNamespace,
        lifecycle: a.lifecycle,
        reason: a.reason,
      })),
      limit:
        row.kind === 'LIMIT' && row.limitValueType && row.limitUnit
          ? {
              valueType: row.limitValueType,
              unit: row.limitUnit,
              min: row.limitMin?.toString() ?? null,
              max: row.limitMax?.toString() ?? null,
              zeroValid: row.limitZeroValid ?? false,
              unlimitedSupported: row.limitUnlimitedSupported ?? false,
            }
          : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private validateTranslations(
    translations: Array<{ locale: string; displayName: string; shortDescription: string }>,
  ) {
    if (!translations?.length) {
      throw new BadRequestException('At least one translation is required.');
    }
    for (const tr of translations) {
      if (!isAllowedCatalogLocale(tr.locale)) {
        throw new BadRequestException(`Unsupported locale: ${tr.locale}`);
      }
      if (!tr.displayName?.trim() || tr.displayName.length > 200) {
        throw new BadRequestException('Invalid displayName.');
      }
      if (!tr.shortDescription?.trim() || tr.shortDescription.length > 500) {
        throw new BadRequestException('Invalid shortDescription.');
      }
    }
  }

  private validateLimitMetadata(
    kind: CatalogKindName,
    limit:
      | {
          valueType: string;
          unit: string;
          min?: number | null;
          max?: number | null;
          zeroValid: boolean;
          unlimitedSupported: boolean;
        }
      | undefined,
  ) {
    if (kind === 'LIMIT' && !limit) {
      throw new BadRequestException('Limit metadata is required for LIMIT items.');
    }
    if (kind !== 'LIMIT' && limit) {
      throw new BadRequestException('Limit metadata is only valid for LIMIT items.');
    }
    if (!limit) return;
    if (!LIMIT_VALUE_TYPES.has(limit.valueType)) {
      throw new BadRequestException('Invalid limit value type.');
    }
    if (!LIMIT_UNITS.has(limit.unit)) {
      throw new BadRequestException('Invalid limit unit.');
    }
    if (
      limit.min != null &&
      limit.max != null &&
      Number(limit.min) > Number(limit.max)
    ) {
      throw new BadRequestException('Limit minimum cannot exceed maximum.');
    }
    if (limit.min === 0 && !limit.zeroValid) {
      throw new BadRequestException('Zero minimum requires zeroValid=true.');
    }
  }

  private async resolveParentId(
    client: Prisma.TransactionClient,
    kind: CatalogKindName,
    parentCanonicalKey: string | null | undefined,
    selfId: string | null,
  ): Promise<string | null> {
    if (parentCanonicalKey === null || parentCanonicalKey === undefined || parentCanonicalKey === '') {
      return null;
    }
    if (kind !== 'SPECIALTY') {
      throw new BadRequestException('Parent is only valid for SPECIALTY items.');
    }
    const parent = await client.healthcareCatalogItem.findUnique({
      where: { canonicalKey: parentCanonicalKey },
    });
    if (!parent || parent.kind !== 'SPECIALTY') {
      throw new BadRequestException('Parent specialty not found.');
    }
    if (selfId && parent.id === selfId) {
      throw new BadRequestException('Self-parenting is not allowed.');
    }
    if (selfId) {
      let cursor: string | null = parent.parentItemId;
      const seen = new Set<string>([selfId, parent.id]);
      while (cursor) {
        if (seen.has(cursor)) {
          throw new ConflictException('Specialty parent hierarchy cycle detected.');
        }
        seen.add(cursor);
        const next: { parentItemId: string | null } | null =
          await client.healthcareCatalogItem.findUnique({
            where: { id: cursor },
            select: { parentItemId: true },
          });
        cursor = next?.parentItemId ?? null;
      }
    }
    return parent.id;
  }

  private async resolveOwningModuleId(
    client: Prisma.TransactionClient,
    kind: CatalogKindName,
    owningModuleCanonicalKey: string | null | undefined,
  ): Promise<string | null> {
    if (
      owningModuleCanonicalKey === null ||
      owningModuleCanonicalKey === undefined ||
      owningModuleCanonicalKey === ''
    ) {
      return null;
    }
    if (kind !== 'FEATURE' && kind !== 'LIMIT') {
      throw new BadRequestException('Owning module is only valid for FEATURE or LIMIT.');
    }
    const moduleItem = await client.healthcareCatalogItem.findUnique({
      where: { canonicalKey: owningModuleCanonicalKey },
    });
    if (!moduleItem || moduleItem.kind !== 'MODULE') {
      throw new BadRequestException('Owning module not found.');
    }
    return moduleItem.id;
  }

  private async countActiveReferences(itemId: string) {
    return this.prisma.withPlatformBypass(async (client) => {
      const activeRules = await client.healthcareCatalogCompatibilityRule.count({
        where: {
          lifecycle: 'ACTIVE',
          OR: [{ subjectItemId: itemId }, { targetItemId: itemId }],
        },
      });
      return { activeRules };
    });
  }

  private async countLegacyFacilityUsage(
    client: Prisma.TransactionClient,
    canonicalKey: string,
  ): Promise<number> {
    const alias = await client.healthcareCatalogAlias.findFirst({
      where: {
        item: { canonicalKey },
        sourceNamespace: 'legacy_clinic_type',
        lifecycle: 'ACTIVE',
      },
    });
    if (!alias) return 0;
    return this.countLegacyFacilityUsageForAlias(alias.aliasValue, client);
  }

  private async countLegacyFacilityUsageForAlias(
    aliasValue: string,
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    const run = async (c: Prisma.TransactionClient) => {
      const rows = await c.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM tenants
        WHERE "deletedAt" IS NULL
          AND lower(trim(coalesce(features->'clinicProfile'->>'clinicType', ''))) = ${aliasValue}
      `);
      return Number(rows[0]?.count ?? 0);
    };
    if (client) return run(client);
    return this.prisma.withPlatformBypass((c) => run(c));
  }

  private async permissions(claims: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authz.resolveEffectivePermissions(claims.sub));
  }

  private requireAnyCatalogView(permissions: Set<string>) {
    const ok = [
      'facility-type.view',
      'specialty.view',
      'module.view',
      'feature.view',
      'limit.view',
      'compatibility-rule.view',
    ].some((p) => permissions.has(p));
    if (!ok) throw new ForbiddenException('Missing catalog view permission.');
  }

  private requireKindView(permissions: Set<string>, kind: CatalogKindName) {
    const key = KIND_VIEW_PERMISSION[kind];
    if (!key || !permissions.has(key)) {
      throw new ForbiddenException(`Missing ${key ?? 'kind.view'} permission.`);
    }
  }

  private requireKindManage(permissions: Set<string>, kind: CatalogKindName) {
    const key = KIND_MANAGE_PERMISSION[kind];
    if (!key || !permissions.has(key)) {
      throw new ForbiddenException(`Missing ${key ?? 'kind.manage'} permission.`);
    }
  }

  /** Server-enforced fresh step-up bound to the current Platform session. */
  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    if (!claims.sessionId) {
      throw new ForbiddenException('Session unavailable.');
    }
    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session) {
      throw new ForbiddenException('Session unavailable.');
    }
    this.assurance.requireStepUp(session);
  }

  /**
   * Step 21 Model A — durable SUCCESS audit. Appends the AuditEntry inside the
   * same `withPlatformBypass` transaction client as the business mutation it
   * documents, and intentionally does NOT swallow failures: if the audit write
   * fails, this throws and the whole transaction (including the mutation)
   * rolls back. There is no code path where a catalog mutation succeeds
   * without its durable audit evidence.
   */
  private async appendSuccessAudit(
    client: Prisma.TransactionClient,
    claims: JwtClaimsVO,
    action: string,
    resourceId: string,
    details: Record<string, string>,
  ): Promise<void> {
    await this.audit.recordInTransaction(client, {
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      action,
      resourceId,
      actorId: claims.sub,
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'Healthcare catalog mutation',
      descriptionAr: 'تعديل كتالوج الرعاية الصحية',
      details,
      correlationId: resolveOperationCorrelationId({
        fromContext: this.correlation?.getCorrelationId?.() ?? null,
      }),
    });
  }

  /**
   * Best-effort REJECTION/failure audit only — used after a mutation has
   * already been rolled back (e.g. stale-version OCC conflict, duplicate key).
   * Non-authoritative evidence: since the business change never committed,
   * there is nothing to keep atomic with, so this intentionally swallows
   * failures rather than masking the original rejection with an audit error.
   */
  private async safeAudit(
    claims: JwtClaimsVO,
    action: string,
    resourceId: string,
    details: Record<string, string>,
  ) {
    try {
      await this.audit.record({
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        action,
        resourceId,
        actorId: claims.sub,
        actorRoles: ['platform'],
        locale: null,
        descriptionEn: 'Healthcare catalog mutation',
        descriptionAr: 'تعديل كتالوج الرعاية الصحية',
        details,
        // Do not persist session IDs; correlation is optional and allowlisted UUID-only.
        correlationId: null,
      });
    } catch (err) {
      // Best-effort: rejection already occurred and rolled back; durable audit may lag (approved policy).
      this.logger.warn(`Catalog audit failed: ${(err as Error)?.name ?? 'Error'}`);
    }
  }
}
