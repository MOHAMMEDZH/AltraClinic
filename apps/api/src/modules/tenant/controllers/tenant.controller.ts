import { Body, Controller, Get, Param, Post, NotFoundException, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CreateTenantDTO } from '../application/dto/create-tenant.dto';
import { CreateTenantHandler } from '../application/handlers/create-tenant.handler';
import { GetTenantHandler } from '../application/handlers/get-tenant.handler';

@Controller('tenants')
@UseGuards(TenantScopedAccessGuard)
export class TenantController {
  constructor(private readonly createHandler: CreateTenantHandler, private readonly getHandler: GetTenantHandler) {}

  @Post()
  @RequirePermission('api.tenant', 'create')
  async create(@Body() body: CreateTenantDTO) {
    const result = await this.createHandler.execute({ name: body.name, domain: body.domain, timezone: body.timezone });
    return { id: result.tenantId };
  }

  @Get(':id')
  @RequirePermission('api.tenant', 'view')
  async get(@Param('id') id: string) {
    const result = await this.getHandler.execute({ id });
    if (!result) throw new NotFoundException('Tenant not found');
    return result;
  }
}
