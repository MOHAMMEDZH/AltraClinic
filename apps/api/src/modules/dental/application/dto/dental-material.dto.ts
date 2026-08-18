import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateDentalProcedureMaterialDTO {
  @IsNotEmpty()
  @IsString()
  procedureCode!: string;

  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  defaultQuantity!: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class ConsumeDentalMaterialDTO {
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  /** Accountable clinician who used/administered the item (INV-B01). Required. */
  @IsNotEmpty()
  @IsUUID()
  usedByUserId!: string;

  @IsOptional()
  @IsString()
  procedureCode?: string | null;

  @IsOptional()
  @IsUUID()
  encounterId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

class ConsumeDentalMaterialLineDTO {
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNotEmpty()
  @IsUUID()
  usedByUserId!: string;
}

export class ConsumeDentalMaterialsBatchDTO {
  @IsOptional()
  @IsString()
  procedureCode?: string | null;

  @IsOptional()
  @IsUUID()
  encounterId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  usedByUserId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumeDentalMaterialLineDTO)
  items!: ConsumeDentalMaterialLineDTO[];
}
