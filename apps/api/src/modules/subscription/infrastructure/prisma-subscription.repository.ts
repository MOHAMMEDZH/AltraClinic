import { Injectable } from '@nestjs/common';
import { SubscriptionStatus as PrismaSubStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Subscription } from '../domain/entities/subscription.entity';
import {
  SubscriptionFilter,
  SubscriptionRepository,
} from '../domain/repositories/subscription.repository.interface';
import { SubscriptionPlanVO, SubscriptionPlanType } from '../domain/value-objects/subscription-plan.vo';
import { SubscriptionStatusVO, SubscriptionStatusType } from '../domain/value-objects/subscription-status.vo';

// plan is a free-form string in the DB (no enum)
const DOMAIN_STATUS_TO_PRISMA: Record<SubscriptionStatusType, PrismaSubStatus> = {
  active: 'ACTIVE',
  canceled: 'CANCELLED',
  past_due: 'SUSPENDED',
  trial: 'TRIAL',
  expired: 'EXPIRED',
};

const PRISMA_STATUS_TO_DOMAIN: Record<PrismaSubStatus, SubscriptionStatusType> = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  SUSPENDED: 'past_due',
  EXPIRED: 'expired',
  CANCELLED: 'canceled',
};

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(subscription: Subscription): Promise<void> {
    await this.prisma.clinicSubscription.upsert({
      where: { id: subscription.id },
      create: {
        id: subscription.id,
        tenantId: subscription.tenantId,
        branchId: subscription.branchId,
        customerId: subscription.customerId,
        plan: subscription.plan.value,
        status: DOMAIN_STATUS_TO_PRISMA[subscription.status.value],
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        currency: subscription.currency,
        createdBy: subscription.createdBy,
        createdAt: subscription.createdAt,
      },
      update: {
        plan: subscription.plan.value,
        status: DOMAIN_STATUS_TO_PRISMA[subscription.status.value],
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        updatedAt: subscription.updatedAt,
      },
    });
  }

  async findById(subscriptionId: string, tenantId: string): Promise<Subscription | null> {
    const row = await this.prisma.clinicSubscription.findFirst({
      where: { id: subscriptionId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: SubscriptionFilter): Promise<Subscription[]> {
    const rows = await this.prisma.clinicSubscription.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
        ...(filter.status ? { status: DOMAIN_STATUS_TO_PRISMA[filter.status as SubscriptionStatusType] } : {}),
        ...(filter.plan ? { plan: filter.plan } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: filter.offset ?? 0,
      take: filter.limit ?? 50,
    });
    return rows.map((r) => this.toDomain(r));
  }

  async existsByCustomerId(customerId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.clinicSubscription.count({
      where: { customerId, tenantId, status: 'ACTIVE' },
    });
    return count > 0;
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    customerId: string;
    plan: string;
    status: PrismaSubStatus;
    startDate: Date;
    endDate: Date | null;
    autoRenew: boolean;
    currency: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): Subscription {
    return Subscription.restore({
      subscriptionId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      customerId: row.customerId,
      plan: new SubscriptionPlanVO(row.plan as SubscriptionPlanType),
      status: new SubscriptionStatusVO(PRISMA_STATUS_TO_DOMAIN[row.status]),
      startDate: row.startDate,
      endDate: row.endDate,
      autoRenew: row.autoRenew,
      currency: row.currency,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
