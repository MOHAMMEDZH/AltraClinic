import { IsString, IsISO8601 } from 'class-validator';

export class CreateAppointmentDTO {
  @IsString()
  patientId!: string;

  @IsString()
  providerId!: string;

  @IsISO8601()
  start!: string; // ISO 8601

  @IsISO8601()
  end!: string; // ISO 8601
}
