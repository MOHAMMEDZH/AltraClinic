/**
 * Phase 46e — Portal Experience & Cross-Cutting Integrations.
 *
 * Completes Release 46.0 patient UX and MVP Center wiring. Architecture Decisions
 * are unchanged. Deferred domains remain deferred.
 *
 * Status: **IMPLEMENTED** (QG-E) · accepted under Release 46.0 (QG-F).
 * Acceptance: [`PHASE_46_PRODUCTION_ACCEPTANCE.md`](./PHASE_46_PRODUCTION_ACCEPTANCE.md)
 * Release notes: [`RELEASE_46_0.md`](./RELEASE_46_0.md)
 */

# Scope

Presentation and integration only over capabilities delivered in 46a–46d:

- Portal home / dashboard
- Profile presentation (read-only safe facade)
- Account & security UI
- Caregiver management UI
- Portal-owned notification preferences (locale + email/sms/push)
- White Label completion (consume existing platform)
- Accessibility, localization, responsive completion
- Notification / Audit / Activity / Observability / Licensing / Feature Flags wiring
- API documentation, runbooks, operational guidance
- E2E + regression protection

# Portal UX

Authenticated users land on a home dashboard with:

- Welcome / brand surface
- Portal status (appointments / caregiver / enrollment)
- Upcoming appointment shortcuts (when appointments flag ON)
- Caregiver summary (when caregiver flag ON)
- Quick actions to profile, account, security, preferences
- Security reminder (no PHI)

Unauthenticated users see the foundation landing with sign-in entry.

# Dashboard

Surfaces only approved MVP data:

- Upcoming appointment count + next appointment time
- Active caregiver grant count
- Profile display name
- Flag-gated navigation

No clinical summaries, messaging, billing, documents, or results display.

# Account UI

`/account` provides:

- Account information from `GET /patient-portal/auth/me`
- Session status (patient session class)
- Navigation into MVP surfaces

# Security UI

Same page (`#security`):

- Change password → `POST /patient-portal/auth/change-password`
- MFA setup / confirm → `POST /patient-portal/auth/mfa/setup|confirm`
- Sign out / sign out everywhere → `POST /patient-portal/auth/logout|logout-all`

Reuses Phase 46b identity services; no new auth model.

# Profile UI

`/profile` presents the patient-safe demographics facade (self or caregiver acting context when enabled). Read-only; editing outside frozen MVP is not offered.

# Caregiver UI

`/caregivers`:

- Invite + accept invitation
- Pending / active / revoked-expired lists
- Expiration display
- Accessible revoke confirmation dialog
- Delegated-patient appointment preview (scope-gated API)

# Notification preferences

Portal-owned only:

- `GET|PATCH /patient-portal/me/preferences`
- Locale (`en` | `ar`)
- Channels: email, sms, push

Not a Notification Center inbox or template product.

# White Label

`GET /patient-portal/branding` (public, tenant-aware) resolves:

- colors, logos, favicon, font, portal name
- graceful defaults when tenant branding missing

Frontend ThemeProvider applies CSS tokens, favicon, and document title. Does not redesign White Label.

# Accessibility

- Skip link, banner / main / contentinfo landmarks
- Primary nav with focus-visible styles
- Accessible forms, alerts (`role="alert"`), status (`role="status"`)
- Native `<dialog>` for revoke confirmation
- Reduced-motion respect
- Tablists for acting context / appointment scopes

# Localization

- Complete en/ar message catalogs for MVP surfaces
- RTL via `dir` on document + shell
- Locale-aware date/number formatting
- Pluralization helper (`tp`)
- Missing key fallback to English then key

# Responsive

- Desktop / tablet / mobile breakpoints
- Stacked nav and full-width actions on small screens
- Dashboard grid collapses to single column

# Cross-cutting integrations

| Center | Usage |
|--------|--------|
| Notification | Intent paths from prior phases; portal prefs own channel toggles |
| Audit | Preferences update + existing identity/caregiver/scheduling audits |
| Activity | Non-PHI preference + prior MVP events |
| Observability | Release 45 namespaces; experience metrics registered |
| White Label | Branding resolve endpoint |
| Licensing | `patientPortal` / caregiver license gates unchanged |
| Feature Flags | Master + sub-flags default OFF |

# Observability

Health reports `phase: 46e`, `experienceReady: true`. Metrics include:

- `patient_portal.experience.home`
- `patient_portal.preferences.updates`
- `patient_portal.branding.resolve`

