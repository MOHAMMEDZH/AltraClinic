import type { Prisma } from '@prisma/client';
import {
  SALES_TRIAL_ALL_SCOPE_PERMISSIONS,
  SALES_TRIAL_PERMISSIONS,
} from '../platform-sales-trials.constants';
import { SalesTrialForbiddenError, SalesTrialNotFoundError } from '../domain/sales-trial.errors';

export type TrialVisibilityScope =
  | { kind: 'all' }
  | { kind: 'owned'; ownerRepresentativeId: string }
  | { kind: 'none' };

type Client = {
  platformSalesRepresentative: {
    findUnique: (args: {
      where: { platformUserId: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

export function hasTrialAllScope(perms: ReadonlySet<string>): boolean {
  return SALES_TRIAL_ALL_SCOPE_PERMISSIONS.some((key) => perms.has(key));
}

/**
 * Visibility:
 * 1. manager-style permission (trial.convert or sales-lead.assign) → every Trial
 * 2. else trial.view → only Trials owned by the actor's sales representative profile
 * 3. trial.view without a representative profile → empty list / 404 detail
 */
export async function resolveTrialVisibility(
  client: Client,
  platformUserId: string,
  perms: ReadonlySet<string>,
): Promise<TrialVisibilityScope> {
  if (hasTrialAllScope(perms)) return { kind: 'all' };
  if (!perms.has(SALES_TRIAL_PERMISSIONS.view)) {
    throw new SalesTrialForbiddenError(`Missing ${SALES_TRIAL_PERMISSIONS.view}`);
  }
  const rep = await client.platformSalesRepresentative.findUnique({
    where: { platformUserId },
    select: { id: true },
  });
  if (!rep) return { kind: 'none' };
  return { kind: 'owned', ownerRepresentativeId: rep.id };
}

export function trialVisibilityWhere(
  scope: TrialVisibilityScope,
): Prisma.PlatformSalesTrialWhereInput {
  if (scope.kind === 'all') return {};
  if (scope.kind === 'none') return { id: '00000000-0000-0000-0000-000000000000' };
  return { ownerRepresentativeId: scope.ownerRepresentativeId };
}

export function assertTrialInScope(
  scope: TrialVisibilityScope,
  trial: { ownerRepresentativeId: string | null } | null,
): void {
  if (!trial) throw new SalesTrialNotFoundError();
  if (scope.kind === 'all') return;
  if (scope.kind === 'none') throw new SalesTrialNotFoundError();
  if (trial.ownerRepresentativeId !== scope.ownerRepresentativeId) {
    throw new SalesTrialNotFoundError();
  }
}
