import { IsArray, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateStockCountDTO {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  itemIds?: string[];
}

export class UpdateStockCountLineDTO {
  @IsNumber()
  @Min(0)
  countedQuantity!: number;
}
