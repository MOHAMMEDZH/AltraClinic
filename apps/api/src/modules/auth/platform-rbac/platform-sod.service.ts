import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlatformAuthorizationService } from './platform-authorization.service';

@Injectable()
export class PlatformSodService {
  constructor(private readonly authorization: PlatformAuthorizationService) {}

  assertNotSelf(actorId: string, targetId: string, action: string): void {
    if (actorId === targetId) throw new ForbiddenException(`Cannot ${action} yourself.`);
  }

  assertMfaResetApprover(requesterId: string, approverId: string, targetId: string): void {
    if (requesterId === approverId || approverId === targetId || requesterId === targetId) {
      throw new ForbiddenException('MFA reset requires distinct requester, approver, and target.');
    }
  }

  async assertCanRemoveRole(targetId: string, roleKey: string): Promise<void> {
    if (roleKey === 'platform_owner' && await this.authorization.countActiveOwners() <= 1) {
      throw new ForbiddenException('Cannot remove the last platform owner.');
    }
    if (roleKey === 'security_administrator' && await this.authorization.countActiveSecurityAdmins() <= 1) {
      throw new ForbiddenException('Cannot remove the last security administrator.');
    }
  }

  async assertCanSuspend(actorId: string, targetId: string): Promise<void> {
    this.assertNotSelf(actorId, targetId, 'suspend');
    const roles = await this.authorization.resolveActiveRoleKeys(targetId);
    if (roles.includes('platform_owner') && await this.authorization.countActiveOwners() <= 1) {
      throw new ForbiddenException('Cannot suspend the last platform owner.');
    }
  }

  assertPlanPublishSod(creatorId?: string, approverId?: string): void {
    if (creatorId && approverId && creatorId === approverId) throw new ForbiddenException('Creator cannot approve publication.');
  }
  assertOverrideApproveSod(creatorId?: string, approverId?: string): void {
    if (creatorId && approverId && creatorId === approverId) throw new ForbiddenException('Creator cannot approve override.');
  }
}
