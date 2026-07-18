import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PerioSiteDTO {
  @IsNumber()
  @Min(0)
  @Max(15)
  pd!: number;

  @IsNumber()
  @Min(0)
  @Max(15)
  recession!: number;

  @IsBoolean()
  bop!: boolean;
}

export class PerioToothDTO {
  @IsInt()
  @Min(1)
  @Max(32)
  toothNumber!: number;

  @IsInt()
  @Min(0)
  @Max(3)
  mobility!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  furcation?: number | null;

  @IsInt()
  @Min(0)
  @Max(3)
  plaqueIndex!: number;

  @IsObject()
  sites!: Record<string, PerioSiteDTO>;

  @IsOptional()
  @IsBoolean()
  missing?: boolean;
}

export class CreatePeriodontalExamDTO {
  @IsOptional()
  @IsString()
  examDate?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerioToothDTO)
  teeth?: PerioToothDTO[];
}

export class UpdatePeriodontalExamDTO {
  @IsOptional()
  @IsString()
  examDate?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerioToothDTO)
  teeth?: PerioToothDTO[];
}

export class ComparePeriodontalExamsDTO {
  @IsUUID()
  baselineExamId!: string;

  @IsUUID()
  compareExamId!: string;
}
