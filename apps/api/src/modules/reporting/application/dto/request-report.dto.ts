import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestReportDTO {
  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['appointment-report', 'revenue-report', 'patient-report', 'compliance-report'])
  type!: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['pdf', 'csv', 'excel'])
  format!: string;

  @IsNotEmpty()
  @IsString()
  startDate!: string;

  @IsNotEmpty()
  @IsString()
  endDate!: string;

  @IsOptional()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  branchId?: string;
}
