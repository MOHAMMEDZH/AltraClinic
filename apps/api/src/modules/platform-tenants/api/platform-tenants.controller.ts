/**
 * Release 47 Step 11 — read-only tenant directory/detail API (platform JWT).
 */
import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  PlatformTenantsDirectoryService,
  type DirectoryQuery,
} from '../application/platform-tenants-directory.service';
import { PlatformTenantsDetailService } from '../application/platform-tenants-detail.service';

@Controller('platform/tenant-directory')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformTenantsController {
  constructor(
    private readonly directory: PlatformTenantsDirectoryService,
    private readonly detail: PlatformTenantsDetailService,
  ) {}

  @Get()
  @RequirePlatformPermission('tenant.view')
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: JwtClaimsVO, @Query() query: DirectoryQuery) {
    return this.directory.listDirectory(user, query);
  }

  @Get(':id/access-summary/items/:capabilityKey')
  @RequirePlatformPermission('entitlement.view')
  @Header('Cache-Control', 'private, no-store')
  accessSummaryItem(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Param('capabilityKey') capabilityKey: string,
  ) {
    return this.detail.getAccessSummaryItem(user, id, capabilityKey);
  }

  @Get(':id/access-summary')
  @RequirePlatformPermission('entitlement.view')
  @Header('Cache-Control', 'private, no-store')
  accessSummary(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.detail.getAccessSummary(user, id);
  }

  @Get(':id')
  @RequirePlatformPermission('tenant.view')
  @Header('Cache-Control', 'private, no-store')
  getDetail(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.detail.getDetail(user, id);
  }
}
