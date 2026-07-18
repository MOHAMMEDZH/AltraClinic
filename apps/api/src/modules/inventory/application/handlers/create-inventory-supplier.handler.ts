import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { INVENTORY_SUPPLIER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class CreateInventorySupplierHandler {
  constructor(
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly repo: InventorySupplierRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    code: string;
    nameEn: string;
    nameAr?: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.code?.trim()) throw new BadRequestException('Supplier code is required');
    if (!command.nameEn?.trim()) throw new BadRequestException('Supplier name is required');

    const code = command.code.trim().toUpperCase();
    const existing = await this.repo.findByCode(tenantId, code);
    if (existing) throw new BadRequestException('Supplier code already exists');

    return await this.repo.create({
      tenantId,
      code,
      nameEn: command.nameEn,
      nameAr: command.nameAr ?? null,
      contactName: command.contactName ?? null,
      email: command.email ?? null,
      phone: command.phone ?? null,
      address: command.address ?? null,
      leadTimeDays: command.leadTimeDays ?? null,
      notes: command.notes ?? null,
    });
  }
}
