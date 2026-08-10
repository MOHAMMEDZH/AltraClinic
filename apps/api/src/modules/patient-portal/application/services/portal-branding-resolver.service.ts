import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PatientPortalObservabilityContracts } from '../patient-portal-observability.contracts';

export interface PortalBrandSnapshot {
  clinicName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  fontFamily: string | null;
  portalName: string;
  source: 'tenant' | 'default';
}

const DEFAULTS: PortalBrandSnapshot = {
  clinicName: 'Patient Portal',
  primaryColor: '#0f766e',
  secondaryColor: '#134e4a',
  logoUrl: null,
  faviconUrl: null,
  fontFamily: null,
  portalName: 'Patient Portal',
  source: 'default',
};

/**
 * Phase 46e — consume-only White Label branding for the patient portal shell.
 * Does not redesign White Label; reads tenant.features.branding with safe fallback.
 */
@Injectable()
export class PortalBrandingResolverService {
  private readonly logger = new Logger(PortalBrandingResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: PatientPortalObservabilityContracts,
  ) {}

  async resolve(tenantId?: string | null): Promise<PortalBrandSnapshot> {
    if (!tenantId?.trim()) {
      return { ...DEFAULTS };
    }
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId.trim() },
        select: { name: true, features: true },
      });
      if (!tenant) {
        return { ...DEFAULTS };
      }
      const features = (tenant.features ?? {}) as Record<string, unknown>;
      const branding = (features.branding ?? {}) as Record<string, unknown>;
      const clinicName = tenant.name?.trim() || DEFAULTS.clinicName;
      const primaryColor =
        typeof branding.primaryColor === 'string' && branding.primaryColor.trim()
          ? branding.primaryColor.trim()
          : DEFAULTS.primaryColor;
      const secondaryColor =
        typeof branding.accentColor === 'string' && branding.accentColor.trim()
          ? branding.accentColor.trim()
          : typeof branding.secondaryColor === 'string' && branding.secondaryColor.trim()
            ? branding.secondaryColor.trim()
            : DEFAULTS.secondaryColor;
      const logoUrl =
        typeof branding.logoUrl === 'string' && branding.logoUrl.trim()
          ? branding.logoUrl.trim()
          : typeof branding.logoPublicUrl === 'string' && branding.logoPublicUrl.trim()
            ? branding.logoPublicUrl.trim()
            : null;
      const faviconUrl =
        typeof branding.faviconUrl === 'string' && branding.faviconUrl.trim()
          ? branding.faviconUrl.trim()
          : null;
      const fontFamily =
        typeof branding.fontFamily === 'string' && branding.fontFamily.trim()
          ? branding.fontFamily.trim()
          : null;
      const portalName =
        typeof branding.portalName === 'string' && branding.portalName.trim()
          ? branding.portalName.trim()
          : clinicName;

      this.logger.log(
        this.observability.createFoundationLogFields({
          event: 'branding.resolve',
          tenantId,
        }),
      );

      return {
        clinicName,
        primaryColor,
        secondaryColor,
        logoUrl,
        faviconUrl,
        fontFamily,
        portalName,
        source: 'tenant',
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
