# ROUND_2_DEVICE_API_CONTRACT_MATRIX

Invariant: `deviceId` is an **opaque external** identifier (`VARCHAR(120)`), not an internal UUID FK. HTTP must accept values like `EXT-DEVICE-001`.

| Case | Expected | Evidence | Result |
|------|----------|----------|--------|
| R2-B3-T1 opaque `EXT-DEVICE-001` | DTO validation passes; service receives string | `wave-e-http` | PASS |
| R2-B3-T2 length >120 | HTTP 400 | `wave-e-http` | PASS |
| R2-B3-T3 whitespace-only | HTTP 400 | `wave-e-http` | PASS |
| R2-B3-T4 correction DTO | payload + reason only; no UUID `deviceId` required | `wave-e-http` CorrectDeviceTreatmentDto | PASS |
| R2-B6-C create persists opaque id | DB `deviceId = EXT-DEVICE-001` | `wave-e-production-path` | PASS |
| R2-B6-C >120 / whitespace / empty | 400; no durable row for bad create attempt | production-path | PASS |

DTO: `CreateDeviceTreatmentDto.deviceId` — optional, `@IsString` `@MinLength(1)` `@MaxLength(120)` + trim (`wave-e.dto.ts`).
Service: `assertOpaqueExternalDeviceId` (`wave-e-reference.validation.ts`).
Schema: `DeviceTreatmentRecord.deviceId String? @db.VarChar(120)`.
