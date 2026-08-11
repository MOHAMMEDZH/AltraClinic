import {
  SALES_PRODUCTIVITY_PERMISSIONS,
} from '../platform-sales-productivity.constants';
import {
  SalesProductivityForbiddenError,
  SalesProductivityNotFoundError,
} from '../domain/sales-productivity.errors';
import type { ProductivityVisibilityScope } from '../domain/sales-productivity.types';
import { SALES_MAX_MANAGER_CHAIN_DEPTH } from '../../platform-sales-representatives/platform-sales-representatives.constants';

type Client = {
  platformSalesRepresentative: {
    findUnique: (args: {
      where: { platformUserId: string } | { id: string };
      select: {
        id: true;
        status: true;
        managerRepresentativeId?: true;
      };
    }) => Promise<{
      id: string;
      status: string;
      managerRepresentativeId?: string | null;
    } | null>;
    findMany: (args: {
      where: { managerRepresentativeId: { in: string[] } };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
  };
};

function hasManage(perms: ReadonlySet<string>): boolean {
  return perms.has(SALES_PRODUCTIVITY_PERMISSIONS.representativeManage);
}

function hasReview(perms: ReadonlySet<string>): boolean {
  return perms.has(SALES_PRODUCTIVITY_PERMISSIONS.snapshotReview);
}

function hasGenerate(perms: ReadonlySet<string>): boolean {
  return perms.has(SALES_PRODUCTIVITY_PERMISSIONS.snapshotGenerate);
}

/**
 * Collect manager subtree (self + reports) with a bounded BFS.
 * Depth cap matches Step 23 manager chain depth.
 */
export async function listManagerSubtreeIds(
  client: Client,
  rootRepresentativeId: string,
): Promise<string[]> {
  const result = new Set<string>([rootRepresentativeId]);
  let frontier = [rootRepresentativeId];
  let depth = 0;
  while (frontier.length > 0 && depth < SALES_MAX_MANAGER_CHAIN_DEPTH) {
    const reports = await client.platformSalesRepresentative.findMany({
      where: { managerRepresentativeId: { in: frontier } },
      select: { id: true },
    });
    const next: string[] = [];
    for (const r of reports) {
      if (!result.has(r.id)) {
        result.add(r.id);
        next.push(r.id);
      }
    }
    frontier = next;
    depth += 1;
  }
  return [...result];
}

/**
 * Visibility (contract §7):
 * - manage + generate → all
 * - manage or review → manager subtree (team)
 * - report.view / snapshot.view → own representative only
 * - suspended / missing profile → none / forbidden
 */
export async function resolveProductivityVisibility(
  client: Client,
  platformUserId: string,
  perms: ReadonlySet<string>,
  mode: 'report' | 'snapshot',
): Promise<ProductivityVisibilityScope> {
  const need =
    mode === 'report'
      ? SALES_PRODUCTIVITY_PERMISSIONS.reportView
      : SALES_PRODUCTIVITY_PERMISSIONS.snapshotView;
  if (
    !perms.has(need) &&
    !hasManage(perms) &&
    !hasReview(perms) &&
    !hasGenerate(perms)
  ) {
    throw new SalesProductivityForbiddenError(`Missing ${need}`);
  }

  if (hasManage(perms) && hasGenerate(perms)) {
    return { kind: 'all' };
  }

  const self = await client.platformSalesRepresentative.findUnique({
    where: { platformUserId },
    select: { id: true, status: true },
  });
  if (!self) return { kind: 'none' };
  if (self.status === 'SUSPENDED' || self.status === 'DISABLED') {
    throw new SalesProductivityForbiddenError('Representative profile is not active.');
  }

  if (hasManage(perms) || hasReview(perms)) {
    const ids = await listManagerSubtreeIds(client, self.id);
    return { kind: 'team', representativeIds: ids };
  }

  return { kind: 'own', representativeId: self.id };
}

export function assertRepresentativeInScope(
  scope: ProductivityVisibilityScope,
  representativeId: string,
): void {
  if (scope.kind === 'all') return;
  if (scope.kind === 'none') throw new SalesProductivityNotFoundError();
  if (scope.kind === 'own') {
    if (scope.representativeId !== representativeId) {
      throw new SalesProductivityNotFoundError();
    }
    return;
  }
  if (!scope.representativeIds.includes(representativeId)) {
    throw new SalesProductivityNotFoundError();
  }
}

export function scopedRepresentativeIds(
  scope: ProductivityVisibilityScope,
): string[] | null {
  if (scope.kind === 'all') return null;
  if (scope.kind === 'none') return [];
  if (scope.kind === 'own') return [scope.representativeId];
  return scope.representativeIds;
}
