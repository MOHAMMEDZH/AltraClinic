import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { INVENTORY_SUPPLIER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { mapSupplier } from '../utils/map-supplier-response';

@Injectable()
export class UpdateInventorySupplierHandler {
  constructor(
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly repo: InventorySupplierRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    supplierId: string;
    code?: string;
    nameEn?: string;
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

    const existing = await this.repo.findById(tenantId, command.supplierId);
    if (!existing) throw new NotFoundException('Supplier not found');

    if (command.code?.trim()) {
      const code = command.code.trim().toUpperCase();
      const byCode = await this.repo.findByCode(tenantId, code);
      if (byCode && byCode.supplierId !== command.supplierId) {
        throw new BadRequestException('Supplier code already exists');
      }
      command.code = code;
    }

    await this.repo.update({
      tenantId,
      supplierId: command.supplierId,
      code: command.code,
      nameEn: command.nameEn,
      nameAr: command.nameAr,
      contactName: command.contactName,
      email: command.email,
      phone: command.phone,
      address: command.address,
      leadTimeDays: command.leadTimeDays,
      notes: command.notes,
    });

    const updated = await this.repo.findById(tenantId, command.supplierId);
    if (!updated) throw new NotFoundException('Supplier not found');
    return mapSupplier(updated);
  }
}
