import { Injectable, Logger } from '@nestjs/common';
import { SmsSenderPort } from './sms-sender.port';

/**
 * Production SMS adapter using Twilio REST API.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.
 */
@Injectable()
export class TwilioSmsSender implements SmsSenderPort {
  private readonly logger = new Logger(TwilioSmsSender.name);

  async sendInvite(to: string, message: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_FROM_NUMBER?.trim();

    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio credentials are not configured');
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const body = new URLSearchParams({ To: to, From: from, Body: message });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Twilio SMS failed (${response.status}): ${detail}`);
      throw new Error(`Twilio SMS delivery failed (${response.status})`);
    }

    this.logger.log(`SMS sent to ${to} via Twilio`);
  }
}
