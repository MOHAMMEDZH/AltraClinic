import { Injectable } from '@nestjs/common';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { RealtimeChannel } from '../../../realtime/domain/realtime.types';

@Injectable()
export class WorkflowRealtimeService {
  constructor(private readonly broadcast: RealtimeBroadcastService) {}

  async publish(
    tenantId: string,
    branchId: string | null,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.broadcast.publish({
      eventId: `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      tenantId,
      branchId,
      channel: 'workflows' as RealtimeChannel,
      type,
      payload,
    });
  }
}
