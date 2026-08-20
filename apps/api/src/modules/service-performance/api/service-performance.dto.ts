import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ServicePerformanceParticipantDto {
  @IsDefined()
  @IsUUID()
  userId!: string;

  @IsDefined()
  @IsIn(['PRIMARY', 'ASSISTING'])
  role!: 'PRIMARY' | 'ASSISTING';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  attributionShare?: number;
}

export class CreateServicePerformanceDto {
  @IsDefined()
  @IsUUID()
  clinicalServiceId!: string;

  @IsDefined()
  @IsISO8601()
  performedAt!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  snapshotRevisionId?: string;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServicePerformanceParticipantDto)
  participants!: ServicePerformanceParticipantDto[];
}

export class CorrectServicePerformanceDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServicePerformanceParticipantDto)
  participants!: ServicePerformanceParticipantDto[];
}
