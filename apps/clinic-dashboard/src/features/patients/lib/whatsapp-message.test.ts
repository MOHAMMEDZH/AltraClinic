import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppUrl,
  canContactViaWhatsApp,
  normalizeWhatsAppPhone,
  resolveWhatsAppEnabled,
} from './whatsapp-message';

describe('whatsapp-message', () => {
  it('normalizes phone digits for wa.me links', () => {
    expect(normalizeWhatsAppPhone('+963 944 123 456')).toBe('963944123456');
  });

  it('builds WhatsApp URL with encoded message', () => {
    expect(buildWhatsAppUrl('+963944123456', 'Hello there')).toBe(
      'https://wa.me/963944123456?text=Hello%20there',
    );
  });

  it('allows WhatsApp when phone exists and preference is not explicitly off', () => {
    expect(canContactViaWhatsApp('+963944123456', undefined)).toBe(true);
    expect(canContactViaWhatsApp('+963944123456', false)).toBe(false);
    expect(canContactViaWhatsApp(null, true)).toBe(false);
  });

  it('defaults WhatsApp enabled when phone exists', () => {
    expect(resolveWhatsAppEnabled('+963944123456', undefined)).toBe(true);
    expect(resolveWhatsAppEnabled('', undefined)).toBe(false);
  });
});
