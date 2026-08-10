/**

 * Release 47 Step 10 — Platform Dashboard MVP controller.

 *

 * Boundary:

 *  - `@PlatformAuthRoute()` — a valid platform access token is REQUIRED. The

 *    global JwtAuthGuard rejects tenant/patient tokens on this route.

 *  - There is deliberately NO single `@RequirePlatformPermission` for the whole

 *    endpoint. Authorization is enforced PER METRIC inside the service, so an

 *    operator with only `tenant.view` still gets a useful (partial) dashboard.

 *

 * Read-only. No mutations, no Step 11+ domain management.

 *

 * Refresh hardening: manual refresh is POST-only (`/platform/dashboard/refresh`)

 * so browsers cannot prefetch it; both routes emit `Cache-Control: no-store`.

 */

import { Controller, Get, Header, Post } from '@nestjs/common';

import { PlatformAuthRoute } from '../auth/api/decorators/platform-auth-route.decorator';

import { CurrentUser } from '../auth/api/decorators/current-user.decorator';

import { JwtClaimsVO } from '../auth/domain/value-objects/jwt-claims.vo';

import { PlatformDashboardService } from './application/platform-dashboard.service';

import type { PlatformDashboardDto } from './application/dto/platform-dashboard.dto';



@Controller('platform/dashboard')

@PlatformAuthRoute()

export class PlatformDashboardController {

  constructor(private readonly dashboard: PlatformDashboardService) {}



  /** Cached snapshot — never accepts a refresh query param (prefetch-safe). */

  @Get()

  @Header('Cache-Control', 'no-store')

  async getDashboard(@CurrentUser() user: JwtClaimsVO): Promise<PlatformDashboardDto> {

    return this.dashboard.getDashboard(user);

  }



  /** Explicit manual refresh — bypasses cache (rate-limited per user). POST-only. */

  @Post('refresh')

  @Header('Cache-Control', 'no-store')

  async refreshDashboard(@CurrentUser() user: JwtClaimsVO): Promise<PlatformDashboardDto> {

    return this.dashboard.getDashboard(user, { refresh: true });

  }

}


