import { Injectable } from '@nestjs/common';
import { CreateNotificationHandler } from '../../../notifications/application/handlers/create-notification.handler';
import { CreateNotificationCommand } from '../../../notifications/application/commands/create-notification.command';

@Injectable()
export class IdentityNotificationService {
  constructor(private readonly createNotification: CreateNotificationHandler) {}

  async notifyUser(
    recipientId: string,
    title: string,
    body: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    branchId: string | null = null,
  ) {
    try {
      await this.createNotification.execute(
        new CreateNotificationCommand(recipientId, 'in-app', title, body, priority, branchId),
      );
    } catch {
      // Notifications must not block identity operations
    }
  }

  async userInvited(recipientId: string, branchId: string | null) {
    await this.notifyUser(
      recipientId,
      'Welcome to the team',
      'You have been invited. Check your email to set your password and complete setup.',
      'medium',
      branchId,
    );
  }

  async userSuspended(recipientId: string, branchId: string | null) {
    await this.notifyUser(
      recipientId,
      'Account suspended',
      'Your account has been suspended. Contact your administrator for assistance.',
      'high',
      branchId,
    );
  }

  async rolesChanged(recipientId: string, branchId: string | null) {
    await this.notifyUser(
      recipientId,
      'Roles updated',
      'Your assigned roles have been changed by an administrator.',
      'medium',
      branchId,
    );
  }

  async passwordResetForced(recipientId: string, branchId: string | null) {
    await this.notifyUser(
      recipientId,
      'Password reset required',
      'An administrator requested a password reset for your account.',
      'high',
      branchId,
    );
  }

  async accountDeactivated(recipientId: string, branchId: string | null) {
    await this.notifyUser(
      recipientId,
      'Account deactivated',
      'Your account has been deactivated. Contact your administrator if this is unexpected.',
      'high',
      branchId,
    );
  }
}
