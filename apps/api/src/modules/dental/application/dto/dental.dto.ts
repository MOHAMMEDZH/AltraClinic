import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ToothUpdateInput {
  @IsNumber()
  @Min(1)
  @Max(32)
  toothNumber!: number;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsObject()
  surfaces?: Record<string, string>;
}

export class CreateDentalChartDTO {
  @IsNotEmpty()
  @IsString()
  patientId!: string;
}

export class UpdateDentalTeethDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToothUpdateInput)
  teeth!: ToothUpdateInput[];
}
