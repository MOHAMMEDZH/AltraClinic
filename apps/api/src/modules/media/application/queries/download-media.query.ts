import { MediaVariantType } from '../../domain/value-objects/media-variant.vo';

export interface DownloadMediaQuery {
  id: string;
  variant?: MediaVariantType;
}
