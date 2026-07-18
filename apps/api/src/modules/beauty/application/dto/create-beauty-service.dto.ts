import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBeautyServiceDTO {
  @IsNotEmpty()
  @IsString()
  patientId!: string;

  @IsNotEmpty()
  @IsString()
  clinicianId!: string;

  @IsNotEmpty()
  @IsString()
  serviceType!: string;

  @IsNotEmpty()
  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  notesEn?: string | null;

  @IsOptional()
  @IsString()
  notesAr?: string | null;

  @IsOptional()
  @IsString()
  correlationId?: string | null;
}
