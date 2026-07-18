import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import { JobDeduplicationService } from './job-deduplication.service';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';
import {
  INVENTORY_EXPIRY_ALERT_DAYS,
  isExpired,
  isExpiringWithinDays,
} from '../../domain/date.utils';

export interface InventoryAlertScanResult {
  lowStockAlerts: number;
  expiryAlerts: number;
  duplicatesSkipped: number;
}

const PRODUCER_MODULE_ID = 'background.inventory-alerts';

@Injectable()
export class InventoryAlertService {
  private readonly logger = new Logger(InventoryAlertService.name);
  private readonly notifyRoles = ['OWNER', 'GENERAL_MANAGER', 'INVENTORY_MANAGER'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
    private readonly dedup: JobDeduplicationService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async scanAndSendAlerts(now = new Date()): Promise<InventoryAlertScanResult> {
    const result: InventoryAlertScanResult = {
      lowStockAlerts: 0,
      expiryAlerts: 0,
      duplicatesSkipped: 0,
    };

    const items = await this.prisma.inventoryItem.findMany({
      where: { deletedAt: null },
    });

    const licensedTenants = new Map<string, boolean>();

    for (const item of items) {
      let licensed = licensedTenants.get(item.tenantId);
      if (licensed === undefined) {
        licensed = await this.licensing.allowWorkerExecution({
          tenantId: item.tenantId,
          workerName: 'inventory-alerts',
          moduleId: 'inventory',
          source: 'worker.inventory_alerts',
        });
        licensedTenants.set(item.tenantId, licensed);
      }
      if (!licensed) continue;

      const qty = Number(item.quantityOnHand);
      const threshold = Number(item.reorderThreshold);

      if (qty <= threshold) {
        const sent = await this.maybeAlert({
          jobType: 'inventory-low-stock',
          entityId: item.id,
          bucket: `qty-${Math.floor(qty)}`,
          tenantId: item.tenantId,
          branchId: item.branchId,
          title: `Low stock: ${item.nameEn}`,
          body: `${item.sku} has ${qty} ${item.unit} on hand (reorder threshold: ${threshold}).`,
          priority: qty === 0 ? 'critical' : 'high',
        });
        if (sent === 'sent') result.lowStockAlerts++;
        else if (sent === 'duplicate') result.duplicatesSkipped++;
      }

      if (item.expiryDate) {
        const expiry = new Date(item.expiryDate);
        if (isExpired(expiry, now)) {
          const sent = await this.maybeAlert({
            jobType: 'inventory-expired',
            entityId: item.id,
            bucket: expiry.toISOString().slice(0, 10),
            tenantId: item.tenantId,
            branchId: item.branchId,
            title: `Expired inventory: ${item.nameEn}`,
            body: `${item.sku} expired on ${expiry.toISOString().slice(0, 10)}. Remove from stock.`,
            priority: 'critical',
          });
          if (sent === 'sent') result.expiryAlerts++;
          else if (sent === 'duplicate') result.duplicatesSkipped++;
        } else if (isExpiringWithinDays(expiry, INVENTORY_EXPIRY_ALERT_DAYS, now)) {
          const daysLeft = Math.ceil(
            (expiry.getTime() - now.getTime()) / 86_400_000,
          );
          const sent = await this.maybeAlert({
            jobType: 'inventory-expiring',
            entityId: item.id,
            bucket: expiry.toISOString().slice(0, 10),
            tenantId: item.tenantId,
            branchId: item.branchId,
            title: `Expiring soon: ${item.nameEn}`,
            body: `${item.sku} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${expiry.toISOString().slice(0, 10)}).`,
            priority: daysLeft <= 3 ? 'critical' : 'medium',
          });
          if (sent === 'sent') result.expiryAlerts++;
          else if (sent === 'duplicate') result.duplicatesSkipped++;
        }
      }
    }

    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        status: 'ACTIVE',
        quantityOnHand: { gt: 0 },
        expiryDate: { not: null },
        inventoryItem: { deletedAt: null },
      },
      select: {
        id: true,
        tenantId: true,
        expiryDate: true,
        lotNumber: true,
        inventoryItem: {
          select: { id: true, branchId: true, sku: true, nameEn: true, unit: true },
        },
      },
    });

    for (const batch of batches) {
      if (!batch.expiryDate) continue;
      const expiry = new Date(batch.expiryDate);
      const item = batch.inventoryItem;
      const lotLabel = batch.lotNumber ? ` lot ${batch.lotNumber}` : '';

      if (isExpired(expiry, now)) {
        const sent = await this.maybeAlert({
          jobType: 'inventory-batch-expired',
          entityId: batch.id,
          bucket: expiry.toISOString().slice(0, 10),
          tenantId: batch.tenantId,
          branchId: item.branchId,
          title: `Expired batch: ${item.nameEn}`,
          body: `${item.sku}${lotLabel} expired on ${expiry.toISOString().slice(0, 10)}.`,
          priority: 'critical',
        });
        if (sent === 'sent') result.expiryAlerts++;
        else if (sent === 'duplicate') result.duplicatesSkipped++;
      } else if (isExpiringWithinDays(expiry, INVENTORY_EXPIRY_ALERT_DAYS, now)) {
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
        const sent = await this.maybeAlert({
          jobType: 'inventory-batch-expiring',
          entityId: batch.id,
          bucket: expiry.toISOString().slice(0, 10),
          tenantId: batch.tenantId,
          branchId: item.branchId,
          title: `Batch expiring soon: ${item.nameEn}`,
          body: `${item.sku}${lotLabel} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
          priority: daysLeft <= 3 ? 'critical' : 'medium',
        });
        if (sent === 'sent') result.expiryAlerts++;
        else if (sent === 'duplicate') result.duplicatesSkipped++;
      }
    }

    return result;
  }

  private async maybeAlert(params: {
    jobType: string;
    entityId: string;
    bucket: string;
    tenantId: string;
    branchId: string | null;
    title: string;
    body: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<'sent' | 'duplicate' | 'skipped'> {
    const isDup = await this.dedup.isDuplicate(params.jobType, params.entityId, params.bucket);
    if (isDup) return 'duplicate';

    const recipients = await this.resolveRecipients(params.tenantId);
    if (recipients.length === 0) {
      this.logger.warn(`No inventory managers for tenant ${params.tenantId}`);
      return 'skipped';
    }

    for (const recipientId of recipients) {
      await this.producer.produceInApp({
        tenantId: params.tenantId,
        branchId: params.branchId,
        recipientId,
        title: params.title,
        body: params.body,
        priority: params.priority,
        idempotencyKey: `${params.jobType}:${params.entityId}:${params.bucket}:${recipientId}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
    }

    return 'sent';
  }

  private async resolveRecipients(tenantId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        roles: { some: { role: { in: [...this.notifyRoles] } } },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}
