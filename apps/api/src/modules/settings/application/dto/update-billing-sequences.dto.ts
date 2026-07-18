import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BillingSequenceItemDto {
  @IsString()
  @MaxLength(20)
  prefix!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  lastNumber?: number;
}

export class UpdateBillingSequencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingSequenceItemDto)
  sequences!: BillingSequenceItemDto[];
}
