# Patient Portal — Operational Runbooks (Phase 46e)

Companion to [`PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md`](./PATIENT_PORTAL_EXPERIENCE_AND_INTEGRATIONS.md).

## Enablement checklist (post QG-F only for production)

1. License `patientPortal` (+ `caregiverAccess` if caregivers needed).
2. Set API flags OFF by default in templates; enable per tenant/environment intentionally.
3. Mirror Vite flags for `apps/patient-portal`.
4. Validate `GET /patient-portal/health` → `experienceReady: true`, `dormant: false` only when intended.
5. Validate branding: `GET /patient-portal/branding?tenantId=<id>`.
6. Smoke: enroll → login → home → appointments → caregivers → account/security/preferences.

## Rollback

1. `PATIENT_PORTAL_CENTER_ENABLED=false` (and Vite mirrors).
2. Confirm health `dormant: true` / `productSurfacesLive: false`.
3. Do not modify Releases 41–45.
4. Scheduling/Patients SoRs remain authoritative; portal facade may go dormant safely.

## Support diagnostics

| Symptom | Check |
|---------|--------|
| Portal unavailable page | Master flag, license, `allowPatientPortal` |
| Missing branding | Tenant `features.branding`; expect defaults |
| Preference save 403 | Enrollment complete, `update` permission, session class patient |
| Caregiver actions missing | `PATIENT_PORTAL_CAREGIVER_ENABLED` + caregiver license |
| Appointments missing | `PATIENT_PORTAL_APPOINTMENTS_ENABLED` |

## Feature-state reporting

Use health endpoint fields: `flags`, `licensing`, `experienceReady`, `healthContributors`, `observability`.

Never log PHI in support tickets; use correlation ids only.