No PHI in logs/metrics/traces.

# API documentation (Release 46 public portal namespace)

## Foundation

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/patient-portal/health` | Public | Flag/license/observability readiness |
| GET | `/patient-portal/foundation` | Public | Deferred list + experience status |
| GET | `/patient-portal/branding` | Public | Tenant branding snapshot |

## Auth (46b)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/patient-portal/auth/login` | MFA challenge or tokens |
| POST | `/patient-portal/auth/enroll` | Enrollment activation |
| POST | `/patient-portal/auth/mfa/verify` | Challenge completion |
| POST | `/patient-portal/auth/logout` | Current session |
| POST | `/patient-portal/auth/logout-all` | All sessions |
| POST | `/patient-portal/auth/change-password` | Authenticated |
| POST | `/patient-portal/auth/mfa/setup` | Authenticated |
| POST | `/patient-portal/auth/mfa/confirm` | Authenticated |
| GET | `/patient-portal/auth/me` | Account/security status |

## Appointments (46c)

`/patient-portal/me/appointments|providers|availability` — Scheduling SoR facade.

## Safe access (46d/46e)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/patient-portal/me/profile` | Safe demographics |
| GET/PATCH | `/patient-portal/me/preferences` | Portal-owned prefs |
| GET | `/patient-portal/me/results/gate` | Gate plumbing only |
| GET/POST | `/patient-portal/me/caregivers` | List / invite |
| POST | `/patient-portal/me/caregivers/:grantId/revoke` | Revoke |
| POST | `/patient-portal/me/caregiver-invitations/accept\|decline` | Invitation response |
| GET | `/patient-portal/me/delegated-patients` | Caregiver subjects |

Acting headers: `X-Portal-Acting-Context`, `X-Portal-Subject-Patient-Id`.

# Operational guidance

## Feature enablement

1. Confirm tenant license `patientPortal` (and `caregiverAccess` if needed).
2. Enable `PATIENT_PORTAL_CENTER_ENABLED` for target environment only after QG-F.
3. Enable sub-flags (`APPOINTMENTS`, `CAREGIVER`, `PROFILE`) as required.
4. Mirror Vite flags for the patient-portal app build.
5. Validate branding via `/patient-portal/branding?tenantId=…`.
6. Keep defaults OFF in shared/prod templates.

## Deployment notes

- Deploy API + `apps/patient-portal` together for 46e routes.
- Permission matrix must include `me/preferences` and caregiver patient routes.
- No Prisma schema change required for 46e preferences (existing portal prefs VO).

## Support diagnostics

- `GET /patient-portal/health` → `experienceReady`, flag matrix, contributor statuses
- Correlation id on all portal API calls
- Session class must remain `patient` (never staff crossover)

## Rollback

1. Set `PATIENT_PORTAL_CENTER_ENABLED=false` (and Vite mirrors).
2. Confirm `/patient-portal/health` shows dormant / not live.
3. Leave Releases 41–45 untouched.
4. Do not delete data; portal is facade — Scheduling/Patients remain SoR.

# Runbooks

## Portal unavailable

- Check master flag and license.
- Confirm tenant `allowPatientPortal`.
- Inspect health contributors for configuration/licensing/rbac.

## Branding fallback

- Missing branding returns defaults (`source: default`).
- Broken logo URLs degrade safely (logo omitted).

## Preference save failures

- Verify enrollment complete + `update` permission.
- Check audit/activity emitters for errors without PHI.

## Caregiver revoke UX

- Confirm dialog must complete before revoke POST.
- Revoked grants appear under revoked/expired list.

# Test coverage

- Frontend Vitest: foundation regression, experience/home/account/a11y/WL/i18n
- API Jest: foundation phase 46e, branding, preferences wiring, caregiver regression
- E2E-style happy path coverage for identity → appointments → caregiver → home

# Known limitations

- No Notification Center UI
- No clinical results display (gate only)
- Profile not editable beyond frozen scope
- Staff admin UX remains minimal (existing accounts API)

# Deferred functionality

Clinical records/results product · messaging · billing · payments · documents · telemedicine · Marketplace · FHIR · native mobile · advanced family accounts · PGHD · Phase 46f acceptance packaging

# Architecture compliance

- Consumer facade, not SoR
- API-first, stateless, tenant isolated, PHI-minimized, fail closed
- No Architecture Decision changes
- Releases 41–45 unchanged
