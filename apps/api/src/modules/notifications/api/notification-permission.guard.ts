import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { NotificationPolicyService } from '../policies/notification-policy.service';
import { NotificationRepository } from '../domain/repositories/notification.repository.interface';
import { NOTIFICATION_REPOSITORY } from '../../../infrastructure/provider.tokens';

@Injectable()
export class NotificationPermissionGuard implements CanActivate {
  constructor(
    private readonly policy: NotificationPolicyService,
    @Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user ?? null;
    if (!user) {
      throw new UnauthorizedException('Authentication required to access notification endpoints.');
    }

    const tenantId = String(req.headers?.['x-tenant-id'] ?? req.headers?.['tenant-id'] ?? '').trim() || undefined;
    if (!tenantId) {
      throw new ForbiddenException('Tenant header is required to access notification resources.');
    }

    const allowed = await this.policy.canAccess(user, tenantId);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to access notification resources.');
    }

    const roles = Array.isArray(user.roles) ? (user.roles as string[]) : [];
    const staffRoles = new Set([
      'admin',
      'tenant_admin',
      'super_admin',
      'owner',
      'general_manager',
      'branch_manager',
      'receptionist',
      'assistant',
      'provider',
      'staff',
      'doctor',
      'dentist',
      'nurse',
      'specialist',
    ]);
    if (roles.some((role: string) => staffRoles.has(role))) {
      return true;
    }

    const userId = String((user as { id?: string; sub?: string }).id ?? (user as { sub?: string }).sub ?? '').trim();
    if (!userId) {
      throw new ForbiddenException('Authenticated user ID is required.');
    }

    const notificationId = String(req.params?.notificationId ?? '').trim();
    const method = String(req.method ?? '').toUpperCase();

    if (notificationId) {
      const notification = await this.repository.findById(notificationId, tenantId);
      if (!notification || notification.recipientId !== userId) {
        throw new ForbiddenException('You do not have permission to access this notification.');
      }
      return true;
    }

    if (method === 'GET') {
      const requestedRecipient = String(req.query?.recipientId ?? '').trim();
      if (!requestedRecipient) {
        req.query = { ...req.query, recipientId: userId };
        return true;
      }
      if (requestedRecipient !== userId) {
        throw new ForbiddenException('Patients may only query their own notifications.');
      }
      return true;
    }

    if (method === 'POST') {
      const bodyRecipient = String(req.body?.recipientId ?? '').trim();
      if (bodyRecipient && bodyRecipient !== userId) {
        throw new ForbiddenException('Patients may only create notifications addressed to themselves.');
      }
      return true;
    }

    return true;
  }
}
