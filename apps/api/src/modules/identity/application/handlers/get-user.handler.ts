import { Inject, Injectable } from '@nestjs/common';
import { GetUserQuery } from '../queries/get-user.query';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { UserRepository } from '../../domain/user.repository.interface';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { toUserDetailDto } from '../mappers/user.mapper';

@Injectable()
export class GetUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetUserQuery) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(query.id, tenant.tenantId);
    if (!user) return null;
    const [branchRows, customRoleRows, regionRows, dbUser] = await Promise.all([
      this.prisma.userBranchAccess.findMany({
        where: { userId: user.id, tenantId: tenant.tenantId },
        select: { branchId: true },
      }),
      this.prisma.userCustomRole.findMany({
        where: { userId: user.id, tenantId: tenant.tenantId },
        select: { customRoleId: true },
      }),
      this.prisma.userRegionAccess.findMany({
        where: { userId: user.id, tenantId: tenant.tenantId },
        select: { regionId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { branchAccessMode: true },
      }),
    ]);
    const branchAccessMode =
      dbUser?.branchAccessMode === 'MULTI'
        ? 'multi'
        : dbUser?.branchAccessMode === 'GLOBAL'
          ? 'global'
          : 'single';
    return toUserDetailDto(
      user,
      branchRows.map((b) => b.branchId),
      {
        customRoleIds: customRoleRows.map((r) => r.customRoleId),
        branchAccessMode,
        regionIds: regionRows.map((r) => r.regionId),
      },
    );
  }
}
