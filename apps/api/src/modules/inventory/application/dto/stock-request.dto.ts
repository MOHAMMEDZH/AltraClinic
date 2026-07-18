import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class StockRequestLineInputDTO {
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateStockRequestDTO {
  @IsIn(['DEPARTMENT', 'CLINICAL'])
  requestType!: 'DEPARTMENT' | 'CLINICAL';

  @IsOptional()
  @IsString()
  departmentName?: string | null;

  @IsOptional()
  @IsUUID()
  patientId?: string | null;

  @IsOptional()
  @IsUUID()
  warehouseId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockRequestLineInputDTO)
  lines!: StockRequestLineInputDTO[];
}

export class RejectStockRequestDTO {
  @IsOptional()
  @IsString()
  reason?: string | null;
}

export class FulfillStockRequestLineDTO {
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
