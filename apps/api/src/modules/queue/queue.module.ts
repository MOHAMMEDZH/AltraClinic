import { Module } from '@nestjs/common';

import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';

import { RealtimeModule } from '../realtime/realtime.module';

import { NotificationModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../scheduling/scheduling.module';

import { QueueController } from './controllers/queue.controller';

import { QUEUE_REPOSITORY } from '../../infrastructure/provider.tokens';

import { PrismaQueueRepository } from './infrastructure/prisma-queue.repository';

import { EnqueueAppointmentHandler } from './application/handlers/enqueue-appointment.handler';

import { ListWaitingQueueHandler } from './application/handlers/list-waiting-queue.handler';

import { UpdateQueueStatusHandler } from './application/handlers/update-queue-status.handler';

import { ReorderQueueHandler, TransferQueueHandler, UpdateQueuePriorityHandler } from './application/handlers/queue-advanced.handlers';
import {
  ExportQueueHandler,
  GetQueueAnalyticsHandler,
  GetQueueHistoryHandler,
  AssignQueueRoomHandler,
  RemoveQueueTicketHandler,
  WalkInQueueHandler,
} from './application/handlers/queue-extended.handlers';
import { QueueAnalyticsService } from './application/services/queue-analytics.service';
import { QueueNotificationService } from './application/services/queue-notification.service';
import { QueueHistoryService } from './application/services/queue-history.service';
import { QueueEventService } from './application/services/queue-event.service';

import {
  CallNextQueueHandler,

  CheckInQueueHandler,

  GetQueueBoardHandler,

  GetQueueMetricsHandler,

} from './application/handlers/queue-board.handlers';

import { QueueBoardService } from './application/services/queue-board.service';

import { AppointmentScheduledQueueListener } from './application/integrations/appointment-scheduled-queue.listener';



@Module({

  imports: [RealtimeModule, NotificationModule, SchedulingModule],

  controllers: [QueueController],

  providers: [

    { provide: QUEUE_REPOSITORY, useClass: PrismaQueueRepository },

    QueueBoardService,

    QueueAnalyticsService,

    QueueNotificationService,

    QueueHistoryService,

    QueueEventService,

    EnqueueAppointmentHandler,

    ListWaitingQueueHandler,

    UpdateQueueStatusHandler,

    ReorderQueueHandler,

    TransferQueueHandler,

    UpdateQueuePriorityHandler,

    GetQueueBoardHandler,

    GetQueueMetricsHandler,

    CheckInQueueHandler,

    CallNextQueueHandler,

    GetQueueAnalyticsHandler,

    ExportQueueHandler,

    WalkInQueueHandler,

    RemoveQueueTicketHandler,

    GetQueueHistoryHandler,

    AssignQueueRoomHandler,

    AppointmentScheduledQueueListener,

    TenantScopedAccessGuard,

  ],

  exports: [EnqueueAppointmentHandler, QueueBoardService],

})

export class QueueModule {}
