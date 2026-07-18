import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateInventoryItemDTO {
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameAr?: string | null;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQuantity?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number | null;

  @IsOptional()
  @IsString()
  storageLocation?: string | null;

  @IsOptional()
  @IsString()
  lotNumber?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;
}

export class ReceiveInventoryDTO {
  @IsNumber()
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsString()
  lotNumber?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  manufacturedDate?: string | null;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class CreateInventoryCategoryDTO {
  @IsString()
  nameEn!: string;

  @IsOptional()
  @IsString()
  nameAr?: string | null;

  @IsOptional()
  @IsString()
  key?: string;
}
