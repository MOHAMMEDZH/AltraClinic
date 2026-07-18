import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

export interface DashboardLayoutDto {
  version: number;
  hiddenWidgets: string[];
  widgetOrder: string[];
}

const LAYOUT_VERSION = 1;

@Injectable()
export class DashboardLayoutService {
  constructor(private readonly prisma: PrismaService) {}

  async getLayout(
    tenantId: string,
    userId: string,
    profile: string,
  ): Promise<DashboardLayoutDto | null> {
    const row = await this.prisma.userDashboardLayout.findUnique({
      where: { tenantId_userId_profile: { tenantId, userId, profile } },
    });
    if (!row) return null;
    const layout = row.layout as DashboardLayoutDto;
    if (layout?.version !== LAYOUT_VERSION) return null;
    if (!Array.isArray(layout.hiddenWidgets) || !Array.isArray(layout.widgetOrder)) {
      return null;
    }
    return layout;
  }

  async saveLayout(
    tenantId: string,
    userId: string,
    profile: string,
    layout: Omit<DashboardLayoutDto, 'version'>,
  ): Promise<DashboardLayoutDto> {
    const payload: DashboardLayoutDto = { version: LAYOUT_VERSION, ...layout };
    await this.prisma.userDashboardLayout.upsert({
      where: { tenantId_userId_profile: { tenantId, userId, profile } },
      create: { tenantId, userId, profile, layout: payload },
      update: { layout: payload },
    });
    return payload;
  }

  async clearLayout(tenantId: string, userId: string, profile: string): Promise<void> {
    await this.prisma.userDashboardLayout.deleteMany({
      where: { tenantId, userId, profile },
    });
  }
}
