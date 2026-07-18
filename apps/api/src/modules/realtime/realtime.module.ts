import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { RealtimeGateway } from './api/realtime.gateway';
import { WsJwtAuthService } from './application/services/ws-jwt-auth.service';
import { RealtimeAuthorizationService } from './application/services/realtime-authorization.service';
import { RealtimeBroadcastService } from './application/services/realtime-broadcast.service';
import { RealtimeEventBufferService } from './application/services/realtime-event-buffer.service';
import { RealtimeDashboardService } from './application/services/realtime-dashboard.service';
import { RealtimeDomainEventListener } from './application/listeners/realtime-domain-event.listener';

@Module({
  imports: [AuthModule, SubscriptionModule],
  providers: [
    RealtimeGateway,
    WsJwtAuthService,
    RealtimeAuthorizationService,
    RealtimeBroadcastService,
    RealtimeEventBufferService,
    RealtimeDashboardService,
    RealtimeDomainEventListener,
  ],
  exports: [RealtimeBroadcastService, RealtimeEventBufferService, RealtimeDashboardService],
})
export class RealtimeModule {}
