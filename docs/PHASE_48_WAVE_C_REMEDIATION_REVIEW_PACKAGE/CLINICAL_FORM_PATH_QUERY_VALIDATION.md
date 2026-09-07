# Clinical Form Path / Query UUID Validation (Round 6 B3)

## Mechanism

NestJS `ParseUUIDPipe` on controller path/query parameters (ValidationPipe boundary).

## Params / queries covered

| Route | Param / query | Pipe |
|-------|---------------|------|
| `GET /clinical-forms/templates/:id` | `id` | `ParseUUIDPipe` |
| `POST /clinical-forms/templates/:id/activate` | `id` | `ParseUUIDPipe` |
| `POST /clinical-forms/templates/:templateId/versions` | `templateId` | `ParseUUIDPipe` |
| `POST /clinical-forms/versions/:id/publish` | `id` | `ParseUUIDPipe` |
| `POST /clinical-forms/instances/:id/sign` | `id` | `ParseUUIDPipe` |
| `POST /clinical-forms/instances/:id/void` | `id` | `ParseUUIDPipe` |
| `GET /clinical-forms/requirements` | `clinicalServiceId` (query) | `ParseUUIDPipe({ optional: true })` |
| `POST /clinical-forms/requirements/:id/deactivate` | `id` | `ParseUUIDPipe` |

## Malformed examples → HTTP result

| Input | Route family | Result |
|-------|--------------|--------|
| `not-a-uuid` | sign | 400 |
| `not-a-uuid` | void | 400 |
| `not-a-uuid` | template GET | 400 |
| `not-a-uuid` | publish | 400 |
| `bad` | requirements query | 400 |
| `not-a-uuid` | requirements deactivate | 400 |

Never 500 from PostgreSQL UUID parse.

## No-service-call proof

HTTP integration test stubs count service invocations; invalid path/query leaves `signCalls` / `voidCalls` at 0 and never reaches Prisma with malformed UUID.

## File

`apps/api/src/modules/clinical-forms/api/clinical-forms.controller.ts`

## Result

**PASS**
