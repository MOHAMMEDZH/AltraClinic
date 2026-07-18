import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardOverviewService } from './application/dashboard-overview.service';
import { DashboardBranchesService } from './application/dashboard-branches.service';
import { DashboardLayoutService } from './application/dashboard-layout.service';

@Module({
  imports: [RealtimeModule],
  controllers: [DashboardController],
  providers: [DashboardOverviewService, DashboardBranchesService, DashboardLayoutService],
  exports: [DashboardOverviewService, DashboardBranchesService],
})
export class DashboardModule {}
