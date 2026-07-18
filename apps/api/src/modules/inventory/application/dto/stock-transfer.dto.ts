import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class StockTransferLineDTO {
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class CreateStockTransferDTO {
  @IsUUID()
  fromWarehouseId!: string;

  @IsUUID()
  toWarehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDTO)
  lines!: StockTransferLineDTO[];
}

export class ReceiveStockTransferLineDTO {
  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}
