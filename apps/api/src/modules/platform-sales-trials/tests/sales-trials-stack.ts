/**
 * Flexible Step 25 — Trial service stack factory.
 *
 * Wires the real Step 16 `PlatformSubscriptionsService` and the real Step 18
 * `EffectiveEntitlementRuntimeService` so tests observe genuine commercial snapshot
 * and runtime entitlement behaviour (never a Trial-local entitlement engine).
 */
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import {
  ALL_SUBSCRIPTION_PERMS,
  createSubscriptionsPrismaWrapper,
  createSubscriptionsService,
} from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { PlatformSubscriptionsService } from '../../platform-subscriptions/application/platform-subscriptions.service';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import { CommercialCompositionService } from '../../platform-addons/application/commercial-composition.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { TrialAdminService } from '../application/trial-admin.service';
import { TrialAuditLog } from '../application/trial-audit.log';
import { TrialConversionService } from '../application/trial-conversion.service';
import { TrialDurableIdempotencyService } from '../application/trial-durable-idempotency.service';
import { TrialEntitlementPreviewService } from '../application/trial-entitlement-preview.service';
import { TrialExpiryService } from '../application/trial-expiry.service';
import { TrialProvisioningAdapter } from '../application/trial-provisioning.adapter';
import { SALES_TRIAL_PERMISSIONS } from '../platform-sales-trials.constants';

/** sales_manager-equivalent permission set (full Trial governance). */
export const MANAGER_TRIAL_PERMS = [
  SALES_TRIAL_PERMISSIONS.view,
  SALES_TRIAL_PERMISSIONS.create,
  SALES_TRIAL_PERMISSIONS.update,
  SALES_TRIAL_PERMISSIONS.extend,
  SALES_TRIAL_PERMISSIONS.extendExceptional,
  SALES_TRIAL_PERMISSIONS.convert,
  SALES_TRIAL_PERMISSIONS.previewEntitlements,
  'sales-lead.assign',
];

/** sales_representative-equivalent permission set (own Trials only, no extend/convert). */
export const REP_TRIAL_PERMS = [
  SALES_TRIAL_PERMISSIONS.view,
  SALES_TRIAL_PERMISSIONS.create,
  SALES_TRIAL_PERMISSIONS.update,
  SALES_TRIAL_PERMISSIONS.previewEntitlements,
];

/** Representative set plus standard (non-exceptional) extend authority. */
export const EXTENDER_TRIAL_PERMS = [...REP_TRIAL_PERMS, SALES_TRIAL_PERMISSIONS.extend];

export type SalesTrialsStack = {
  prisma: PrismaService;
  trials: TrialAdminService;
  expiry: TrialExpiryService;
  conversion: TrialConversionService;
  preview: TrialEntitlementPreviewService;
  durable: TrialDurableIdempotencyService;
  audit: TrialAuditLog;
  provisioning: TrialProvisioningAdapter;
  subscriptions: PlatformSubscriptionsService;
  eer: EffectiveEntitlementRuntimeService;
  authz: PlatformAuthorizationService;
  perms: Set<string>;
};

export type CreateSalesTrialsStackOpts = {
  permissions?: string[];
  clock?: () => Date;
};

function hybrid(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function createSalesTrialsStack(
  prisma: PrismaClient,
  opts: CreateSalesTrialsStackOpts = {},
): SalesTrialsStack {
  const wrapped = hybrid(prisma);
  const perms = new Set(opts.permissions ?? MANAGER_TRIAL_PERMS);
  const users = new PrismaPlatformUserRepository(wrapped);
  const authz = new PlatformAuthorizationService(users, wrapped);
  const eer = new EffectiveEntitlementRuntimeService(wrapped);
  const composition = new CommercialCompositionService(wrapped, authz);
  const subscriptions = createSubscriptionsService({
    prisma,
    permissions: ALL_SUBSCRIPTION_PERMS,
    composition,
    effectiveEntitlements: eer,
  });
  const provisioning = new TrialProvisioningAdapter(wrapped, subscriptions, eer);
  const durable = new TrialDurableIdempotencyService(wrapped);
  const audit = new TrialAuditLog(wrapped);
  const trials = new TrialAdminService(wrapped, durable, audit, provisioning);
  const expiry = new TrialExpiryService(wrapped, audit, provisioning);
  const conversion = new TrialConversionService(wrapped, trials, durable, audit, provisioning);
  const preview = new TrialEntitlementPreviewService(wrapped, trials, eer);
  if (opts.clock) {
    trials.setClock(opts.clock);
    expiry.setClock(opts.clock);
  }
  return {
    prisma: wrapped,
    trials,
    expiry,
    conversion,
    preview,
    durable,
    audit,
    provisioning,
    subscriptions,
    eer,
    authz,
    perms,
  };
}
