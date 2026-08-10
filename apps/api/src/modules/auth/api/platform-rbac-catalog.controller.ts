import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformAuthRoute } from './decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from './decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from './guards/platform-permission.guard';
import { PLATFORM_PERMISSIONS, PLATFORM_ROLES } from '../platform-rbac/platform-rbac.catalog';
import {
  mapPlatformPermissionCatalogItem,
  mapPlatformRoleCatalogItem,
} from '../platform-rbac/platform-response.mappers';

@Controller('platform')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformRbacCatalogController {
  @Get('roles')
  @RequirePlatformPermission('platform-role.view')
  roles() {
    return PLATFORM_ROLES.map(mapPlatformRoleCatalogItem);
  }

  @Get('permissions')
  @RequirePlatformPermission('platform-permission.view')
  permissions() {
    return PLATFORM_PERMISSIONS.map(mapPlatformPermissionCatalogItem);
  }
}
