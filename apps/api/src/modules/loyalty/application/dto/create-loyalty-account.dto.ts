import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateLoyaltyAccountDto {
  @IsNotEmpty()
  @IsString()
  patientId!: string;

  @IsNotEmpty()
  @IsString()
  clinicId!: string;

  @IsOptional()
  @IsNumber()
  initialPoints?: number;
}
