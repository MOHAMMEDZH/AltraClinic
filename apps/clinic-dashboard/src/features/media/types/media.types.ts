export type ImagingType = 'xray' | 'panoramic' | 'intraoral' | 'before' | 'after' | 'treatment' | 'cbct';

export type CbctPlane = 'axial' | 'sagittal' | 'coronal';

export interface CbctVolumeMeta {
  sliceCount: number;
  sliceWidth: number;
  sliceHeight: number;
  voxelSpacing?: { x: number; y: number; z: number };
  dicomSeriesUid?: string;
}

export interface MediaAnnotation {
  id: string;
  x: number;
  y: number;
  text?: string;
  color?: string;
}

export interface MediaClinicalMeta {
  imagingType?: ImagingType | null;
  title?: string | null;
  toothNumbers?: number[];
  encounterId?: string | null;
  annotations?: MediaAnnotation[];
  cbct?: CbctVolumeMeta;
  documentCategory?: 'patient_attachment' | 'medical_document' | null;
}

export interface MediaMetadata {
  format?: string | null;
  width?: number | null;
  height?: number | null;
  clinical?: MediaClinicalMeta;
}

export interface MediaVariant {
  type: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

export interface MediaListItem {
  id: string;
  category: string;
  ownerType: string;
  ownerId: string;
  patientId: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  variants: MediaVariant[];
  metadata: MediaMetadata;
  comparisonGroupId: string | null;
  comparisonRole: 'before' | 'after' | null;
  createdAt: string;
  processedAt: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
}

export interface MediaListResponse {
  items: MediaListItem[];
  total: number;
}

export interface UploadMediaOptions {
  file: File;
  category: 'dental_image' | 'beauty_before_after' | 'patient_attachment' | 'medical_document' | 'invoice_attachment';
  ownerType: string;
  ownerId: string;
  patientId: string;
  imagingType?: ImagingType;
  title?: string;
  toothNumbers?: number[];
  encounterId?: string;
  comparisonGroupId?: string;
  comparisonRole?: 'before' | 'after';
}

export type MediaVariantType = 'original' | 'compressed' | 'thumbnail' | 'webp' | string;
