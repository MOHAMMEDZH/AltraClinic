import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class DisposeInventoryBatchDTO {
  @IsNumber()
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsUUID()
  usedByUserId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
