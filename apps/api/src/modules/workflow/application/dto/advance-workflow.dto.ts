import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdvanceWorkflowDto {
  @IsString()
  @IsNotEmpty()
  actionedBy: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
