import { Injectable } from '@nestjs/common';

export interface WebhookDispatchResult {
  ok: boolean;
  statusCode: number;
  url: string;
}

@Injectable()
export class SettingsWebhookService {
  async dispatch(url: string, payload: Record<string, unknown>, timeoutMs = 10_000): Promise<WebhookDispatchResult> {
    const target = url.trim();
    if (!target) {
      return { ok: false, statusCode: 0, url: target };
    }

    let statusCode = 0;
    let ok = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Booking-Event': 'settings.test' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      statusCode = response.status;
      ok = response.ok;
    } catch {
      ok = false;
    }

    return { ok, statusCode, url: target };
  }
}
