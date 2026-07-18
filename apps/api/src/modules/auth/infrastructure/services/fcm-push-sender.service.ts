import { Injectable, Logger } from '@nestjs/common';
import { PushSenderPort } from './push-sender.port';

/**
 * Firebase Cloud Messaging adapter.
 * Requires FCM_SERVER_KEY or GOOGLE_APPLICATION_CREDENTIALS.
 */
@Injectable()
export class FcmPushSender implements PushSenderPort {
  private readonly logger = new Logger(FcmPushSender.name);

  async sendPush(deviceToken: string, title: string, body: string): Promise<void> {
    const serverKey = process.env.FCM_SERVER_KEY?.trim();
    if (!serverKey) {
      throw new Error('FCM credentials are not configured');
    }
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: deviceToken,
        notification: { title, body },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`FCM push failed (${response.status}): ${detail}`);
      throw new Error(`FCM push delivery failed (${response.status})`);
    }
    this.logger.log(`Push sent via FCM to ${deviceToken.slice(0, 12)}…`);
  }
}
