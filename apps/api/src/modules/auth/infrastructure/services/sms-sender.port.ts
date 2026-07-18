/**
 * Port for transactional SMS delivery.
 * Concrete: ConsoleSmsSender (dev), Twilio adapter (prod).
 */
export interface SmsSenderPort {
  sendInvite(to: string, message: string): Promise<void>;
}

export const SMS_SENDER = 'SMS_SENDER';
