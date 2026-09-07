import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SchedulingResourceType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../ports/scheduling-audit-log.port';

@Injectable()
export class ServiceResourceRequirementService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  async listRequirements(tenantId: string, clinicalServiceId: string) {
    return this.prisma.withPlatformBypass((c) =>
      c.serviceResourceRequirement.findMany({
        where: { tenantId, clinicalServiceId },
      }),
    );
  }

  /** SYSTEM_CANONICAL shared OK; TENANT_CUSTOM must belong to requesting tenant. */
  async assertClinicalServiceAccessible(
    tenantId: string,
    clinicalServiceId: string,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const run = async (c: Prisma.TransactionClient) => {
      const service = await c.canonicalClinicalServiceDefinition.findFirst({
        where: { id: clinicalServiceId },
        select: { id: true, provenance: true, tenantId: true },
      });
      if (!service) {
        throw new NotFoundException('Clinical service not found');
      }
      if (service.provenance === 'TENANT_CUSTOM' && service.tenantId !== tenantId) {
        throw new ForbiddenException('TENANT_CUSTOM clinical service does not belong to this tenant');
      }
    };
    if (client) return run(client);
    return this.prisma.withPlatformBypass((c) => run(c));
  }

  /**
   * Always validate supplied resource IDs for tenant/branch ownership (even with zero requirements).
   */
  async assertAllocatedResourcesOwned(params: {
    tenantId: string;
    branchId: string | null;
    allocatedResourceIds: string[];
    client?: Prisma.TransactionClient;
  }): Promise<void> {
    const allocated = [...new Set(params.allocatedResourceIds.filter(Boolean))];
    if (allocated.length === 0) return;
    const run = async (client: Prisma.TransactionClient) => {
      const resources = await client.schedulingResource.findMany({
        where: {
          id: { in: allocated },
          tenantId: params.tenantId,
          deletedAt: null,
          isActive: true,
        },
      });
      if (resources.length !== allocated.length) {
        throw new BadRequestException(
          'One or more allocated resources are invalid for this tenant',
        );
      }
      for (const resource of resources) {
        // Branch-scoped resource requires exact appointment branch (null booking branch = DENY).
        if (resource.branchId != null && resource.branchId !== params.branchId) {
          throw new BadRequestException('Resource branch mismatch');
        }
      }
    };
    if (params.client) return run(params.client);
    return this.prisma.withPlatformBypass((c) => run(c));
  }
  async assertRequirementsSatisfied(params: {
    tenantId: string;
    clinicalServiceId: string;
    branchId: string | null;
    allocatedResourceIds: string[];
    client?: Prisma.TransactionClient;
  }): Promise<void> {
    const run = async (client: Prisma.TransactionClient) => {
      const allocated = [...new Set(params.allocatedResourceIds.filter(Boolean))];

      if (allocated.length > 0) {
        const resources = await client.schedulingResource.findMany({
          where: {
            id: { in: allocated },
            tenantId: params.tenantId,
            deletedAt: null,
            isActive: true,
          },
        });
        if (resources.length !== allocated.length) {
          throw new BadRequestException(
            'One or more allocated resources are invalid for this tenant',
          );
        }
        for (const resource of resources) {
          // Branch-scoped resource requires exact appointment branch (null booking branch = DENY).
          if (resource.branchId != null && resource.branchId !== params.branchId) {
            throw new BadRequestException('Resource branch mismatch');
          }
        }

        const requirements = await client.serviceResourceRequirement.findMany({
          where: { tenantId: params.tenantId, clinicalServiceId: params.clinicalServiceId },
        });
        for (const req of requirements) {
          const matching = resources.filter((r) => r.resourceType === req.resourceType);
          if (matching.length < req.quantity) {
            throw new BadRequestException(
              `Insufficient ${req.resourceType} resources: need ${req.quantity}, got ${matching.length}`,
            );
          }
        }
        return;
      }

      const requirements = await client.serviceResourceRequirement.findMany({
        where: { tenantId: params.tenantId, clinicalServiceId: params.clinicalServiceId },
      });
      if (requirements.length > 0) {
        throw new BadRequestException('Required scheduling resources are missing');
      }
    };

    if (params.client) return run(params.client);
    return this.prisma.withPlatformBypass((c) => run(c));
  }

  async upsertRequirement(params: {
    tenantId: string;
    clinicalServiceId: string;
    resourceType: SchedulingResourceType;
    quantity: number;
    actorId: string;
    actorRoles?: string[];
  }) {
    return this.prisma.withPlatformBypass(async (c) => {
      await this.assertClinicalServiceAccessible(params.tenantId, params.clinicalServiceId, c);
      const row = await c.serviceResourceRequirement.upsert({
        where: {
          tenantId_clinicalServiceId_resourceType: {
            tenantId: params.tenantId,
            clinicalServiceId: params.clinicalServiceId,
            resourceType: params.resourceType,
          },
        },
        create: {
          tenantId: params.tenantId,
          clinicalServiceId: params.clinicalServiceId,
          resourceType: params.resourceType,
          quantity: params.quantity,
        },
        update: { quantity: params.quantity },
      });

      await this.auditLog.recordInTransaction(c, {
        tenantId: params.tenantId,
        action: 'scheduling.resource_requirement.upsert',
        resourceId: row.id,
        actorId: params.actorId,
        actorRoles: params.actorRoles ?? [],
        descriptionEn: 'Service resource requirement upserted',
        descriptionAr: 'تم تحديث متطلبات موارد الخدمة',
        details: {
          clinicalServiceId: params.clinicalServiceId,
          resourceType: params.resourceType,
          quantity: params.quantity,
        },
      });

      return row;
    });
  }
}
