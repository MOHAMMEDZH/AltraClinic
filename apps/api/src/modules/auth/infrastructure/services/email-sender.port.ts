/**
 * Port for transactional email delivery.
 * Concrete: ConsoleEmailSender (dev), SendGrid/SES adapter (prod).
 */
export interface EmailSenderPort {
  sendPasswordReset(to: string, rawToken: string, locale?: string): Promise<void>;
  sendEmailVerification(to: string, rawToken: string, locale?: string): Promise<void>;
  sendLoginAlert(to: string, ipAddress: string, deviceName: string | null): Promise<void>;
}

export const EMAIL_SENDER = 'EMAIL_SENDER';
