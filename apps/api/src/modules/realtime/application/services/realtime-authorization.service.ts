import { Injectable } from '@nestjs/common';
import { PermissionAction } from '../../../../common/authorization/permission-matrix.validation';
import { RealtimeChannel } from '../../domain/realtime.types';
import { REALTIME_CHANNEL_PERMISSIONS } from '../../domain/realtime-channel.config';
import { REALTIME_CHANNEL_MODULES } from '../../domain/realtime-licensing.config';
import { RealtimeSocketUser } from '../../domain/realtime.types';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';

/**
 * Evaluates RBAC for WebSocket channel subscriptions using the same
 * permission-matrix.json as HTTP PermissionGuard.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Extract shared PermissionEvaluator used by HTTP + WS guards."
 *   Counter: Refactoring PermissionGuard is out of scope; duplicated matrix
 *   load is acceptable (cached singleton). Phase 2: unify into PermissionMatrixService.
 */
@Injectable()
export class RealtimeAuthorizationService {
  private static cachedMatrix: MatrixShape | null = null;

  constructor(private readonly licensing: LicensingExecutionGuard) {}

  canSubscribe(user: RealtimeSocketUser, channel: RealtimeChannel): boolean {
    if (user.roles.includes('super_admin')) return true;

    const perm = REALTIME_CHANNEL_PERMISSIONS[channel];
    if (!perm) return false;

    const matrix = RealtimeAuthorizationService.getMatrix();
    if (!matrix) return false;

    const resource = matrix.resources.find((r) => r.id === perm.resource);
    if (!resource) return false;

    const allowedRoles: string[] = resource.permissions[perm.action] ?? [];
    return user.roles.some((role) => allowedRoles.includes(role));
  }

  async filterAllowedChannels(user: RealtimeSocketUser, channels: RealtimeChannel[]): Promise<RealtimeChannel[]> {
    const results: RealtimeChannel[] = [];
    for (const channel of channels) {
      if (!this.canSubscribe(user, channel)) continue;
      const moduleId = REALTIME_CHANNEL_MODULES[channel];
      if (!(await this.licensing.isModuleActive(user.tenantId, moduleId))) continue;
      results.push(channel);
    }
    return results;
  }

  private static getMatrix(): MatrixShape | null {
    if (RealtimeAuthorizationService.cachedMatrix !== null) {
      return RealtimeAuthorizationService.cachedMatrix;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const matrix = require('../../../../../config/permission-matrix.json') as MatrixShape;
      RealtimeAuthorizationService.cachedMatrix = matrix;
      return matrix;
    } catch {
      RealtimeAuthorizationService.cachedMatrix = null;
      return null;
    }
  }
}

interface MatrixShape {
  resources: Array<{
    id: string;
    permissions: Record<PermissionAction, string[]>;
  }>;
}
