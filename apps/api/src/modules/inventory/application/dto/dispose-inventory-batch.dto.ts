import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class DisposeInventoryBatchDTO {
  @IsNumber()
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
