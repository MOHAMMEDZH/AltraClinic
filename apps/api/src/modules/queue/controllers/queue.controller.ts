import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { IsIn, IsUUID } from 'class-validator';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ListWaitingQueueHandler } from '../application/handlers/list-waiting-queue.handler';
import { UpdateQueueStatusHandler } from '../application/handlers/update-queue-status.handler';
import {
  CallNextQueueHandler,
  CheckInQueueHandler,
  GetQueueBoardHandler,
  GetQueueMetricsHandler,
} from '../application/handlers/queue-board.handlers';
import {
  ReorderQueueDTO,
  ReorderQueueHandler,
  TransferQueueDTO,
  TransferQueueHandler,
  UpdateQueuePriorityDTO,
  UpdateQueuePriorityHandler,
} from '../application/handlers/queue-advanced.handlers';
import {
  ExportQueueHandler,
  GetQueueAnalyticsHandler,
  GetQueueHistoryHandler,
  AssignQueueRoomHandler,
  AssignQueueRoomDTO,
  RemoveQueueTicketHandler,
  WalkInQueueDTO,
  WalkInQueueHandler,
} from '../application/handlers/queue-extended.handlers';

class UpdateQueueStatusDTO {
  @IsIn(['called', 'serving', 'completed', 'skipped', 'cancelled', 'no_show'])
  status!: 'called' | 'serving' | 'completed' | 'skipped' | 'cancelled' | 'no_show';
}

class CheckInQueueDTO {
  @IsUUID()
  appointmentId!: string;
}

@Controller('queue')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('queue')
export class QueueController {
  constructor(
    private readonly listWaitingQueue: ListWaitingQueueHandler,
    private readonly updateStatus: UpdateQueueStatusHandler,
    private readonly getBoard: GetQueueBoardHandler,
    private readonly getMetrics: GetQueueMetricsHandler,
    private readonly checkIn: CheckInQueueHandler,
    private readonly callNext: CallNextQueueHandler,
    private readonly reorder: ReorderQueueHandler,
    private readonly transfer: TransferQueueHandler,
    private readonly updatePriority: UpdateQueuePriorityHandler,
    private readonly analytics: GetQueueAnalyticsHandler,
    private readonly exportQueue: ExportQueueHandler,
    private readonly walkIn: WalkInQueueHandler,
    private readonly removeTicket: RemoveQueueTicketHandler,
    private readonly history: GetQueueHistoryHandler,
    private readonly assignRoom: AssignQueueRoomHandler,
  ) {}

  @Get('board')
  @RequirePermission('api.queue', 'view')
  async board(
    @Query('branchId') branchId?: string,
    @Query('providerId') providerId?: string,
  ) {
    const scope = branchId === undefined ? undefined : branchId.trim() || null;
    return this.getBoard.execute(scope, providerId);
  }

  @Get('history')
  @RequirePermission('api.queue', 'view')
  async getHistory(
    @Query('branchId') branchId?: string,
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const scope = branchId === undefined ? undefined : branchId.trim() || null;
    return this.history.execute({
      branchId: scope,
      patientId,
      providerId,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('metrics/summary')
  @RequirePermission('api.queue', 'view')
  async metrics(@Query('branchId') branchId?: string) {
    const scope = branchId === undefined ? undefined : branchId.trim() || null;
    return this.getMetrics.execute(scope);
  }

  @Get('analytics')
  @RequirePermission('api.queue', 'view')
  async getAnalytics(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const scope = branchId === undefined ? undefined : branchId.trim() || null;
    return this.analytics.execute(scope, from, to);
  }

  @Get('export')
  @RequirePermission('api.queue', 'export')
  @Header('Content-Type', 'text/csv')
  async export(@Query('branchId') branchId?: string) {
    const scope = branchId === undefined ? undefined : branchId.trim() || null;
    const result = await this.exportQueue.execute(scope);
    return result.csv;
  }

  @Get('waiting')
  @RequirePermission('api.queue', 'view')
  async waiting(@Query('branchId') branchId?: string) {
    return await this.listWaitingQueue.execute(branchId?.trim() || null);
  }

  @Post('check-in')
  @RequirePermission('api.queue', 'update')
  async postCheckIn(
    @Body() body: CheckInQueueDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.checkIn.execute(body.appointmentId, user.sub);
  }

  @Post('walk-in')
  @RequirePermission('api.queue', 'create')
  async postWalkIn(@Body() body: WalkInQueueDTO, @CurrentUser() user: JwtClaimsVO) {
    return this.walkIn.execute(body, user.sub);
  }

  @Post('call-next')
  @RequirePermission('api.queue', 'update')
  async postCallNext(
    @Query('branchId') branchId?: string,
    @Query('providerId') providerId?: string,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    try {
      return await this.callNext.execute(
        providerId?.trim() || null,
        branchId?.trim() || null,
        user.sub,
      );
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw err;
    }
  }

  @Post('reorder')
  @RequirePermission('api.queue', 'manage')
  async postReorder(@Body() body: ReorderQueueDTO) {
    return this.reorder.execute(body.ticketIds, body.branchId?.trim() || null);
  }

  @Patch(':id/status')
  @RequirePermission('api.queue', 'update')
  async patchStatus(
    @Param('id') id: string,
    @Body() body: UpdateQueueStatusDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const result = await this.updateStatus.execute(id, body.status, user.sub);
    if (!result) throw new NotFoundException('Queue ticket not found');
    return result;
  }

  @Patch(':id/transfer')
  @RequirePermission('api.queue', 'manage')
  async patchTransfer(@Param('id') id: string, @Body() body: TransferQueueDTO) {
    return this.transfer.execute(id, {
      providerId: body.providerId?.trim() || null,
      branchId: body.branchId?.trim() || null,
    });
  }

  @Patch(':id/priority')
  @RequirePermission('api.queue', 'update')
  async patchPriority(@Param('id') id: string, @Body() body: UpdateQueuePriorityDTO) {
    return this.updatePriority.execute(id, body.priority);
  }

  @Patch(':id/room')
  @RequirePermission('api.queue', 'update')
  async patchRoom(
    @Param('id') id: string,
    @Body() body: AssignQueueRoomDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const resourceId = body.resourceId?.trim() || null;
    return this.assignRoom.execute(id, resourceId, user.sub);
  }

  @Delete(':id')
  @RequirePermission('api.queue', 'delete')
  async deleteTicket(@Param('id') id: string, @CurrentUser() user: JwtClaimsVO) {
    return this.removeTicket.execute(id, user.sub);
  }
}
