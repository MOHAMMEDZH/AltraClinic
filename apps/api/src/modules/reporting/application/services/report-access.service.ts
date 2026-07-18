import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class ReportAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns true when the user may view/download the report (owner or active share). */
  async canAccessReport(
    tenantId: string,
    reportId: string,
    userId: string,
    userRoles: string[] = [],
    userBranchId?: string | null,
  ): Promise<boolean> {
    const share = await this.prisma.reportShareRecord.findFirst({
      where: {
        tenantId,
        reportId,
        OR: [
          { targetType: 'user', targetId: userId },
          { targetType: 'role', targetId: { in: userRoles } },
          ...(userBranchId ? [{ targetType: 'branch', targetId: userBranchId }] : []),
        ],
      },
    });
    return Boolean(share);
  }

  async assertAccessOrOwner(
    tenantId: string,
    reportId: string,
    createdBy: string,
    userId: string,
    userRoles: string[] = [],
    userBranchId?: string | null,
  ): Promise<void> {
    if (createdBy === userId) return;
    const allowed = await this.canAccessReport(tenantId, reportId, userId, userRoles, userBranchId);
    if (!allowed) {
      throw new Error('Report access denied');
    }
  }
}
