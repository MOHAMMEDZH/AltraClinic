import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  PlatformInvitationDeliveryPort,
  PlatformInvitationDeliveryResult,
  PlatformInvitationDevMailbox,
  PlatformInvitationOutboundPayload,
  redactEmailForLogs,
} from './platform-invitation-delivery.port';
import { assertDevInvitationMailboxAllowed } from '../../platform-rbac/platform-invitation-delivery.policy';

/**
 * Process-local invitation delivery for automated tests and explicitly allowed local development.
 * Never logs the activation URL or raw token. Denied by default outside the allowlist policy.
 */
@Injectable()
export class DevMailboxPlatformInvitationDelivery implements PlatformInvitationDeliveryPort {
  private readonly logger = new Logger(DevMailboxPlatformInvitationDelivery.name);

  async deliver(payload: PlatformInvitationOutboundPayload): Promise<PlatformInvitationDeliveryResult> {
    try {
      assertDevInvitationMailboxAllowed();
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Development mailbox denied.';
      this.logger.error(
        `Platform invitation delivery refused invitationId=${payload.invitationId} platformUserId=${payload.platformUserId} reason=${reason}`,
      );
      throw new ServiceUnavailableException('Invitation delivery is not configured.');
    }

    try {
      PlatformInvitationDevMailbox.capture(payload);
      const result: PlatformInvitationDeliveryResult = {
        invitationId: payload.invitationId,
        platformUserId: payload.platformUserId,
        channel: 'dev_mailbox',
        deliveryStatus: 'queued',
        recipientRedacted: redactEmailForLogs(payload.recipientEmail),
      };
      this.logger.log(
        `Platform invitation queued invitationId=${result.invitationId} platformUserId=${result.platformUserId} recipient=${result.recipientRedacted} channel=${result.channel} status=${result.deliveryStatus}`,
      );
      return result;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const message = err instanceof Error ? err.message : 'delivery failed';
      this.logger.error(
        `Platform invitation delivery failed invitationId=${payload.invitationId} platformUserId=${payload.platformUserId} reason=${message}`,
      );
      throw new ServiceUnavailableException('Invitation delivery failed.');
    }
  }
}
