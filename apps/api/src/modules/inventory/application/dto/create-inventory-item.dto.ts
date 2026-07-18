import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateInventoryItemDTO {
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsNotEmpty()
  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsNotEmpty()
  @IsString()
  nameEn!: string;

  @IsOptional()
  @IsString()
  nameAr?: string | null;

  @IsNotEmpty()
  @IsString()
  unit!: string;

  @IsNumber()
  @IsInt()
  @Min(0)
  quantityOnHand!: number;

  @IsNumber()
  @IsInt()
  @Min(0)
  reorderThreshold!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQuantity?: number | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

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
}
