export type WhatsAppTemplateId =
  | 'appointmentReminder'
  | 'followUp'
  | 'welcome'
  | 'custom';

export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  const text = encodeURIComponent(message.trim());
  return `https://wa.me/${digits}${text ? `?text=${text}` : ''}`;
}

/** WhatsApp is the primary patient messaging channel when a phone number exists. */
export function canContactViaWhatsApp(
  phone: string | null | undefined,
  whatsappEnabled: boolean | undefined,
): boolean {
  return Boolean(phone?.trim()) && whatsappEnabled !== false;
}

export function resolveWhatsAppEnabled(
  phone: string | null | undefined,
  whatsappEnabled: boolean | undefined,
): boolean {
  if (!phone?.trim()) return false;
  if (whatsappEnabled === undefined) return true;
  return whatsappEnabled;
}

export function renderWhatsAppTemplate(
  t: (key: string) => string,
  templateKey: string,
  vars: { name: string },
): string {
  return t(templateKey).replace('{name}', vars.name);
}
