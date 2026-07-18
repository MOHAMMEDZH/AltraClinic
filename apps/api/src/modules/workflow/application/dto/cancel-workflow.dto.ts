import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CancelWorkflowDto {
  @IsString()
  @IsNotEmpty()
  canceledBy!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
