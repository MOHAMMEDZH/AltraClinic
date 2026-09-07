import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';

function schedulersEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.BACKGROUND_SCHEDULERS_ENABLED === 'false') return false;
  return true;
}

/**
 * PA-04 proactive activator — latency optimization only.
 * Correctness remains on live-read reconcileCommercialTimeline.
 */
@Injectable()
export class ClinicalPriceScheduleActivator {
  private readonly logger = new Logger(ClinicalPriceScheduleActivator.name);
  private runs = 0;
  private lastProcessed = 0;

  constructor(private readonly prices: ClinicalPriceVersionService) {}

  getRunCount(): number {
    return this.runs;
  }

  getLastProcessed(): number {
    return this.lastProcessed;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.runOnce();
  }

  async runOnce(): Promise<number> {
    this.runs += 1;
    try {
      this.lastProcessed = await this.prices.activateDueSchedules(200);
      if (this.lastProcessed > 0) {
        this.logger.log(
          JSON.stringify({
            component: 'clinical_price_schedule_activator',
            event: 'ran',
            processedKeys: this.lastProcessed,
          }),
        );
      }
      return this.lastProcessed;
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          component: 'clinical_price_schedule_activator',
          event: 'failed',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      throw err;
    }
  }
}
