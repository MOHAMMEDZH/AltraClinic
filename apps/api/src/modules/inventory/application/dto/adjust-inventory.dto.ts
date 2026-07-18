import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class AdjustInventoryDTO {
  @IsNumber()
  @Min(0)
  quantityAfter!: number;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
