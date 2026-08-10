/**
 * Dedicated Platform invitation delivery boundary.
 * Secret-bearing activation URLs may cross this boundary only as outbound delivery payload.
 * Delivery results, logs, and audit must never include the raw token or complete URL.
 */

export const PLATFORM_INVITATION_DELIVERY = 'PLATFORM_INVITATION_DELIVERY';

export interface PlatformInvitationOutboundPayload {
  recipientEmail: string;
  /** Bearer secret — adapter-only. Never log, audit, or return. */
  activationUrl: string;
  invitationId: string;
  platformUserId: string;
  expiresAt: Date;
  correlationId?: string;
  templateId: 'platform_user_invitation';
}

export interface PlatformInvitationDeliveryResult {
  invitationId: string;
  platformUserId: string;
  channel: string;
  deliveryStatus: 'queued' | 'sent' | 'failed';
  recipientRedacted: string;
  /** Never include activationUrl, token, or tokenHash. */
}

export interface PlatformInvitationDeliveryPort {
  deliver(payload: PlatformInvitationOutboundPayload): Promise<PlatformInvitationDeliveryResult>;
}

export function redactEmailForLogs(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  return `${local[0]}${'*'.repeat(Math.min(6, Math.max(0, local.length - 1)))}${domain}`;
}

/** Process-local capture for tests and local developer retrieval — never logged. */
export class PlatformInvitationDevMailbox {
  private static messages: Array<PlatformInvitationOutboundPayload & { capturedAt: Date }> = [];

  static capture(payload: PlatformInvitationOutboundPayload): void {
    this.messages.push({ ...payload, capturedAt: new Date() });
  }

  static takeAll(): Array<PlatformInvitationOutboundPayload & { capturedAt: Date }> {
    const copy = [...this.messages];
    this.messages = [];
    return copy;
  }

  static peekAll(): ReadonlyArray<PlatformInvitationOutboundPayload & { capturedAt: Date }> {
    return this.messages;
  }

  static clear(): void {
    this.messages = [];
  }
}
