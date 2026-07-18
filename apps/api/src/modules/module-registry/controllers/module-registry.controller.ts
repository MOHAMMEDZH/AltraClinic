import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';

import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';

import { RequirePermission } from '../../auth/api/guards/permission.guard';

import { ModuleRegistryService } from '../application/module-registry.service';



interface AuthenticatedRequest {

  user?: { id: string; sub?: string; roles: string[] };

}



@Controller('tenant/modules/registry')

@UseGuards(TenantScopedAccessGuard)

export class ModuleRegistryController {

  constructor(private readonly registryService: ModuleRegistryService) {}



  private roles(request: AuthenticatedRequest): string[] {

    return request.user?.roles ?? [];

  }



  /** User-scoped bootstrap — any authenticated tenant user (SSOT §9.2). RBAC applied server-side. */

  @Get('bootstrap')

  async bootstrap(@Req() request: AuthenticatedRequest) {

    return this.registryService.getBootstrapPayload(this.roles(request));

  }



  @Get()

  @RequirePermission('api.subscription', 'view')

  async listEffective(@Req() request: AuthenticatedRequest) {

    return this.registryService.getEffectiveModuleViews(this.roles(request));

  }



  @Get('manifests')

  @RequirePermission('api.subscription', 'view')

  listManifests() {

    return this.registryService.listManifests();

  }



  @Get('manifests/:moduleId')

  @RequirePermission('api.subscription', 'view')

  getManifest(@Param('moduleId') moduleId: string) {

    return this.registryService.getManifest(moduleId) ?? null;

  }



  @Get('dependencies')

  @RequirePermission('api.subscription', 'view')

  getDependencies() {

    return this.registryService.getDependencyGraph();

  }



  @Get('health/:moduleId')

  @RequirePermission('api.subscription', 'view')

  getHealth(@Param('moduleId') moduleId: string) {

    return this.registryService.getModuleHealth(moduleId);

  }



  @Get('effective/:moduleId')

  @RequirePermission('api.subscription', 'view')

  async getEffective(@Param('moduleId') moduleId: string, @Req() request: AuthenticatedRequest) {

    return (await this.registryService.getEffectiveModuleView(moduleId, this.roles(request))) ?? null;

  }

}


