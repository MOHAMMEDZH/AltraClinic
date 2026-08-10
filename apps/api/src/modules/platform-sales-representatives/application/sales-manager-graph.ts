import { SALES_MAX_MANAGER_CHAIN_DEPTH } from '../platform-sales-representatives.constants';
import { SalesRepValidationError } from '../domain/sales-representative.errors';

export interface ManagerLookup {
  (representativeId: string): Promise<{ id: string; managerRepresentativeId: string | null } | null>;
}

/**
 * Manager assignment rules (contract §6, M01–M08):
 * - M01 self-manager denied
 * - M02 cycle denied (walking the proposed manager's existing chain)
 * - Bounded traversal — never an unbounded/adversarial walk.
 */
export async function assertNoManagerCycle(
  representativeId: string,
  proposedManagerId: string,
  lookup: ManagerLookup,
): Promise<void> {
  if (representativeId === proposedManagerId) {
    throw new SalesRepValidationError('A representative cannot be their own manager.');
  }
  let current: string | null = proposedManagerId;
  let depth = 0;
  const seen = new Set<string>();
  while (current) {
    if (depth > SALES_MAX_MANAGER_CHAIN_DEPTH) {
      throw new SalesRepValidationError('Manager chain exceeds maximum supported depth.');
    }
    if (current === representativeId) {
      throw new SalesRepValidationError('Manager assignment would create a cycle.');
    }
    if (seen.has(current)) {
      // Defensive: an already-corrupt chain must not cause an infinite loop.
      throw new SalesRepValidationError('Manager assignment would create a cycle.');
    }
    seen.add(current);
    const node = await lookup(current);
    if (!node) break;
    current = node.managerRepresentativeId;
    depth += 1;
  }
}
