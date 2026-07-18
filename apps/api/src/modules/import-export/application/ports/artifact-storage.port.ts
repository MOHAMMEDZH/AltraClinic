/**
 * Phase 42e — replaceable artifact storage abstraction.
 * Runtime must not hardcode local filesystem paths into orchestration logic.
 */

export const ARTIFACT_STORAGE = Symbol('ARTIFACT_STORAGE');

export interface ArtifactPutInput {
  storageKey: string;
  buffer: Buffer;
  contentType: string;
}

export interface ArtifactPutResult {
  storageKey: string;
  size: number;
  checksum: string;
}

export interface ArtifactStoragePort {
  put(input: ArtifactPutInput): Promise<ArtifactPutResult>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
