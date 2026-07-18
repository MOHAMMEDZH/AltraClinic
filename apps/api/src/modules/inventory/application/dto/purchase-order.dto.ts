import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PurchaseOrderLineInputDTO {
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number | null;
}

export class CreatePurchaseOrderDTO {
  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineInputDTO)
  lines!: PurchaseOrderLineInputDTO[];
}

export class ReceivePurchaseOrderLineDTO {
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  lotNumber?: string | null;

  @IsOptional()
  @IsString()
  manufacturedDate?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
