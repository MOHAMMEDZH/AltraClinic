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

export class CreateBeautyProcedureMaterialDTO {
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

export class ConsumeBeautyMaterialDTO {
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

class ConsumeBeautyMaterialLineDTO {
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;
}

export class ConsumeBeautyMaterialsBatchDTO {
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
  @Type(() => ConsumeBeautyMaterialLineDTO)
  items!: ConsumeBeautyMaterialLineDTO[];
}
