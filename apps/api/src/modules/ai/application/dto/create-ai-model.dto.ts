import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AI_MODEL_TYPES, AiModelType } from '../../domain/value-objects/ai-model-type';

export class CreateAiModelDto {
  @IsString()
  @IsNotEmpty()
  nameEn!: string;

  @IsString()
  @IsNotEmpty()
  nameAr!: string;

  @IsString()
  @IsNotEmpty()
  descriptionEn!: string;

  @IsString()
  @IsNotEmpty()
  descriptionAr!: string;

  @IsEnum(AI_MODEL_TYPES)
  @IsNotEmpty()
  modelType!: AiModelType;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}
