import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface ReportBranding {
  clinicName?: string;
  logoBytes?: Uint8Array;
  logoMimeType?: string;
}

@Injectable()
export class ReportBrandingService {
  private readonly mediaBase =
    process.env.MEDIA_STORAGE_PATH?.trim() || join(process.cwd(), 'storage', 'media');

  constructor(private readonly prisma: PrismaService) {}

  async resolveBranding(tenantId: string): Promise<ReportBranding> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, features: true },
    });
    const clinicName = tenant?.name ?? undefined;
    const features = (tenant?.features ?? {}) as Record<string, unknown>;
    const branding = features.branding as Record<string, unknown> | undefined;
    const logoStorageKey =
      typeof branding?.logoStorageKey === 'string' ? branding.logoStorageKey.trim() : '';

    if (logoStorageKey) {
      const loaded = await this.loadLogo(logoStorageKey, branding?.logoMimeType);
      if (loaded) return { clinicName, ...loaded };
    }

    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        tenantId,
        ownerType: 'tenant',
        status: 'READY',
        mimeType: { startsWith: 'image/' },
      },
      orderBy: { createdAt: 'desc' },
      select: { storageKey: true, mimeType: true },
    });
    if (asset) {
      const loaded = await this.loadLogo(asset.storageKey, asset.mimeType);
      if (loaded) return { clinicName, ...loaded };
    }

    return { clinicName };
  }

  private async loadLogo(
    storageKey: string,
    mimeHint?: unknown,
  ): Promise<Pick<ReportBranding, 'logoBytes' | 'logoMimeType'> | null> {
    try {
      const fullPath = join(this.mediaBase, storageKey);
      if (!existsSync(fullPath)) return null;
      const buf = await readFile(fullPath);
      const mimeType =
        typeof mimeHint === 'string' && mimeHint.trim()
          ? mimeHint.trim()
          : storageKey.toLowerCase().endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
      return { logoBytes: new Uint8Array(buf), logoMimeType: mimeType };
    } catch {
      return null;
    }
  }
}
