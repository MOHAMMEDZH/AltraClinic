/**
 * Static commercial composition preview — Base → Add-ons → Overrides.
 * Never calls the licensing engine resolve path. runtimeEffective is always false.
 */
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_ADDONS_CONFIG } from '../platform-addons.tokens';
import {
  composeCommercialPreview,
  COMPOSITION_DISCLAIMER,
} from '../domain/commercial-composition';
import {
  loadPlatformAddonsConfig,
  type PlatformAddonsConfig,
} from '../config/platform-addons.config';

@Injectable()
export class CommercialCompositionService {
  private readonly rateHits = new Map<string, number[]>();
  private readonly config: PlatformAddonsConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: PlatformAuthorizationService,
    @Optional() @Inject(PLATFORM_ADDONS_CONFIG) config?: PlatformAddonsConfig,
  ) {
    this.config = config ?? loadPlatformAddonsConfig();
  }

  private enforceRateLimit(actorId: string): void {
    const limit = this.config.readHeavyRateLimitPerMinute;
    const key = `readHeavy:${actorId}`;
    const now = Date.now();
    const windowStart = now - 60_000;
    const hits = (this.rateHits.get(key) ?? []).filter((t) => t > windowStart);
    if (hits.length >= limit) {
      throw new HttpException('Composition rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.rateHits.set(key, hits);
  }

  async preview(
    claims: JwtClaimsVO,
    body: {
      planVersionId: string;
      addonVersionIds?: string[];
      overrideIds?: string[];
    },
  ) {
    const perms = new Set(
      await this.authorization.resolveEffectivePermissions(claims.sub),
    );
    if (!perms.has('addon.view') && !perms.has('override.view') && !perms.has('plan.view')) {
      throw new ForbiddenException('Missing plan.view, addon.view, or override.view permission.');
    }
    this.enforceRateLimit(claims.sub);

    if (!body.planVersionId?.trim()) {
      throw new BadRequestException('planVersionId is required.');
    }
    const addonVersionIds = [...new Set(body.addonVersionIds ?? [])];
    const overrideIds = [...new Set(body.overrideIds ?? [])];

    return this.prisma.withPlatformBypass(async (client) => {
      const planVersion = await client.platformPlanVersion.findUnique({
        where: { id: body.planVersionId },
        include: {
          entitlements: { include: { catalogItem: true } },
          limits: { include: { catalogItem: true } },
          plan: { select: { canonicalKey: true } },
        },
      });
      if (!planVersion) throw new NotFoundException('Plan Version not found.');

      const addOnVersions =
        addonVersionIds.length === 0
          ? []
          : await client.platformAddOnVersion.findMany({
              where: { id: { in: addonVersionIds } },
              include: {
                entitlements: { include: { catalogItem: true } },
                limitEffects: { include: { catalogItem: true } },
              },
            });
      if (addOnVersions.length !== addonVersionIds.length) {
        throw new BadRequestException('One or more addonVersionIds are unknown.');
      }

      const overrides =
        overrideIds.length === 0
          ? []
          : await client.platformCommercialOverride.findMany({
              where: { id: { in: overrideIds } },
              include: { effects: { include: { catalogItem: true } } },
            });
      if (overrides.length !== overrideIds.length) {
        throw new BadRequestException('One or more overrideIds are unknown.');
      }

      const now = new Date();
      // Deterministic order (ignore request/DB insertion order).
      const orderedAddOns = [...addOnVersions].sort((a, b) => a.id.localeCompare(b.id));
      const eligibleOverrides = overrides
        .filter((o) => {
          if (o.lifecycle !== 'APPROVED') return false;
          if (o.expiresAt && o.expiresAt.getTime() <= now.getTime()) return false;
          if (o.effectiveFrom && o.effectiveFrom.getTime() > now.getTime()) return false;
          return true;
        })
        .sort((a, b) => a.id.localeCompare(b.id));

      const composed = composeCommercialPreview({
        baseEntitlements: planVersion.entitlements
          .map((e) => e.catalogItem.canonicalKey)
          .sort(),
        baseLimits: planVersion.limits
          .map((l) => ({
            canonicalKey: l.catalogItem.canonicalKey,
            unlimited: l.unlimited,
            valueText: l.valueText,
          }))
          .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)),
        addOns: orderedAddOns.map((v) => ({
          addOnVersionId: v.id,
          entitlements: v.entitlements.map((e) => e.catalogItem.canonicalKey).sort(),
          limitEffects: v.limitEffects
            .map((l) => ({
              canonicalKey: l.catalogItem.canonicalKey,
              effectType: l.effectType as 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED',
              unlimited: l.unlimited,
              valueText: l.valueText,
            }))
            .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)),
        })),
        overrides: eligibleOverrides.map((o) => ({
          overrideId: o.id,
          effects: o.effects
            .map((e) => ({
              effectKind: e.effectKind as
                | 'ENTITLEMENT_GRANT'
                | 'ENTITLEMENT_SUPPRESS'
                | 'LIMIT_SET_ABSOLUTE'
                | 'LIMIT_INCREASE_BY'
                | 'LIMIT_SET_UNLIMITED',
              canonicalKey: e.catalogItem.canonicalKey,
              unlimited: e.unlimited,
              valueText: e.valueText,
            }))
            .sort((a, b) =>
              `${a.canonicalKey}:${a.effectKind}`.localeCompare(`${b.canonicalKey}:${b.effectKind}`),
            ),
        })),
      });

      if (composed.conflicts?.length) {
        throw new BadRequestException({
          code: 'composition_conflict',
          message: 'Ambiguous commercial composition conflict.',
          conflicts: composed.conflicts,
        });
      }

      return {
        ...composed,
        disclaimer: COMPOSITION_DISCLAIMER,
        planCanonicalKey: planVersion.plan.canonicalKey,
        planVersionId: planVersion.id,
        planVersionLifecycle: planVersion.lifecycle,
        addonVersionIds: orderedAddOns.map((v) => v.id),
        overrideIds: eligibleOverrides.map((o) => o.id),
        ignoredOverrideIds: overrides
          .filter((o) => !eligibleOverrides.some((e) => e.id === o.id))
          .map((o) => o.id)
          .sort(),
        // Explicit sentinel — composition must never imply licensing resolve.
        licensingEngineCalled: false,
        runtimeEffective: false as const,
      };
    });
  }
}
