import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';

export interface BillingOverdueScanResult {
  marked: number;
}

@Injectable()
export class BillingOverdueService {
  private readonly logger = new Logger(BillingOverdueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanAndMarkOverdue(now = new Date()): Promise<BillingOverdueScanResult> {
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });

    let marked = 0;
    for (const tenant of tenants) {
      const allowed = await this.licensing.allowWorkerExecution({
        tenantId: tenant.id,
        workerName: 'billing-overdue',
        moduleId: 'billing',
        source: 'worker.billing_overdue',
      });
      if (!allowed) continue;

      const result = await this.prisma.invoice.updateMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          status: { in: ['ISSUED', 'PARTIAL_PAID'] },
          dueDate: { lt: today },
        },
        data: { status: 'OVERDUE', updatedAt: now },
      });
      marked += result.count;
    }

    if (marked > 0) {
      this.logger.log(`Marked ${marked} invoice(s) as overdue`);
    }

    return { marked };
  }
}
