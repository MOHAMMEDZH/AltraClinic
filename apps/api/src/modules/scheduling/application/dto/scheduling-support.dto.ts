import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AvailabilityQueryDTO {
  @IsUUID()
  providerId!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMin?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateWaitlistDTO {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsISO8601()
  preferredDate?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
