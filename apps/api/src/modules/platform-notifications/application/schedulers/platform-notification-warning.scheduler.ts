import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  WARNING_WINDOWS_MS,
  isPlatformNotificationFailureInjectionActive,
} from '../../platform-notifications.constants';
import { PlatformNotificationValidationError } from '../../domain/platform-notifications.errors';
import { PlatformNotificationEventAdapters } from '../adapters/platform-notification-event.adapters';

function windowKeyFor(end: Date, now: Date): string | null {
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  if (ms <= WARNING_WINDOWS_MS.d1) return 'd1';
  if (ms <= WARNING_WINDOWS_MS.d7) return 'd7';
  return null;
}

export type ScanEligibilityKind = 'addon' | 'override' | 'commercial_config';

export interface ScanEligibilityRow {
  kind: ScanEligibilityKind;
  id: string;
  windowKey: 'd7' | 'd1' | 'expired';
  endsAt: string;
  platformTenantId: string | null;
  organizationName: string | null;
  label: string;
}

export interface RunDueScanResult {
  scanned: number;
  /** Rows for which the caller (test harness / ops job) should invoke the matching adapter. */
  eligible: ScanEligibilityRow[];
  /** Always 0 from this scan alone — dispatch is intentionally decoupled (see class docs). */
  dispatched: number;
}

/**
 * Flexible Step 27 — UTC advance-warning / reminder scan.
 *
 * Deliberately dispatch-free: this method only performs the read-only scan + deterministic
 * window classification + structured eligibility logging described in
 * docs/NOTIFICATIONS_AND_TEMPLATES.md. It never calls `PlatformNotificationEventAdapters`
 * directly, because recipient resolution (which platform_user owns/watches a given
 * tenant/config/override) is policy owned by the caller (ops job or test harness), not by the
 * scan itself — the scan has no reliable way to pick "the" recipient for an arbitrary add-on/
 * override row. Callers (including tests proving TW dispatch/dedupe behavior) take the
 * `eligible` rows returned here and invoke `PlatformNotificationEventAdapters.addOnExpiry` /
 * `.overrideExpiry` / `.subscriptionEvent` directly with a resolved recipient.
 */
@Injectable()
export class PlatformNotificationWarningScheduler {
  private readonly logger = new Logger(PlatformNotificationWarningScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapters: PlatformNotificationEventAdapters,
  ) {}

  async runDueScan(now = new Date()): Promise<RunDueScanResult> {
    if (isPlatformNotificationFailureInjectionActive('warning_scheduler')) {
      throw new PlatformNotificationValidationError(
        'Injected warning scheduler failure',
        'injected_failure',
      );
    }
    if (isPlatformNotificationFailureInjectionActive('retry_scheduler')) {
      throw new PlatformNotificationValidationError(
        'Injected retry scheduler failure',
        'injected_failure',
      );
    }

    let scanned = 0;
    const eligible: ScanEligibilityRow[] = [];

    // Add-on assignments inherit their expiry from the owning commercial config's
    // `commercialEnd` — PlatformSubscriptionAddOnAssignment carries no expiry of its own.
    const addOnInjected = isPlatformNotificationFailureInjectionActive('addon_expiry_source');
    const addOns = addOnInjected
      ? []
      : await this.prisma.withPlatformBypass((client) =>
          client.platformSubscriptionAddOnAssignment.findMany({
            where: { config: { commercialEnd: { not: null } } },
            select: {
              id: true,
              addOnVersion: { select: { addOn: { select: { canonicalKey: true } } } },
              config: {
                select: {
                  platformTenantId: true,
                  commercialEnd: true,
                  platformTenant: { select: { displayName: true } },
                },
              },
            },
            orderBy: [{ id: 'asc' }],
            take: 200,
          }),
        );
    if (addOnInjected) {
      throw new PlatformNotificationValidationError(
        'Injected add-on expiry source failure',
        'injected_failure',
      );
    }

    for (const row of addOns) {
      scanned += 1;
      const end = row.config.commercialEnd;
      if (!end) continue;
      const wk = windowKeyFor(end, now);
      if (!wk) continue;
      this.logger.debug?.(`addon eligibility ${row.id} window=${wk} end=${end.toISOString()}`);
      eligible.push({
        kind: 'addon',
        id: row.id,
        windowKey: wk as 'd7' | 'd1' | 'expired',
        endsAt: end.toISOString(),
        platformTenantId: row.config.platformTenantId,
        organizationName: row.config.platformTenant?.displayName ?? null,
        label: row.addOnVersion.addOn.canonicalKey,
      });
    }

    // Overrides carry their own expiresAt; only APPROVED (active) overrides are in scope.
    const overrideInjected = isPlatformNotificationFailureInjectionActive('override_expiry_source');
    const overrides = overrideInjected
      ? []
      : await this.prisma.withPlatformBypass((client) =>
          client.platformCommercialOverride.findMany({
            where: { lifecycle: 'APPROVED', expiresAt: { not: null } },
            select: { id: true, expiresAt: true, reasonCode: true },
            orderBy: [{ id: 'asc' }],
            take: 200,
          }),
        );
    if (overrideInjected) {
      throw new PlatformNotificationValidationError(
        'Injected override expiry source failure',
        'injected_failure',
      );
    }

    for (const row of overrides) {
      scanned += 1;
      if (!row.expiresAt) continue;
      const wk = windowKeyFor(row.expiresAt, now);
      if (!wk) continue;
      this.logger.debug?.(
        `override eligibility ${row.id} window=${wk} end=${row.expiresAt.toISOString()}`,
      );
      eligible.push({
        kind: 'override',
        id: row.id,
        windowKey: wk as 'd7' | 'd1' | 'expired',
        endsAt: row.expiresAt.toISOString(),
        platformTenantId: null,
        organizationName: null,
        label: row.reasonCode,
      });
    }

    void this.adapters;
    return { scanned, eligible, dispatched: 0 };
  }

  /**
   * Deterministic eligibility helper for TW/T matrices (pure).
   */
  static classifyWindow(end: Date, now: Date): 'd7' | 'd1' | 'expired' | null {
    return windowKeyFor(end, now) as 'd7' | 'd1' | 'expired' | null;
  }
}
