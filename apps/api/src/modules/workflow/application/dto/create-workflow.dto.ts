import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  nameEn: string;

  @IsString()
  @IsNotEmpty()
  nameAr: string;

  @IsString()
  @IsNotEmpty()
  descriptionEn: string;

  @IsString()
  @IsNotEmpty()
  descriptionAr: string;

  @IsArray()
  @IsNotEmpty()
  steps: string[];

  @IsString()
  @IsOptional()
  branchId?: string;
}
