export type MediaVariantType = string;

export interface MediaVariantProps {
  type: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

export class MediaVariantVO {
  readonly type: MediaVariantType;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;

  constructor(props: MediaVariantProps) {
    this.type = props.type;
    this.storageKey = props.storageKey;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.width = props.width ?? null;
    this.height = props.height ?? null;
  }

  toPlain(): MediaVariantProps {
    return {
      type: this.type,
      storageKey: this.storageKey,
      mimeType: this.mimeType,
      sizeBytes: this.sizeBytes,
      width: this.width,
      height: this.height,
    };
  }

  static fromPlain(raw: unknown): MediaVariantVO {
    const obj = raw as MediaVariantProps;
    return new MediaVariantVO(obj);
  }
}
