# Enterprise Media Processing Pipeline

**Version**: 2026-06-15.v1  
**Status**: Implemented  
**Stack**: Sharp · Local/S3 storage · NestJS Media Module · Prisma

---

## Overview

The media pipeline handles secure upload, virus scanning, image transformation, and tenant-isolated storage for clinical and beauty assets.

```
Client (multipart) → MediaController
                          ↓
                    UploadMediaHandler
                          ├── SubscriptionEnforcement (storage quota)
                          ├── MediaAsset.create (DB pending)
                          └── MediaProcessingPipeline
                                ├── VirusScannerPort (hook)
                                ├── MediaStoragePort (secure store)
                                └── SharpMediaProcessor (transform)
                          ↓
                    MediaAsset READY + domain events
```

---

## Supported Categories

| Category | Use case | Image processing |
|---|---|---|
| `patient_attachment` | General patient files | Full pipeline if image |
| `medical_document` | PDFs, Word docs | Original + metadata only |
| `dental_image` | X-rays, intraoral photos | Full pipeline (AVIF skipped — CPU cost) |
| `beauty_before_after` | Before/after photos | Full pipeline + comparison grouping |

Beauty before/after pairs link via `comparisonGroupId` + `comparisonRole` (`before` | `after`).

---

## Processing Features

| Feature | Implementation |
|---|---|
| Compression | JPEG mozjpeg, max width 1920px |
| Thumbnail | 256×256 max, JPEG quality 75 |
| WebP | Quality 80 |
| AVIF | Quality 50 (skipped for dental, graceful fallback on error) |
| Metadata | Sharp `metadata()` + SHA-256 checksum; EXIF stripped on all image outputs |
| Virus scan | `VirusScannerPort` hook — noop in dev, ClamAV/cloud in prod |
| Secure storage | Tenant-scoped keys; no public URLs; download via authenticated API |

---

## Architecture Decisions (Competing Architects)

### Decision 1: Sharp in-process (not ImageMagick / cloud Lambda)

| | Sharp in-process | AWS Lambda + Sharp |
|---|---|---|
| Latency | ~200ms for 2MB image | ~1–3s cold start |
| Cost | CPU on app server | Per-invocation billing |
| Complexity | Single deploy | Extra infra |

**Verdict**: In-process Sharp for files < 50MB. Phase 2: async queue when p95 > 2s.

### Decision 2: Scan buffer before store (not scan-on-disk)

**Challenger**: ClamAV traditionally scans files on disk.  
**Counter**: ClamAV INSTREAM accepts buffers/streams. Storing infected files—even in quarantine—increases attack surface.  
**Verdict**: Scan-first, store-clean-only.

### Decision 3: Local storage dev / S3 prod (via port)

**Challenger**: Use MinIO locally to mirror S3 exactly.  
**Counter**: Local filesystem adapter enables zero-dependency dev. `MediaStoragePort` makes S3 swap transparent.  
**Verdict**: Port abstraction; S3 adapter in Phase 2.

### Decision 4: Variants as JSONB (not separate table)

**Challenger**: Normalized `media_variants` table enables per-variant queries.  
**Counter**: Variants are always loaded with the parent asset. JSONB avoids joins and matches read pattern.  
**Verdict**: JSONB now; normalize if variant-level analytics needed.

### Decision 5: Authenticated download endpoint (not signed URLs)

**Challenger**: S3 presigned URLs offload bandwidth from API.  
**Counter**: Presigned URLs bypass permission re-check after issuance. Authenticated endpoint re-validates tenant + RBAC on every download.  
**Verdict**: API proxy download now; presigned URLs with short TTL in Phase 2 for CDN.

### Decision 6: EXIF stripping on all image outputs

Medical/beauty images may contain GPS, device serial numbers in EXIF. All Sharp re-encodes strip EXIF. `metadata.exifStripped = true` recorded for audit.

---

## Module Structure

```
src/modules/media/
├── domain/
│   ├── entities/media-asset.entity.ts
│   ├── value-objects/ (category, variant, metadata)
│   ├── repositories/media-asset.repository.interface.ts
│   ├── events/media.events.ts
│   └── exceptions/media.exceptions.ts
├── application/
│   ├── services/media-processing-pipeline.service.ts
│   ├── handlers/ (upload, get, download, delete)
│   └── dto/upload-media.dto.ts
├── infrastructure/
│   ├── repositories/prisma-media-asset.repository.ts
│   ├── storage/ (MediaStoragePort, LocalMediaStorageService)
│   ├── processing/sharp-media-processor.service.ts
│   └── virus-scan/ (VirusScannerPort, NoOpVirusScannerService)
├── api/media.controller.ts
└── media.module.ts
```

---

## Storage Key Format

```
{tenantId}/{assetId}/{variant}.{ext}
```

Examples:
- `abc-tenant/uuid-123/original.jpg`
- `abc-tenant/uuid-123/thumbnail.jpg`
- `abc-tenant/uuid-123/webp.webp`

Path traversal blocked: keys containing `..` or leading `/` rejected.

---

## API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/media/upload` | `api.media:create` | Multipart upload (field: `file`) |
| GET | `/media/:id` | `api.media:view` | Asset metadata + variant list |
| GET | `/media/:id/download?variant=webp` | `api.media:view` | Stream file bytes |
| DELETE | `/media/:id` | `api.media:delete` | Soft delete + storage cleanup |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MEDIA_STORAGE_PATH` | `./storage/media` | Local storage root (outside web root) |
| `MEDIA_MAX_FILE_SIZE_BYTES` | `52428800` (50 MB) | Max upload size |
| `MEDIA_VIRUS_SCANNER` | `noop` | Scanner backend (`noop`, `clamav`, `cloud`) |

---

## Subscription Integration

Storage quota enforced via `SubscriptionEnforcementService.enforceStorageLimit()`:
- Counts `sizeBytes` + all variant sizes per tenant
- Lite: 5 GB · Pro: 50 GB · Enterprise: unlimited
- Throws `PlanLimitExceededException` with `resource: storage_gb`

---

## Bypass Vulnerability Audit

| Risk | Status | Mitigation |
|---|---|---|
| Cross-tenant download | ✅ | `findById(tenantId, id)` on every operation |
| Path traversal in storage | ✅ | Key validation in `LocalMediaStorageService` |
| Unauthenticated file access | ✅ | No public URLs; JWT + PermissionGuard required |
| EXIF GPS leakage | ✅ | Stripped on all processed images |
| Infected file storage | ✅ | Quarantine before variant generation |
| MIME type spoofing | ⚠️ | MIME from client header; Phase 2: magic-byte validation |
| Storage quota bypass | ⚠️ | Pre-upload check only; TOCTOU race acceptable |
| Large file DoS | ⚠️ | 50MB limit; Phase 2: streaming upload + async processing |

---

## Phase 2 Roadmap

| Priority | Enhancement |
|---|---|
| High | S3 storage adapter with server-side encryption (SSE-KMS) |
| High | ClamAV daemon integration via `VirusScannerPort` |
| High | Magic-byte MIME validation (file-type library) |
| Medium | Async processing via BullMQ for files > 10MB |
| Medium | Presigned CDN URLs with 5-minute TTL + permission pre-check |
| Low | PDF thumbnail generation (pdf-poppler) |
| Low | DICOM support (separate pipeline — see FEATURE_INVENTORY.md) |
