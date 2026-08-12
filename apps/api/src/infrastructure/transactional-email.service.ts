import { Injectable, Logger } from '@nestjs/common';

export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Optional White Label / branch sender display name (Phase 41e). */
  fromName?: string;
  /**
   * Optional provider-level idempotency key (e.g. NotificationMessage.id).
   * Production adapters ignore this; test recording sinks may dedupe on it.
   */
  idempotencyKey?: string;
}

/**
 * Sends transactional emails. Console by default; Resend or SMTP when configured.
 */
@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  async send(payload: TransactionalEmailPayload): Promise<void> {
    const adapter = process.env.EMAIL_ADAPTER?.trim() || 'console';
    if (adapter === 'smtp') {
      await this.sendViaSmtp(payload);
      return;
    }
    if (adapter === 'resend' && process.env.RESEND_API_KEY) {
      await this.sendViaResend(payload);
      return;
    }
    this.logger.log(
      `[EMAIL] To: ${payload.to}\nSubject: ${payload.subject}\n${payload.text}`,
    );
  }

  private async sendViaSmtp(payload: TransactionalEmailPayload): Promise<void> {
    const nodemailer = await import('nodemailer');
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host) throw new Error('SMTP_HOST is required when EMAIL_ADAPTER=smtp');

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    const fromAddress = process.env.EMAIL_FROM?.trim() || 'reports@booking.local';
    const from = payload.fromName?.trim()
      ? `"${payload.fromName.replace(/"/g, '')}" <${fromAddress}>`
      : fromAddress;
    await transport.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    this.logger.log(`Email sent via SMTP → ${payload.to}`);
  }

  private async sendViaResend(payload: TransactionalEmailPayload): Promise<void> {
    const fromAddress = process.env.EMAIL_FROM?.trim() || 'reports@booking.local';
    const from = payload.fromName?.trim()
      ? `${payload.fromName.replace(/[<>]/g, '')} <${fromAddress}>`
      : fromAddress;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? undefined,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API failed: ${response.status} ${body}`);
    }
    this.logger.log(`Email sent via Resend → ${payload.to}`);
  }
}
