import { Injectable, Logger } from '@nestjs/common';
import { PushSenderPort } from './push-sender.port';

@Injectable()
export class ConsolePushSender implements PushSenderPort {
  private readonly logger = new Logger(ConsolePushSender.name);

  async sendPush(deviceToken: string, title: string, body: string): Promise<void> {
    this.logger.log(`[PUSH] to=${deviceToken.slice(0, 12)}… title="${title}" body="${body.slice(0, 80)}"`);
  }
}
