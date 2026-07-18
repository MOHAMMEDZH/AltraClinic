import { Injectable, Logger } from '@nestjs/common';
import { SmsSenderPort } from './sms-sender.port';

/**
 * Development SMS adapter — logs to console instead of sending real SMS.
 * Replace with Twilio/MessageBird adapter in production via SMS adapter env.
 */
@Injectable()
export class ConsoleSmsSender implements SmsSenderPort {
  private readonly logger = new Logger(ConsoleSmsSender.name);

  async sendInvite(to: string, message: string): Promise<void> {
    this.logger.log(`[DEV SMS] To ${to}: ${message}`);
  }
}
