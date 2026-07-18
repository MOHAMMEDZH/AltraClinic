import { IsArray, IsNotEmpty, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

export class CreateTreatmentDTO {
  @IsNotEmpty()
  @IsString()
  patientId!: string;

  @IsNotEmpty()
  @IsString()
  providerId!: string;

  @IsArray()
  @ArrayNotEmpty()
  procedures!: Array<{
    code: string;
    description: string;
    toothNumbers: number[];
  }>;

  @IsOptional()
  @IsString()
  notes?: string;
}
