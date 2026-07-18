import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TransactionalEmailService } from '../../../../infrastructure/transactional-email.service';
import { NotificationChannelId, ProviderSendResult } from '../delivery.types';
import {
  NotificationProviderAdapter,
  ProviderHealth,
  ProviderSendInput,
  ProviderUnavailableError,
} from '../provider-adapter.contract';
import { OutboundBrandingResolverService } from '../outbound-branding-resolver.service';

function isConsoleAdapterUnsafeInProduction(): boolean {
  const adapter = process.env.EMAIL_ADAPTER?.trim() || 'console';
  return adapter === 'console' && process.env.NODE_ENV === 'production';
}

/**
 * Wraps TransactionalEmailService with White Label consume-only branding.
 * Console adapter must never silently succeed in production.
 */
@Injectable()
export class EmailAdapter implements NotificationProviderAdapter {
  readonly providerKey = 'email-transactional';
  readonly channelId: NotificationChannelId = 'email';

  constructor(
    private readonly email: TransactionalEmailService,
    private readonly prisma: PrismaService,
    private readonly brandingResolver: OutboundBrandingResolverService,
  ) {}

  isAvailable(): boolean {
    return !isConsoleAdapterUnsafeInProduction();
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    if (isConsoleAdapterUnsafeInProduction()) {
      throw new ProviderUnavailableError(
        this.providerKey,
        'EMAIL_ADAPTER=console is not permitted in production',
      );
    }

    const recipientEmail = await this.resolveRecipientEmail(input);
    if (!recipientEmail) {
      throw new ProviderUnavailableError(this.providerKey, 'no recipient email address on file');
    }

    const branding = await this.brandingResolver.resolve(input.tenantId, input.branchId);
    // Message HTML may already include branding from orchestrator persist; avoid double-wrap.
    const alreadyBranded = Boolean(input.html && input.html.includes('dir='));
    const bodyHtml = input.html ?? `<p>${input.body.replace(/\n/g, '<br/>')}</p>`;
    const brandedHtml = alreadyBranded
      ? bodyHtml
      : this.brandingResolver.wrapEmailHtml(bodyHtml, branding);

    await this.email.send({
      to: recipientEmail,
      subject: input.title,
      text: input.body,
      html: brandedHtml,
      fromName: branding.senderDisplayName,
    });

    return {
      success: true,
      providerKey: this.providerKey,
      channel: this.channelId,
      raw: { brandingRef: branding.brandingRef },
    };
  }

  health(): ProviderHealth {
    return isConsoleAdapterUnsafeInProduction()
      ? { healthy: false, detail: 'EMAIL_ADAPTER=console in production' }
      : { healthy: true };
  }

  private async resolveRecipientEmail(input: ProviderSendInput): Promise<string | null> {
    const metaEmail = input.metadata?.recipientEmail;
    if (typeof metaEmail === 'string' && metaEmail.trim()) {
      return metaEmail.trim();
    }
    const user = await this.prisma.user.findFirst({
      where: { id: input.recipientId, tenantId: input.tenantId },
      select: { email: true },
    });
    return user?.email ?? null;
  }
}
