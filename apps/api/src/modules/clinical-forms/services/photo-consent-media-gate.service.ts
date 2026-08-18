import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

/**
 * Photo consent media gate (AR-10): when MediaAsset.requiresPhotoConsent,
 * a SIGNED PHOTO_CONSENT PatientFormInstance must exist for the patient.
 */
@Injectable()
export class PhotoConsentMediaGateService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPhotoConsentForMedia(input: {
    tenantId: string;
    mediaAssetId: string;
    actor?: { userId?: string | null } | null;
  }): Promise<void> {
    if (!input.tenantId?.trim() || !input.mediaAssetId?.trim()) {
      throw new BadRequestException('tenantId and mediaAssetId are required');
    }

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: input.mediaAssetId, tenantId: input.tenantId, deletedAt: null },
      select: {
        id: true,
        requiresPhotoConsent: true,
        patientId: true,
      },
    });
    if (!asset) throw new NotFoundException('Media asset not found');
    if (!asset.requiresPhotoConsent) return;

    if (!input.actor?.userId?.trim()) {
      throw new ForbiddenException('Authenticated actor is required for photo-consent media access');
    }

    if (!asset.patientId) {
      throw new ForbiddenException(
        'Media requires photo consent but has no patientId; access denied',
      );
    }

    const signed = await this.prisma.patientFormInstance.findFirst({
      where: {
        tenantId: input.tenantId,
        patientId: asset.patientId,
        status: 'SIGNED',
        version: {
          template: {
            kind: 'PHOTO_CONSENT',
            OR: [{ tenantId: input.tenantId }, { tenantId: null }],
          },
        },
      },
      select: { id: true },
    });

    if (!signed) {
      throw new ForbiddenException('PHOTO_CONSENT required before accessing this media');
    }
  }
}
