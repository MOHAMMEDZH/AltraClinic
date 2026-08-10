import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import {
  HEALTH_AGGREGATOR,
  type HealthAggregatorService,
} from '../application/ports/services';

/**
 * Phase 45d — platform liveness / readiness / overall health (OD-HEALTH).
 * Public for orchestrators. No PHI.
 */
@Controller()
export class PlatformHealthController {
  constructor(
    @Inject(HEALTH_AGGREGATOR)
    private readonly health: HealthAggregatorService,
  ) {}

  @Public()
  @Get('health/live')
  async live() {
    const report = await this.health.live!();
    return {
      status: report.status,
      live: report.live,
      phase: report.phase,
      checkedAt: report.checkedAt,
    };
  }

  @Public()
  @Get('health/ready')
  async ready() {
    return this.health.ready!();
  }

  @Public()
  @Get('health')
  async overall() {
    return this.health.overall!();
  }
}
