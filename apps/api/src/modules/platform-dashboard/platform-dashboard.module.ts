/**
 * Release 47 Step 10 — Platform Dashboard MVP module.
 *
 * Imports AuthModule to reuse the platform authorization service (per-metric
 * permission checks) and the platform-auth route boundary. PrismaService comes
 * from the global InfrastructureModule.
 */
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './application/platform-dashboard.service';
import {
  PLATFORM_DASHBOARD_CONFIG,
  loadPlatformDashboardConfig,
  type PlatformDashboardConfig,
} from './config/platform-dashboard.config';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [PlatformDashboardController],
  providers: [
    PlatformDashboardService,
    {
      provide: PLATFORM_DASHBOARD_CONFIG,
      useFactory: (): PlatformDashboardConfig => loadPlatformDashboardConfig(),
    },
  ],
  exports: [PlatformDashboardService],
})
export class PlatformDashboardModule {}
