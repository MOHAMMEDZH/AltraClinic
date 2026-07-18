import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface AnalyticsLayoutDto {
  version: number;
  widgetOrder: string[];
  hiddenWidgets: string[];
  gridLayout?: Array<{ i: string; x: number; y: number; w: number; h: number }>;
}

const LAYOUT_VERSION = 1;

@Injectable()
export class AnalyticsLayoutService {
  constructor(private readonly prisma: PrismaService) {}

  async getLayout(tenantId: string, userId: string, profile: string): Promise<AnalyticsLayoutDto | null> {
    const row = await this.prisma.analyticsLayoutRecord.findUnique({
      where: { tenantId_userId_profile: { tenantId, userId, profile } },
    });
    if (!row) return null;
    const layout = row.layout as AnalyticsLayoutDto;
    if (layout?.version !== LAYOUT_VERSION) return null;
    return layout;
  }

  async saveLayout(
    tenantId: string,
    userId: string,
    profile: string,
    layout: Omit<AnalyticsLayoutDto, 'version'>,
  ): Promise<AnalyticsLayoutDto> {
    const payload: AnalyticsLayoutDto = { version: LAYOUT_VERSION, ...layout };
    await this.prisma.analyticsLayoutRecord.upsert({
      where: { tenantId_userId_profile: { tenantId, userId, profile } },
      create: { tenantId, userId, profile, layout: payload },
      update: { layout: payload },
    });
    return payload;
  }

  async clearLayout(tenantId: string, userId: string, profile: string): Promise<void> {
    await this.prisma.analyticsLayoutRecord.deleteMany({
      where: { tenantId, userId, profile },
    });
  }
}
