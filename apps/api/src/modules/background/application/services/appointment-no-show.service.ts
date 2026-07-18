import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';
import {
  APPOINTMENT_NO_SHOW_ELIGIBLE_STATUSES,
  NO_SHOW_GRACE_minutes,
} from '../../config/appointment-no-show.config';

export interface AppointmentNoShowScanResult {
  marked: number;
}

@Injectable()
export class AppointmentNoShowService {
  private readonly logger = new Logger(AppointmentNoShowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanAndMarkNoShows(now = new Date()): Promise<AppointmentNoShowScanResult> {
    const cutoff = new Date(now.getTime() - NO_SHOW_GRACE_minutes * 60_000);
    const licensedTenants = new Map<string, boolean>();
    let marked = 0;

    const candidates = await this.prisma.appointment.findMany({
      where: {
        deletedAt: null,
        status: { in: [...APPOINTMENT_NO_SHOW_ELIGIBLE_STATUSES] },
        scheduledEnd: { lt: cutoff },
      },
      select: { id: true, tenantId: true },
      take: 500,
    });

    for (const appt of candidates) {
      let allowed = licensedTenants.get(appt.tenantId);
      if (allowed === undefined) {
        allowed = await this.licensing.allowWorkerExecution({
          tenantId: appt.tenantId,
          workerName: 'appointment-no-show',
          moduleId: 'scheduling',
          source: 'worker.appointment_no_show',
        });
        licensedTenants.set(appt.tenantId, allowed);
      }
      if (!allowed) continue;

      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { status: 'NO_SHOW', updatedAt: now },
      });
      marked++;
    }

    if (marked > 0) {
      this.logger.log(`Auto-marked ${marked} appointment(s) as no-show`);
    }

    return { marked };
  }
}
