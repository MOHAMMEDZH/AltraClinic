import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

export interface DashboardBranchDto {
  id: string;
  name: string;
  nameAr: string | null;
}

@Injectable()
export class DashboardBranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTenant(tenantId: string): Promise<DashboardBranchDto[]> {
    const rows = await this.prisma.branch.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      select: { id: true, name: true, nameAr: true },
      orderBy: { name: 'asc' },
    });

    return rows;
  }
}
