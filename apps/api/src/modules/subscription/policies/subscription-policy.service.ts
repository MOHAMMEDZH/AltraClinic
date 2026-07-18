import { Injectable } from '@nestjs/common';

@Injectable()
export class SubscriptionPolicy {
  private readonly allowedRoles = ['admin', 'billing_manager', 'finance'];

  canManageSubscriptions(roles: string[]): boolean {
    return roles.some((role) => this.allowedRoles.includes(role));
  }
}
