import { IsObject, IsOptional } from 'class-validator';
import type { MediaClinicalMeta } from '../../domain/value-objects/media-metadata.vo';

export class UpdateMediaDTO {
  @IsOptional()
  @IsObject()
  clinical?: Partial<MediaClinicalMeta>;
}
