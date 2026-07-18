import { MediaAsset } from '../entities/media-asset.entity';

export interface MediaAssetRepository {
  save(asset: MediaAsset): Promise<void>;
  findById(tenantId: string, id: string): Promise<MediaAsset | null>;
  sumStorageBytes(tenantId: string): Promise<number>;
}
