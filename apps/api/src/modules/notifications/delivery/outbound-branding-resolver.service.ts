import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

export interface OutboundBrandingSnapshot {
  brandingRef: string;
  clinicName: string;
  senderDisplayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  customDomain: string | null;
  portalBaseUrl: string | null;
  locale: string;
  rtl: boolean;
  emailHeaderHtml: string;
  emailFooterHtml: string;
  branchName: string | null;
}

/**
 * Phase 41e — consume-only White Label / branch branding for outbound email.
 * Does NOT redesign White Label merge. Reads tenant.features.branding + tenant/branch
 * fields already owned by Settings / Multi-Branch.
 */
@Injectable()
export class OutboundBrandingResolverService {
  private readonly logger = new Logger(OutboundBrandingResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(tenantId: string, branchId?: string | null, locale = 'en'): Promise<OutboundBrandingSnapshot> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, locale: true, customDomain: true, features: true, timezone: true },
    });

    let branchName: string | null = null;
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
        select: { name: true },
      });
      branchName = branch?.name ?? null;
    }

    const features = (tenant?.features ?? {}) as Record<string, unknown>;
    const branding = (features.branding ?? {}) as Record<string, unknown>;
    const clinicName = tenant?.name?.trim() || 'Clinic';
    const senderDisplayName =
      (typeof branding.senderDisplayName === 'string' && branding.senderDisplayName.trim()) ||
      (typeof branding.emailFromName === 'string' && branding.emailFromName.trim()) ||
      clinicName;
    const primaryColor =
      typeof branding.primaryColor === 'string' && branding.primaryColor.trim()
        ? branding.primaryColor.trim()
        : null;
    const logoUrl =
      typeof branding.logoUrl === 'string' && branding.logoUrl.trim()
        ? branding.logoUrl.trim()
        : typeof branding.logoPublicUrl === 'string' && branding.logoPublicUrl.trim()
          ? branding.logoPublicUrl.trim()
          : null;
    const customDomain = tenant?.customDomain?.trim() || null;
    const portalBaseUrl =
      (typeof branding.portalBaseUrl === 'string' && branding.portalBaseUrl.trim()) ||
      (customDomain ? `https://${customDomain}` : null);
    const resolvedLocale = locale || tenant?.locale?.split('-')[0] || 'en';
    const rtl = resolvedLocale.toLowerCase().startsWith('ar');

    const accent = primaryColor ?? '#0f766e';
    const logoBlock = logoUrl
      ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeHtml(clinicName)}" style="max-height:48px;margin-bottom:12px;" />`
      : '';
    const branchLine = branchName
      ? `<p style="margin:0;font-size:13px;color:#64748b;">${escapeHtml(branchName)}</p>`
      : '';
    const emailHeaderHtml = `
      <div style="font-family:Segoe UI,Arial,sans-serif;border-bottom:3px solid ${escapeAttr(accent)};padding:16px 0 12px;">
        ${logoBlock}
        <h1 style="margin:0;font-size:18px;color:#0f172a;">${escapeHtml(senderDisplayName)}</h1>
        ${branchLine}
      </div>`;
    const portalLink = portalBaseUrl
      ? `<p style="margin:8px 0 0;"><a href="${escapeAttr(portalBaseUrl)}" style="color:${escapeAttr(accent)};">Portal</a></p>`
      : '';
    const emailFooterHtml = `
      <div style="font-family:Segoe UI,Arial,sans-serif;border-top:1px solid #e2e8f0;margin-top:24px;padding-top:12px;font-size:12px;color:#64748b;${rtl ? 'direction:rtl;' : ''}">
        <p style="margin:0;">${escapeHtml(clinicName)}${branchName ? ` · ${escapeHtml(branchName)}` : ''}</p>
        ${portalLink}
        <p style="margin:8px 0 0;">This message was sent by your healthcare provider.</p>
      </div>`;

    const brandingRef = `wl:${tenantId}:${branchId ?? 'tenant'}:${hashLite(JSON.stringify({
      clinicName,
      senderDisplayName,
      logoUrl,
      primaryColor,
      customDomain,
      portalBaseUrl,
      resolvedLocale,
    }))}`;

    return {
      brandingRef,
      clinicName,
      senderDisplayName,
      logoUrl,
      primaryColor,
      customDomain,
      portalBaseUrl,
      locale: resolvedLocale,
      rtl,
      emailHeaderHtml,
      emailFooterHtml,
      branchName,
    };
  }

  wrapEmailHtml(bodyHtml: string, branding: OutboundBrandingSnapshot): string {
    const dir = branding.rtl ? 'rtl' : 'ltr';
    return `<!DOCTYPE html><html lang="${escapeAttr(branding.locale)}" dir="${dir}"><body style="margin:0;padding:24px;background:#f8fafc;">
      <div style="max-width:640px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;">
        ${branding.emailHeaderHtml}
        <div style="padding:16px 0;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.5;">${bodyHtml}</div>
        ${branding.emailFooterHtml}
      </div>
    </body></html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function hashLite(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
