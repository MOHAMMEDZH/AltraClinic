import { ForbiddenException } from '@nestjs/common';
import { PortalAccount } from '../../domain/entities/portal-account.entity';

/**
 * ABAC ownership check (SECURITY.md §3): patient self-service actions may only be
 * performed by the patient who owns the account. RBAC alone cannot express this,
 * so it is enforced consistently here rather than duplicated across handlers.
 */
export function assertPortalAccountOwner(account: PortalAccount, actorId: string, action: string): void {
  const owner = account.userId;
  if (!owner || !actorId?.trim() || owner !== actorId.trim()) {
    throw new ForbiddenException(`Only the account owner may ${action}`);
  }
}
