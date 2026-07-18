import { Injectable } from '@nestjs/common';

/**
 * Authorization policy for the AI model registry.
 *
 * Enforces separation of duties (SECURITY.md §3): the role tier that can author
 * models (`ai_manager`) cannot, by itself, validate or operate them in production.
 * Governance review and lifecycle operations require an elevated role tier.
 */
@Injectable()
export class AiPolicy {
  private static readonly AUTHOR_ROLES = ['admin', 'tenant_admin', 'ai_admin', 'ai_manager', 'owner', 'general_manager', 'specialist', 'doctor', 'super_admin'];
  private static readonly GOVERNANCE_ROLES = ['admin', 'tenant_admin', 'ai_admin', 'owner', 'general_manager', 'super_admin'];

  private has(roles: string[], allowed: string[]): boolean {
    return roles.some((role) => allowed.includes(role?.toLowerCase()));
  }

  /** Create, read, and list models (authoring tier). */
  canManageModels(roles: string[]): boolean {
    return this.has(roles, AiPolicy.AUTHOR_ROLES);
  }

  /** Approve a model for deployment (governance review tier). */
  canReviewModels(roles: string[]): boolean {
    return this.has(roles, AiPolicy.GOVERNANCE_ROLES);
  }

  /** Deploy or retire a model in production (governance operations tier). */
  canOperateModels(roles: string[]): boolean {
    return this.has(roles, AiPolicy.GOVERNANCE_ROLES);
  }
}
