import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsString()
  recipientId!: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['in-app', 'email', 'sms', 'push', 'whatsapp'], { message: 'channel must be a valid notification channel' })
  channel!: string;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  body!: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['low', 'medium', 'high', 'critical'], { message: 'priority must be low, medium, high, or critical' })
  priority!: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsString()
  branchId?: string;
}
