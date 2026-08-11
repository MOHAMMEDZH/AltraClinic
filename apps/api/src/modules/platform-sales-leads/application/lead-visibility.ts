import type { Prisma } from '@prisma/client';
import { SALES_LEAD_PERMISSIONS } from '../platform-sales-leads.constants';
import { SalesLeadForbiddenError, SalesLeadNotFoundError } from '../domain/sales-lead.errors';

export type LeadVisibilityScope =
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

/**
 * Visibility:
 * 1. sales-lead.assign → all leads
 * 2. else view/manage → only ownerRepresentativeId = actor's rep profile
 * 3. no rep profile and no assign → empty / deny detail
 */
export async function resolveLeadVisibility(
  client: Client,
  platformUserId: string,
  perms: ReadonlySet<string>,
): Promise<LeadVisibilityScope> {
  if (perms.has(SALES_LEAD_PERMISSIONS.assign)) {
    return { kind: 'all' };
  }
  if (!perms.has(SALES_LEAD_PERMISSIONS.view) && !perms.has(SALES_LEAD_PERMISSIONS.manage)) {
    throw new SalesLeadForbiddenError('Missing sales-lead.view');
  }
  const rep = await client.platformSalesRepresentative.findUnique({
    where: { platformUserId },
    select: { id: true },
  });
  if (!rep) return { kind: 'none' };
  return { kind: 'owned', ownerRepresentativeId: rep.id };
}

export function leadVisibilityWhere(scope: LeadVisibilityScope): Prisma.PlatformSalesLeadWhereInput {
  if (scope.kind === 'all') return {};
  if (scope.kind === 'none') return { id: '00000000-0000-0000-0000-000000000000' };
  return { ownerRepresentativeId: scope.ownerRepresentativeId };
}

export function assertLeadInScope(
  scope: LeadVisibilityScope,
  lead: { ownerRepresentativeId: string | null } | null,
): void {
  if (!lead) throw new SalesLeadNotFoundError();
  if (scope.kind === 'all') return;
  if (scope.kind === 'none') throw new SalesLeadNotFoundError();
  if (lead.ownerRepresentativeId !== scope.ownerRepresentativeId) {
    throw new SalesLeadNotFoundError();
  }
}
