import { Injectable, Logger } from '@nestjs/common';
import { EmailSenderPort } from './email-sender.port';
import {
  PlatformInvitationDevMailbox,
  redactEmailForLogs,
} from './platform-invitation-delivery.port';
import { randomUUID } from 'crypto';

/**
 * Development email adapter — password-reset / verification / login alerts.
 * Platform invitations must use PlatformInvitationDeliveryPort; this method
 * remains only as a defensive no-URL logger if mistakenly called.
 */
@Injectable()
export class ConsoleEmailSender implements EmailSenderPort {
  private readonly logger = new Logger(ConsoleEmailSender.name);

  async sendPasswordReset(to: string, rawToken: string): Promise<void> {
    this.logger.log(`[DEV] Password reset for ${redactEmailForLogs(to)}: token=${rawToken.slice(0, 8)}...`);
  }

  async sendEmailVerification(to: string, rawToken: string): Promise<void> {
    this.logger.log(`[DEV] Email verification for ${redactEmailForLogs(to)}: token=${rawToken.slice(0, 8)}...`);
  }

  async sendLoginAlert(to: string, ipAddress: string, deviceName: string | null): Promise<void> {
    this.logger.log(
      `[DEV] Login alert for ${redactEmailForLogs(to)} from ${ipAddress} (${deviceName ?? 'unknown device'})`,
    );
  }

  /**
   * @deprecated Prefer PLATFORM_INVITATION_DELIVERY. Never logs the activation URL.
   */
  async sendPlatformInvitation(to: string, activationUrl: string): Promise<void> {
    const invitationId = randomUUID();
    PlatformInvitationDevMailbox.capture({
      recipientEmail: to,
      activationUrl,
      invitationId,
      platformUserId: 'unknown',
      expiresAt: new Date(0),
      templateId: 'platform_user_invitation',
    });
    this.logger.log(
      `[DEV] Platform invitation queued invitationId=${invitationId} recipient=${redactEmailForLogs(to)} channel=dev_mailbox status=queued`,
    );
  }
}
