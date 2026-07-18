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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumeDentalMaterialLineDTO)
  items!: ConsumeDentalMaterialLineDTO[];
}
