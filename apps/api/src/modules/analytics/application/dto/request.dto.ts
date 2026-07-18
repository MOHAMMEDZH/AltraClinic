import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTOs for Analytics API
 */

/**
 * Record Metric Request DTO
 */
export class RecordMetricRequestDTO {
  @IsString()
  @MinLength(1)
  metricName!: string;

  metricValue!: number | string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsObject()
  dimensions?: Record<string, string>;

  @IsOptional()
  @IsObject()
  tags?: Record<string, string>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Dashboard Widget Input DTO
 */
export class DashboardWidgetInputDTO {
  @IsString()
  @MinLength(1)
  metricName!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  position!: number;

  @IsIn(['small', 'medium', 'large'])
  size!: 'small' | 'medium' | 'large';

  @IsIn(['number', 'line', 'bar', 'pie', 'table'])
  chartType!: 'number' | 'line' | 'bar' | 'pie' | 'table';

  @IsOptional()
  @IsNumber()
  refreshInterval?: number;

  @IsOptional()
  @IsObject()
  dimensionFilters?: Record<string, string>;
}

/**
 * Create Dashboard Request DTO
 */
export class CreateDashboardRequestDTO {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['executive', 'operational', 'clinical', 'financial', 'inventory', 'custom'])
  dashboardType!: 'executive' | 'operational' | 'clinical' | 'financial' | 'inventory' | 'custom';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetInputDTO)
  widgets!: DashboardWidgetInputDTO[];
}

/**
 * Generate Analytics Report Request DTO
 */
export class GenerateAnalyticsReportRequestDTO {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['operational', 'clinical', 'financial', 'inventory', 'executive', 'custom'])
  reportType!: 'operational' | 'clinical' | 'financial' | 'inventory' | 'executive' | 'custom';

  @IsIn(['pdf', 'excel', 'csv', 'json'])
  format!: 'pdf' | 'excel' | 'csv' | 'json';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientEmails?: string[];

  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Update Dashboard Request DTO
 */
export class UpdateDashboardRequestDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
