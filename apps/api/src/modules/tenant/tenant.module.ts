import { Module } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';
import { TenantController } from './controllers/tenant.controller';
import { PrismaTenantRepository } from './infrastructure/prisma-tenant.repository';
import { CreateTenantHandler } from './application/handlers/create-tenant.handler';
import { GetTenantHandler } from './application/handlers/get-tenant.handler';
import { TENANT_REPOSITORY } from '../../infrastructure/provider.tokens';

@Module({
  controllers: [TenantController],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    CreateTenantHandler,
    GetTenantHandler,
    TenantScopedAccessGuard,
  ],
  exports: [CreateTenantHandler],
})
export class TenantModule {}
