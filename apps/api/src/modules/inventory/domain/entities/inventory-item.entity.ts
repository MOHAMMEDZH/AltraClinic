import { LocalizedText } from '../value-objects/localized-text.vo';
import { InventoryValidationException } from '../exceptions/inventory-validation.exception';

export interface InventoryItemProps {
  itemId: string;
  tenantId: string;
  branchId: string | null;
  categoryId: string | null;
  sku: string;
  barcode: string | null;
  brand: string | null;
  name: LocalizedText;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  costPerUnit: number | null;
  sellingPrice: number | null;
  storageLocation: string | null;
  lotNumber: string | null;
  expiryDate: Date | null;
  supplierId?: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function validateQuantityLevels(input: {
  minQuantity?: number | null;
  maxQuantity?: number | null;
  reorderThreshold?: number;
}): void {
  const { minQuantity, maxQuantity, reorderThreshold } = input;
  if (minQuantity != null && minQuantity < 0) {
    throw new InventoryValidationException('minQuantity must be non-negative');
  }
  if (maxQuantity != null && maxQuantity < 0) {
    throw new InventoryValidationException('maxQuantity must be non-negative');
  }
  if (minQuantity != null && maxQuantity != null && minQuantity > maxQuantity) {
    throw new InventoryValidationException('minQuantity cannot exceed maxQuantity');
  }
  if (reorderThreshold != null && minQuantity != null && reorderThreshold < minQuantity) {
    throw new InventoryValidationException('reorderThreshold cannot be below minQuantity');
  }
  if (reorderThreshold != null && maxQuantity != null && reorderThreshold > maxQuantity) {
    throw new InventoryValidationException('reorderThreshold cannot exceed maxQuantity');
  }
}

export class InventoryItem {
  public readonly itemId: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public categoryId: string | null;
  public readonly sku: string;
  public barcode: string | null;
  public brand: string | null;
  public name: LocalizedText;
  public unit: string;
  private quantityOnHandValue: number;
  public reorderThreshold: number;
  public minQuantity: number | null;
  public maxQuantity: number | null;
  public costPerUnit: number | null;
  public sellingPrice: number | null;
  public storageLocation: string | null;
  public lotNumber: string | null;
  public expiryDate: Date | null;
  public supplierId: string | null;
  public archivedAt: Date | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: InventoryItemProps) {
    this.itemId = props.itemId;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.categoryId = props.categoryId;
    this.sku = props.sku;
    this.barcode = props.barcode;
    this.brand = props.brand;
    this.name = props.name;
    this.unit = props.unit;
    this.quantityOnHandValue = props.quantityOnHand;
    this.reorderThreshold = props.reorderThreshold;
    this.minQuantity = props.minQuantity;
    this.maxQuantity = props.maxQuantity;
    this.costPerUnit = props.costPerUnit;
    this.sellingPrice = props.sellingPrice;
    this.storageLocation = props.storageLocation;
    this.lotNumber = props.lotNumber;
    this.expiryDate = props.expiryDate;
    this.supplierId = props.supplierId ?? null;
    this.archivedAt = props.archivedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get quantityOnHand(): number {
    return this.quantityOnHandValue;
  }

  static restore(props: InventoryItemProps): InventoryItem {
    return new InventoryItem(props);
  }

  static create(input: {
    itemId: string;
    tenantId: string;
    branchId: string | null;
    categoryId?: string | null;
    sku: string;
    barcode?: string | null;
    brand?: string | null;
    nameEn: string;
    nameAr?: string | null;
    unit: string;
    quantityOnHand: number;
    reorderThreshold: number;
    minQuantity?: number | null;
    maxQuantity?: number | null;
    costPerUnit?: number | null;
    sellingPrice?: number | null;
    storageLocation?: string | null;
    lotNumber?: string | null;
    expiryDate?: string | null;
    supplierId?: string | null;
  }): InventoryItem {
    if (!input.sku.trim()) throw new InventoryValidationException('SKU is required');
    if (!input.nameEn.trim() && !input.nameAr?.trim()) {
      throw new InventoryValidationException('Item name is required in at least one language');
    }
    if (input.quantityOnHand < 0) throw new InventoryValidationException('quantityOnHand must be non-negative');
    if (input.reorderThreshold < 0) throw new InventoryValidationException('reorderThreshold must be non-negative');
    if (!input.unit.trim()) throw new InventoryValidationException('unit is required');
    const expiry = input.expiryDate ? new Date(input.expiryDate) : null;
    if (input.expiryDate && Number.isNaN(expiry!.getTime())) {
      throw new InventoryValidationException('expiryDate must be a valid ISO datetime');
    }
    if (input.costPerUnit != null && input.costPerUnit < 0) {
      throw new InventoryValidationException('costPerUnit must be non-negative');
    }
    if (input.sellingPrice != null && input.sellingPrice < 0) {
      throw new InventoryValidationException('sellingPrice must be non-negative');
    }
    validateQuantityLevels({
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
      reorderThreshold: input.reorderThreshold,
    });

    return new InventoryItem({
      itemId: input.itemId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      categoryId: input.categoryId ?? null,
      sku: input.sku.trim(),
      barcode: input.barcode?.trim() || null,
      brand: input.brand?.trim() || null,
      name: new LocalizedText(input.nameEn, input.nameAr ?? null),
      unit: input.unit,
      quantityOnHand: input.quantityOnHand,
      reorderThreshold: input.reorderThreshold,
      minQuantity: input.minQuantity ?? null,
      maxQuantity: input.maxQuantity ?? null,
      costPerUnit: input.costPerUnit ?? null,
      sellingPrice: input.sellingPrice ?? null,
      storageLocation: input.storageLocation?.trim() || null,
      lotNumber: input.lotNumber?.trim() || null,
      expiryDate: expiry,
      supplierId: input.supplierId ?? null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  updateDetails(input: {
    categoryId?: string | null;
    barcode?: string | null;
    brand?: string | null;
    nameEn?: string;
    nameAr?: string | null;
    unit?: string;
    reorderThreshold?: number;
    minQuantity?: number | null;
    maxQuantity?: number | null;
    costPerUnit?: number | null;
    sellingPrice?: number | null;
    storageLocation?: string | null;
    lotNumber?: string | null;
    expiryDate?: string | null;
    supplierId?: string | null;
  }): void {
    if (input.nameEn !== undefined || input.nameAr !== undefined) {
      this.name = new LocalizedText(
        input.nameEn ?? this.name.en ?? '',
        input.nameAr !== undefined ? input.nameAr : this.name.ar,
      );
    }
    if (input.categoryId !== undefined) this.categoryId = input.categoryId;
    if (input.barcode !== undefined) this.barcode = input.barcode?.trim() || null;
    if (input.brand !== undefined) this.brand = input.brand?.trim() || null;
    if (input.unit !== undefined) {
      if (!input.unit.trim()) throw new InventoryValidationException('unit is required');
      this.unit = input.unit;
    }
    if (input.reorderThreshold !== undefined) {
      if (input.reorderThreshold < 0) throw new InventoryValidationException('reorderThreshold must be non-negative');
      this.reorderThreshold = input.reorderThreshold;
    }
    if (input.minQuantity !== undefined) this.minQuantity = input.minQuantity;
    if (input.maxQuantity !== undefined) this.maxQuantity = input.maxQuantity;
    validateQuantityLevels({
      minQuantity: this.minQuantity,
      maxQuantity: this.maxQuantity,
      reorderThreshold: this.reorderThreshold,
    });
    if (input.costPerUnit !== undefined) {
      if (input.costPerUnit != null && input.costPerUnit < 0) {
        throw new InventoryValidationException('costPerUnit must be non-negative');
      }
      this.costPerUnit = input.costPerUnit;
    }
    if (input.sellingPrice !== undefined) {
      if (input.sellingPrice != null && input.sellingPrice < 0) {
        throw new InventoryValidationException('sellingPrice must be non-negative');
      }
      this.sellingPrice = input.sellingPrice;
    }
    if (input.storageLocation !== undefined) {
      this.storageLocation = input.storageLocation?.trim() || null;
    }
    if (input.lotNumber !== undefined) {
      this.lotNumber = input.lotNumber?.trim() || null;
    }
    if (input.expiryDate !== undefined) {
      const expiry = input.expiryDate ? new Date(input.expiryDate) : null;
      if (input.expiryDate && Number.isNaN(expiry!.getTime())) {
        throw new InventoryValidationException('expiryDate must be a valid ISO datetime');
      }
      this.expiryDate = expiry;
    }
    if (input.supplierId !== undefined) {
      this.supplierId = input.supplierId;
    }
    this.updatedAt = new Date();
  }

  consume(amount: number): void {
    if (amount <= 0) throw new InventoryValidationException('Consume amount must be greater than zero');
    if (amount > this.quantityOnHandValue) throw new InventoryValidationException('Insufficient inventory available');
    this.quantityOnHandValue -= amount;
    this.updatedAt = new Date();
  }

  receive(amount: number): void {
    if (amount <= 0) throw new InventoryValidationException('Receive amount must be greater than zero');
    this.quantityOnHandValue += amount;
    this.updatedAt = new Date();
  }

  adjustTo(newQuantity: number): { quantityBefore: number; quantityAfter: number; delta: number } {
    if (newQuantity < 0) throw new InventoryValidationException('Quantity cannot be negative');
    const quantityBefore = this.quantityOnHandValue;
    const delta = newQuantity - quantityBefore;
    if (delta === 0) throw new InventoryValidationException('Adjustment quantity matches current stock');
    this.quantityOnHandValue = newQuantity;
    this.updatedAt = new Date();
    return { quantityBefore, quantityAfter: newQuantity, delta };
  }

  needsReorder(): boolean {
    return this.quantityOnHandValue <= this.reorderThreshold;
  }

  isExpired(asOf = new Date()): boolean {
    if (!this.expiryDate) return false;
    return this.expiryDate.getTime() < asOf.getTime();
  }

  toJSON() {
    return {
      itemId: this.itemId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      categoryId: this.categoryId,
      sku: this.sku,
      barcode: this.barcode,
      brand: this.brand,
      name: this.name.toJSON(),
      unit: this.unit,
      quantityOnHand: this.quantityOnHandValue,
      reorderThreshold: this.reorderThreshold,
      minQuantity: this.minQuantity,
      maxQuantity: this.maxQuantity,
      costPerUnit: this.costPerUnit,
      sellingPrice: this.sellingPrice,
      storageLocation: this.storageLocation,
      lotNumber: this.lotNumber,
      expiryDate: this.expiryDate?.toISOString() ?? null,
      supplierId: this.supplierId ?? null,
      archivedAt: this.archivedAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
