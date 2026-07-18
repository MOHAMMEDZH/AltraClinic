import { Injectable, Logger } from '@nestjs/common';
import { EmailSenderPort } from './email-sender.port';

/**
 * Development email adapter — logs to console instead of sending real emails.
 * Replace with SendGrid/SES adapter in production via AUTH_EMAIL_ADAPTER env var.
 */
@Injectable()
export class ConsoleEmailSender implements EmailSenderPort {
  private readonly logger = new Logger(ConsoleEmailSender.name);

  async sendPasswordReset(to: string, rawToken: string): Promise<void> {
    this.logger.log(`[DEV] Password reset for ${to}: token=${rawToken.slice(0, 8)}...`);
  }

  async sendEmailVerification(to: string, rawToken: string): Promise<void> {
    this.logger.log(`[DEV] Email verification for ${to}: token=${rawToken.slice(0, 8)}...`);
  }

  async sendLoginAlert(to: string, ipAddress: string, deviceName: string | null): Promise<void> {
    this.logger.log(`[DEV] Login alert for ${to} from ${ipAddress} (${deviceName ?? 'unknown device'})`);
  }
}
