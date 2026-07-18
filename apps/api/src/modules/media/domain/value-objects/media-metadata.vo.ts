export interface MediaClinicalMeta {
  imagingType?: string | null;
  title?: string | null;
  toothNumbers?: number[];
  encounterId?: string | null;
  documentCategory?: 'patient_attachment' | 'medical_document' | null;
  annotations?: Array<{ id: string; x: number; y: number; text?: string; color?: string }>;
  cbct?: {
    sliceCount: number;
    sliceWidth: number;
    sliceHeight: number;
    voxelSpacing?: { x: number; y: number; z: number };
    dicomSeriesUid?: string;
  };
}

export interface MediaMetadataProps {
  format?: string | null;
  width?: number | null;
  height?: number | null;
  hasAlpha?: boolean;
  orientation?: number | null;
  exifStripped?: boolean;
  pageCount?: number | null;
  checksumSha256?: string | null;
  clinical?: MediaClinicalMeta;
}

export class MediaMetadataVO {
  readonly format: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly hasAlpha: boolean;
  readonly orientation: number | null;
  readonly exifStripped: boolean;
  readonly pageCount: number | null;
  readonly checksumSha256: string | null;
  readonly clinical: MediaClinicalMeta | null;

  constructor(props: MediaMetadataProps = {}) {
    this.format = props.format ?? null;
    this.width = props.width ?? null;
    this.height = props.height ?? null;
    this.hasAlpha = props.hasAlpha ?? false;
    this.orientation = props.orientation ?? null;
    this.exifStripped = props.exifStripped ?? false;
    this.pageCount = props.pageCount ?? null;
    this.checksumSha256 = props.checksumSha256 ?? null;
    this.clinical = props.clinical ?? null;
  }

  toPlain(): MediaMetadataProps {
    return {
      format: this.format,
      width: this.width,
      height: this.height,
      hasAlpha: this.hasAlpha,
      orientation: this.orientation,
      exifStripped: this.exifStripped,
      pageCount: this.pageCount,
      checksumSha256: this.checksumSha256,
      clinical: this.clinical ?? undefined,
    };
  }

  withClinical(clinical: Partial<MediaClinicalMeta>): MediaMetadataVO {
    return new MediaMetadataVO({
      ...this.toPlain(),
      clinical: { ...(this.clinical ?? {}), ...clinical },
    });
  }

  static fromPlain(raw: unknown): MediaMetadataVO {
    return new MediaMetadataVO((raw ?? {}) as MediaMetadataProps);
  }
}
