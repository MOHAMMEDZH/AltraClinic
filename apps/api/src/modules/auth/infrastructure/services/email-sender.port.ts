/**
 * Port for transactional email delivery.
 * Concrete: ConsoleEmailSender (dev), SendGrid/SES adapter (prod).
 */
export interface EmailSenderPort {
  sendPasswordReset(to: string, rawToken: string, locale?: string): Promise<void>;
  sendEmailVerification(to: string, rawToken: string, locale?: string): Promise<void>;
  sendLoginAlert(to: string, ipAddress: string, deviceName: string | null): Promise<void>;
  /**
   * @deprecated Use PLATFORM_INVITATION_DELIVERY. Implementations must not log the URL.
   */
  sendPlatformInvitation(to: string, activationUrl: string): Promise<void>;
}

export const EMAIL_SENDER = 'EMAIL_SENDER';
