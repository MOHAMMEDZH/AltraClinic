# Domain-Driven Design (DDD) Architecture — Enterprise Healthcare SaaS Platform

Last updated: 2026-06-14

---

## ⚠️ CRITICAL SECURITY & ARCHITECTURE FINDINGS — READ FIRST

**See comprehensive review:** [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md)

### Summary of Findings

Current domain implementation demonstrates solid foundational patterns (DDD, CQRS, event-driven) but contains **critical security, performance, and architectural consistency issues** that will cause production failures if left unaddressed.

#### Critical Issues (Must Fix Before Production)

| Category | Issue | Impact | Fix Effort |
|----------|-------|--------|-----------|
| **Security** | Tenant context extracted from user input (Reporting) | Multi-tenant data breach | 2 hrs |
| **Security** | Inconsistent guard/policy patterns (7+ implementations) | Authorization bypass | 4 hrs |
| **Security** | Guards don't verify ownership | Cross-tenant access possible | 3 hrs |
| **Performance** | No pagination on list endpoints | OOM at scale (100K+ records) | 6 hrs |
| **Architecture** | Missing event handlers | Event-driven incomplete | 8 hrs |
| **DDD** | Handlers using TenantContextService | Infrastructure in domain | 3 hrs |

#### Estimated Remediation: ~70 hours (2 weeks for 2-person team)

**Action Required:** Review [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) and prioritize critical fixes before beta release.

---

## DDD Overview & Strategic Approach

### Bounded Contexts

A **bounded context** is an explicit boundary within which a domain model is defined and applicable. Each bounded context has its own language (ubiquitous language), models, and data storage.

**Context Map**: Shows how bounded contexts interact and communicate.

### Aggregate Root Pattern

An **aggregate** is a cluster of related entities/value objects that are treated as a single unit. The aggregate root is the entity at the top; external code only references the aggregate root, not internal entities.

**Example**: `Patient` is an aggregate root containing `Medication`, `Allergy`, `Address` value objects.

---

## 1) IDENTITY DOMAIN

### Purpose
Manage user authentication, authorization, and access control across the platform.

### Bounded Context
**Domain**: Identity & Access Management (IAM)

### Aggregates

#### 1.1) User Aggregate

**Aggregate Root**: `User`

**Entities**:
- `User` (root): Represents a system user (staff member or admin)
  - Properties: userId (UUID), email, hashedPassword, firstName, lastName, isActive, createdAt, updatedAt
  - Methods: `ChangePassword()`, `UpdateProfile()`, `DeactivateAccount()`

**Value Objects**:
- `Email`: Immutable email value object (enforces format validation)
  - Properties: value, domain, localPart
  - Methods: `IsValid()`, `NormalizeForComparison()`

- `PasswordHash`: Hashed password (never exposes plaintext)
  - Properties: hash, algorithm (bcrypt), salt, iterations
  - Methods: `Verify(plaintext)`, `CreateNew(plaintext)`

- `Name`: Full name (first, last, display name)
  - Properties: firstName, lastName, displayName
  - Methods: `GetFullName()`, `GetInitials()`

- `PasswordPolicy`: Password requirements
  - Properties: minLength, requireUppercase, requireNumbers, requireSpecialChars, expirationDays
  - Methods: `Validate(password)`

**Domain Events**:
- `UserCreated`: When new user created
- `UserEmailVerified`: When user email confirmed
- `PasswordChanged`: When password updated
- `UserDeactivated`: When user account deactivated
- `FailedLoginAttempt`: When login attempt failed
- `AccountLockedDueToFailedAttempts`: When account locked after 5 failed logins

#### 1.2) Role Aggregate

**Aggregate Root**: `Role`

**Entities**:
- `Role` (root): Represents a user role (Doctor, Receptionist, Admin, etc.)
  - Properties: roleId (UUID), name (unique), description, clinicId, isActive
  - Methods: `UpdatePermissions()`, `Deactivate()`

- `Permission`: Individual permission (e.g., "CreateAppointment", "ViewPatient")
  - Properties: permissionId (UUID), name, description, resourceType, action

**Value Objects**:
- `Capability`: Represents what a role can do
  - Properties: permissionId, resourceType, action, conditions (optional)
  - Methods: `Matches(requiredCapability)`

**Domain Events**:
- `RoleCreated`: New role defined
- `PermissionAdded`: Permission added to role
- `PermissionRemoved`: Permission removed from role
- `RoleDeactivated`: Role deactivated (existing users' roles migrated)

#### 1.3) Session Aggregate

**Aggregate Root**: `Session`

**Entities**:
- `Session` (root): Active user session
  - Properties: sessionId (UUID), userId (FK), createdAt, expiresAt, isRevoked, ipAddress, userAgent
  - Methods: `Extend()`, `Revoke()`, `IsValid()`

**Value Objects**:
- `SessionToken`: Encrypted session token (JWT or opaque)
  - Properties: token, algorithm, signature, payload
  - Methods: `Parse()`, `IsExpired()`, `Validate()`

- `DeviceInfo`: Device information (for security monitoring)
  - Properties: ipAddress, userAgent, deviceType, osType, osVersion
  - Methods: `IsSuspicious()` (compared to historical pattern)

**Domain Events**:
- `SessionCreated`: User logged in
- `SessionExtended`: Session extended due to activity
- `SessionRevoked`: User logged out or session expired
- `SuspiciousSessionDetected`: Unusual login location/device

### 1.4) Implementation Notes — API Skeleton

- A minimal Identity API skeleton has been implemented under `apps/api/src/modules/identity` as a reference implementation for the platform. It follows DDD boundaries and CQRS-inspired handler separation without embedding heavy business logic.

  - Domain: `domain/` contains `User` entity and `Email` value object.
  - Application: `application/commands` and `application/handlers` contain `RegisterUserCommand` and `GetUserQuery` with corresponding handlers.
  - Infrastructure: `infrastructure/` provides an `InMemoryUserRepository` and a `PasswordHasher` (bcryptjs) for local development.
  - Framework wiring: `identity.module.ts` and `controllers/identity.controller.ts` expose `POST /identity/register` and `GET /identity/:id` for exploration.

### Competing-Team Critique (Identity Implementation)

- Weakness: The in-memory repository is for development only and cannot be used in production; relying on it beyond early testing risks data loss and inconsistent behavior.
  - Alternative: provide both an SQL-backed repository (TypeORM/Prisma) and a migration path with automated schema/versioning and seeds for test tenants.

- Weakness: Password hashing and authentication are implemented minimally (bcryptjs, no rate-limiting, no token issuance).
  - Alternative: separate authentication into an Auth service or adapter that supports JWT/OAuth and hardened controls (rate limits, login throttling, device management, MFA flows), and keep the Identity domain focused on user lifecycle and claims.

- Weakness: NestJS module imports controller-level instantiation of repository and handlers (singletons bound at module level via direct construction in controller file), which hinders testability and DI benefits.
  - Alternative: register repository and handlers as Nest providers, inject them via constructor injection, and keep controller code framework-agnostic where possible. This enables swapping implementations at runtime (e.g., in-memory vs. SQL) via DI tokens.

- Weakness: No event emission on user lifecycle changes (e.g., `UserCreated`), limiting downstream loose coupling.
  - Alternative: emit domain events via an `EventPublisher` (OpenTelemetry/mapper) and add contract tests for event schemas; consumers can react to `UserCreated`, `PasswordChanged`, and `AccountLocked` events.

- Weakness: Error handling is coarse (throws generic Errors) and leakable to clients.
  - Alternative: adopt a structured error model (`BaseError` subclasses) with mapping to HTTP status codes and machine-readable error codes for clients and automation.

### Next Steps for Production Hardening

- Implement a production-grade user repository backed by a relational DB with migrations (Prisma or TypeORM).
- Add authentication tokens (JWT refresh/access) and secure storage for refresh tokens (rotating refresh tokens).
- Implement rate-limiting, MFA enrollment, account recovery flows, and device/session management as part of the Session aggregate.
- Add contract tests for event schemas and include event versioning with a schema registry.


### Competing-team Critique

**Weakness 1**: Email as unique identifier; fragile if user changes email
- **Alternative**: Use immutable userId (UUID); email as mutable contact field

**Weakness 2**: Password hashing in value object; better in separate service
- **Alternative**: Delegate to authentication service (Auth0, Firebase); DDD focuses on business rules, not crypto

**Weakness 3**: Session management complex; better as infrastructure layer
- **Alternative**: Use JWT tokens (stateless); simpler than session aggregate

---

## 2) PATIENTS DOMAIN

### Purpose
Manage patient master data, demographics, medical history, allergies, contacts.

### Bounded Context
**Domain**: Patient Information Management

### Aggregates

#### 2.1) Patient Aggregate

**Aggregate Root**: `Patient`

**Entities**:
- `Patient` (root): Core patient record
  - Properties: patientId (UUID), clinicId (FK), firstName, lastName, gender, dateOfBirth, maritalStatus, nationality, isActive, createdAt, updatedAt
  - Methods: `UpdateDemographics()`, `Archive()`, `Reactivate()`

- `PatientContact`: Contact information (can have multiple)
  - Properties: contactId (UUID), patientId (FK), type (mobile, email, phone), value, isPrimary, isVerified
  - Methods: `Verify()`, `UpdateValue()`

- `EmergencyContact`: Emergency contact information
  - Properties: contactId (UUID), patientId (FK), name, relationship, phoneNumber, address
  - Methods: `Update()`

- `Identification`: Government ID or identification
  - Properties: idId (UUID), patientId (FK), type (SyrianID, Passport, TemporaryID), number, expiryDate, isVerified
  - Methods: `Verify()`, `IsExpired()`

**Value Objects**:
- `PersonName`: Person's name (handles Arabic naming conventions)
  - Properties: givenName, familyName, fatherName (optional, per Syrian tradition), formalName (for official use)
  - Methods: `GetFullName()`, `GetFormalName()`

- `DateOfBirth`: Immutable date with age calculation
  - Properties: date, isEstimated (if exact date unknown)
  - Methods: `CalculateAge()`, `GetAgeGroup()` (pediatric, adult, geriatric)

- `Address`: Patient address (supports RTL Arabic)
  - Properties: street, city, postalCode, country (Syria), province
  - Methods: `ToString()`, `IsComplete()`

- `ContactInfo`: Phone/email/address collection
  - Properties: mobileNumber, email, address, alternatePhone
  - Methods: `GetPrimaryPhone()`, `GetVerifiedEmail()`

- `MedicalIdentifier`: Internal clinic identifier (not UUID)
  - Properties: clinicId, sequentialNumber, prefix
  - Methods: `FormatDisplay()` (e.g., "CLI-001234")

**Domain Events**:
- `PatientCreated`: New patient registered
- `PatientDemographicsUpdated`: Demographics changed (name, DOB, etc.)
- `PatientContactAdded`: Contact information added
- `PatientContactVerified`: Contact verified (email confirmation, SMS OTP)
- `PatientDeactivated`: Patient record marked inactive

### Implementation Notes — Patients API Skeleton

- A minimal Patients API has been implemented under `apps/api/src/modules/patients` to provide a reference DDD implementation and quick local testing.

  - Domain: `Patient` aggregate with `PatientName` and `Address` value objects.
  - Application: `CreatePatientCommand` / `GetPatientQuery` and simple handlers returning safe projections.
  - Infrastructure: `InMemoryPatientRepository` for local development and fast iteration.
  - Framework wiring: `PatientsModule` and `PatientController` expose `POST /patients` and `GET /patients/:id`.

### Competing-Team Critique (Patients)

- Weakness: The current in-memory repository and controller-instantiated handlers are acceptable for prototypes but block modularity, testing, and production readiness.
  - Alternative: Register repositories and handlers as Nest providers and inject them. Provide environment-based provider tokens that swap an in-memory provider for a Prisma/TypeORM implementation when running in production.

- Weakness: Patient identifiers are generated with a lightweight ad-hoc scheme (timestamp+random) rather than a canonical UUID or domain-specific MRN pattern.
  - Alternative: Use UUIDv4 for global uniqueness and introduce a separate `medicalRecordNumber` value object that supports human-friendly formatting and uniqueness constraints scoped to clinic/tenant.

- Weakness: No validation, schema evolution, or normalization are applied to demographics and addresses; risks inconsistent data (e.g., name casing, DOB formats).
  - Alternative: Centralize input validation using DTO validators (class-validator) and canonical normalizers for name and address; store dates in ISO 8601 and provide transformation at the application boundary.

- Weakness: No patient-level privacy controls or pseudonymization support are present, which is essential for healthcare compliance.
  - Alternative: Add a `PrivacyProfile` value object and support pseudonymization/anonymization pipelines, field-level encryption for sensitive identifiers, and clear data retention policies per tenant.

- Weakness: Lack of audit/event emission for patient lifecycle events limits observability and downstream integration (consent, billing, analytics).
  - Alternative: Emit domain events (`PatientCreated`, `PatientDemographicsUpdated`) to the message bus and record an append-only audit log for all changes with actor and timestamp metadata.

### Next Steps (recommended)

- Replace `InMemoryPatientRepository` with a Prisma-backed repository and migrations; include a `patient` table with indexes on `clinicId`, `medicalRecordNumber`, and `normalizedName`.
- Add DTO validation with `class-validator` and map incoming DTOs to domain objects in application handlers.
- Register providers via Nest DI to allow swapping implementations and ease testing.
- Implement event publication for key domain events and add contract tests for the event payloads.

- `PatientArchived`: Patient data archived (no longer active, >5 years)
- `PatientDuplicateDetected`: Potential duplicate patient identified

### Competing-team Critique

**Weakness 1**: Storing full address; not always provided; nullable fields
- **Alternative**: Address optional; provide minimal address initially; extend on next visit

**Weakness 2**: Patient identification complex (Syrian ID format varies)
- **Alternative**: Support multiple ID types; validate by type (Syria-specific logic in value object)

**Weakness 3**: Patient aggregate may grow large (many contacts, identifications)
- **Alternative**: Separate contact and identification into separate aggregates; reference via patientId

---

## 3) EMR (ELECTRONIC MEDICAL RECORDS) DOMAIN

### Purpose
Store clinical encounter notes, vital signs, assessments, clinical history.

### Bounded Context
**Domain**: Clinical Documentation & Medical Records

### Aggregates

#### 3.1) Encounter Aggregate

**Aggregate Root**: `Encounter`

**Entities**:
- `Encounter` (root): Single clinical visit/consultation
  - Properties: encounterId (UUID), patientId (FK), providerId (FK), clinicId (FK), visitDate, visitType (consultation, follow-up, procedure), status (scheduled, in-progress, completed, cancelled), duration (minutes), createdAt, updatedAt
  - Methods: `StartEncounter()`, `CompleteEncounter()`, `Cancel(reason)`, `AddNote()`, `AddVitalSigns()`

- `ClinicalNote`: Structured encounter documentation
  - Properties: noteId (UUID), encounterId (FK), chiefComplaint, historyOfPresentIllness, reviewOfSystems, assessment, plan, notes (free text), createdBy (providerId), createdAt
  - Methods: `Update()`, `Lock()` (finalize note)

- `VitalSigns`: Vital measurements
  - Properties: signId (UUID), encounterId (FK), systolicBP, diastolicBP, heartRate, temperature, respiratoryRate, oxygenSat, weight, height, measuredAt
  - Methods: `IsAbnormal()` (flags abnormal values)

- `AssessmentItem`: Single diagnosis or assessment
  - Properties: assessmentId (UUID), encounterId (FK), code (ICD-10), description, isPrimary, severity
  - Methods: `SetPrimary()`

**Value Objects**:
- `VisitType`: Type of clinical visit
  - Properties: type (consultation, follow-up, procedure, emergency, telehealth)
  - Methods: `RequiresApproval()` (procedure does, consultation doesn't)

- `VitalSignValue`: Single vital measurement with validation
  - Properties: value, unit, measurementMethod (manual, automated), timestamp
  - Methods: `IsNormal()`, `IsAbnormal()`, `RequiresAlert()`

- `ClinicalCode`: Diagnosis or procedure code (ICD-10, CPT)
  - Properties: code, system (ICD-10, CPT), description, isActive
  - Methods: `IsValid()`, `GetCategory()`

- `EncounterStatus`: Lifecycle status of encounter
  - Properties: status (scheduled, in-progress, completed, cancelled), reason (if cancelled), timestamp
  - Methods: `CanTransitionTo(newStatus)`

**Domain Events**:
- `EncounterCreated`: Appointment converted to encounter (visit started)
- `EncounterStarted`: Doctor begins encounter
- `VitalSignsRecorded`: Vital signs measured and documented
- `AssessmentAdded`: Diagnosis/assessment added
- `NoteAdded`: Clinical note added to encounter
- `EncounterCompleted`: Encounter documented and closed
- `EncounterCancelled`: Encounter cancelled
- `AbnormalVitalDetected`: Alert when vital signs abnormal

#### 3.2) Medication Aggregate

**Aggregate Root**: `Medication`

**Entities**:
- `Medication` (root): Prescribed medication
  - Properties: medicationId (UUID), encounterId (FK), patientId (FK), providerId (FK), clinicId (FK), drugName, strength, form, quantity, dosageInstructions, frequency, duration, refillsAllowed, createdAt, prescribedAt, expiresAt
  - Methods: `RequestRefill()`, `VerifyInteraction()`, `CheckContraindication()`, `ExpireMedication()`

**Value Objects**:
- `DrugInfo`: Medication details (from drug database)
  - Properties: drugId (UUID), name, strength, form, category, manufacturer, activeIngredient
  - Methods: `IsGeneric()`, `GetSubstitutes()` (generic alternatives)

- `Dosage`: Dosing instructions
  - Properties: quantity, unit, frequency (TID, QID, OD, etc.), duration, durationUnit, specialInstructions
  - Methods: `GetInstructionText()`, `IsValidForAge(patientAge)` (pediatric adjustments)

- `RefillInfo`: Refill tracking
  - Properties: refillsAllowed, refillsUsed, refillsRemaining, nextRefillEligibleDate
  - Methods: `CanRefill()`, `UseRefill()`, `UpdateRefills(newCount)`

- `DrugInteraction`: Known drug interaction
  - Properties: drug1Id, drug2Id, severity (minor, moderate, severe), description, recommendation
  - Methods: `IsSevere()`

**Domain Events**:
- `MedicationPrescribed`: Medication prescribed to patient
- `MedicationRefillRequested`: Patient requests refill
- `MedicationRefillApproved`: Doctor approves refill
- `MedicationRefillDispensed`: Refill dispensed (pharmacy confirmation)
- `DrugInteractionDetected`: Potential interaction with current medications
- `ContraindicationDetected`: Medication contraindicated for patient (allergy, condition)
- `MedicationExpired`: Prescription expired

### Competing-team Critique

**Weakness 1**: Vital signs stored in encounter; should they be separate aggregate?
- **Alternative**: Separate VitalSigns aggregate; referenced from Encounter. Enables independent vital monitoring (e.g., patient logs vitals at home)

**Weakness 2**: Medication aggregate includes full drug info; redundant with drug database
- **Alternative**: Medication stores drug reference only (drugId); fetch drug details from Drug domain via read model

**Weakness 3**: No support for clinical protocols or templates
- **Alternative**: Add Template entity (e.g., "Hypertension Follow-up"); prepopulates encounter fields

---

## 4) DENTAL DOMAIN

### Purpose
Specialty-specific domain for dental clinic features (odontogram, treatment plans, dental procedures).

### Bounded Context
**Domain**: Dental Clinical Management

### Aggregates

#### 4.1) DentalEncounter Aggregate

**Aggregate Root**: `DentalEncounter`

**Entities**:
- `DentalEncounter` (root): Dental visit
  - Properties: encounterId (UUID), patientId (FK), dentistId (FK), clinicId (FK), visitDate, visitType (exam, cleaning, filling, root canal, extraction), status, createdAt
  - Methods: `AddToothProcedure()`, `GenerateTreatmentPlan()`, `CreateOdontogram()`, `CompleteVisit()`

- `Odontogram`: Tooth chart (visual representation of dental status)
  - Properties: odontogramId (UUID), encounterId (FK), teeth (array of ToothStatus), notes
  - Methods: `MarkTooth(toothNumber, status)`, `GetTeethRequiringTreatment()`, `RecordTreatment(toothNumber, procedure)`

- `ToothStatus`: Status of individual tooth (linked to odontogram)
  - Properties: toothNumber (1-32, using FDI numbering), status (healthy, cavity, root-canal, extracted, implant, crown), notes
  - Methods: `RequiresTreatment()`

- `TreatmentPlan`: Proposed dental treatment
  - Properties: planId (UUID), encounterId (FK), procedures (array), estimatedCost, priorityOrder, createdAt, approvedAt
  - Methods: `AddProcedure()`, `ReorderProcedures()`, `Approve()`, `GetCostEstimate()`

- `DentalProcedure`: Individual procedure
  - Properties: procedureId (UUID), toothNumber (or null for full mouth), type (filling, extraction, root canal, crown, etc.), duration, cost, status (planned, completed), notes
  - Methods: `Complete()`, `GetSuppliesNeeded()`

**Value Objects**:
- `ToothNumber`: FDI tooth numbering system (1-32 for adult teeth)
  - Properties: number, quadrant, positionInQuadrant, isDeciduous (primary teeth use 51-85)
  - Methods: `GetQuadrant()`, `GetJaw()` (upper/lower), `GetPosition()` (incisor, canine, premolar, molar)

- `ProcedureType`: Type of dental procedure
  - Properties: type (filling, extraction, root-canal, crown, implant, scaling, whitening, etc.), treatmentArea (tooth, gum, bone, etc.)
  - Methods: `IsInvasive()`, `RequiresFollowUp()`, `EstimatedDuration()`

- `ToothCondition`: Health status of tooth
  - Properties: status (healthy, cavity, decay, root-canal, extracted, implant, crown, bridge, veneer), severity (mild, moderate, severe), notes
  - Methods: `RequiresTreatment()`, `GetRecommendation()`

- `DentalMaterial`: Filling/crown material
  - Properties: type (amalgam, composite, gold, ceramic, porcelain), color (shade), cost, durability (years)
  - Methods: `IsAesthetic()`, `IsConservative()`

**Domain Events**:
- `DentalEncounterCreated`: New dental visit scheduled
- `OdontogramCreated`: Tooth chart recorded
- `ToothProcedureRecorded`: Procedure on tooth documented
- `TreatmentPlanCreated`: Treatment plan generated
- `TreatmentPlanApproved`: Patient approves plan and associated costs
- `ProcedureCompleted`: Procedure completed
- `DentalMaterialUsed`: Material used for procedure (tracks inventory usage)

### Implementation Notes — Dental API Skeleton

- A Dental API skeleton has been implemented at `apps/api/src/modules/dental` following DDD, Clean Architecture, and the project's multi-tenant and security guidelines. The implementation includes:
  - Domain: `DentalChart` aggregate, `ToothVO`, `DentalProcedure` entity, factory for empty charts, and domain events (`DentalChartUpdatedEvent`).
  - Application: `CreateTreatmentCommand`/`GetDentalChartQuery` with handlers that use `TenantContextService` and publish domain events via the `EventPublisherInterface`.
  - Infrastructure: `InMemoryDentalRepository` (development-only) wired via DI token `DENTAL_RECORD_REPOSITORY`.
  - API: `DentalController` with routes `POST /dental/treatment` and `GET /dental/chart/:patientId`, protected by `DentalPermissionGuard` and a `DentalPolicyService` placeholder for RBAC rules.

Notes:
- Persistence: migrate `InMemoryDentalRepository` to a real repository (Prisma/Postgres) and apply DB migrations (`apps/api/db/migrations/001_create_dental.sql`) with `tenant_id` and `patient_id` indexes for fast lookups.
- Events: `DentalChartUpdatedEvent` is emitted; integrate a durable message bus (e.g., Kafka, RabbitMQ) for production event delivery and implement consumers for inventory, billing, and audit.
- Security: guard/policy placeholders must be replaced by real RBAC checks and integrated with `Identity` roles and permission matrix in `UI_SYSTEM.md` and `SECURITY.md`.

Refactor notes (2026-06-14):
- Replaced raw errors with proper HTTP exceptions (`NotFoundException`, `BadRequestException`) in `CreateTreatmentHandler` to avoid leaking internal errors and to provide consistent API responses.
- Added input validation for procedures and tooth numbers (1-32) at the application layer to prevent invalid domain state.
- Normalized `tenantId` and `patientId` keys in `InMemoryDentalRepository` to avoid casing/whitespace mismatches during lookups.
- Removed duplicated/unfinished controller content that could cause runtime/compile errors.

Outstanding improvements:
- Implement RBAC rules in `DentalPolicyService` using the platform permission matrix.
- Migrate `InMemoryDentalRepository` to a production `Prisma/Postgres` repository and apply RLS per `DATABASE.md`.
- Wire a durable event bus for `DentalChartUpdatedEvent` and add audit publishing/consumers (inventory, billing, audit).
- Add full unit/integration tests and CI checks; current tests are scaffolds only.


### Competing-team Critique

**Weakness 1**: Odontogram complex; not all clinics use it
- **Alternative**: Make odontogram optional; standard encounter note for basic clinics

**Weakness 2**: Treatment plan approval not in EMR domain; why separate?
- **Alternative**: Merge DentalEncounter into EMR; specialize via templates

---

## 5) BEAUTY DOMAIN

### Purpose
Specialty-specific domain for beauty/cosmetic clinic features (before/after photos, product tracking).

### Bounded Context
**Domain**: Beauty & Aesthetic Services

### Aggregates

#### 5.1) BeautyService Aggregate

**Aggregate Root**: `BeautyService`

**Entities**:
- `BeautyService` (root): Beauty service provided
  - Properties: serviceId (UUID), patientId (FK), estheticianId (FK), clinicId (FK), serviceType (hair, skin, nails, makeup, body), scheduledDate, completedDate, status, cost, createdAt
  - Methods: `RecordProgress()`, `UploadPhotos()`, `AddProductsUsed()`, `CompleteService()`, `ScheduleFollowUp()`

- `BeforeAfterPhotos`: Before and after images
  - Properties: photoSetId (UUID), serviceId (FK), beforePhoto (URL/blob), afterPhoto (URL/blob), timestamp, notes, angle (frontal, profile, top-down)
  - Methods: `Upload()`, `ValidateQuality()` (resolution, lighting)

- `ProductUsed`: Product used during service
  - Properties: productId (UUID), serviceId (FK), name, brand, quantity (ml, grams), cost, notes
  - Methods: `RecordUsage()` (updates inventory)

- `ServiceProgress`: Tracking service progress/timeline
  - Properties: progressId (UUID), serviceId (FK), milestone, completedAt, notes
  - Methods: `RecordMilestone()`

**Value Objects**:
- `ServiceType`: Type of beauty service
  - Properties: type (hair-cut, hair-color, hair-treatment, facial, skin-treatment, nails, makeup, body-treatment, waxing)
  - Methods: `RequiresPhotos()`, `RequiresProductTracking()`, `TypicalDuration()`

- `BeautyProduct`: Product information
  - Properties: productId (UUID), name, brand, category, sku, cost, supplier
  - Methods: `IsOrganic()`, `HasCertifications()`

- `PhotoAngle`: Direction of photo (for consistency)
  - Properties: angle (frontal, profile, top-down, closeup), description
  - Methods: `Match(anotherAngle)` (ensure consistency between before/after)

**Domain Events**:
- `BeautyServiceScheduled`: Service appointment created
- `BeautyServiceStarted`: Service begins
- `BeforePhotoRecorded`: Before photo taken
- `ProductApplied`: Product used on patient
- `AfterPhotoRecorded`: After photo taken
- `BeautyServiceCompleted`: Service finished
- `ProgressPhotosRecorded`: Follow-up progress photos at future dates
- `ProductInventoryDecremented`: Product usage tracked against inventory

Implementation notes (2026-06-14):
- Implemented `Beauty` bounded context with `BeautyService` aggregate, localized notes support (`LocalizedText` VO), domain events (`BeautyServiceScheduledEvent`, `BeautyServiceCompletedEvent`), application commands/queries and handlers, an in-memory repository for development, controller endpoints (`POST /beauty/service`, `GET /beauty/service/:id`), and a SQL migration placeholder `apps/api/db/migrations/002_create_beauty.sql`.
- Security: initial `BeautyPolicyService` and `BeautyPermissionGuard` added as placeholders. Must be replaced with RBAC checks tied to `Identity` roles and tenant scoping.
- Persistence: in-memory repository provided for dev; migrate to `Prisma/Postgres` and apply RLS for production.
- Events: `BeautyServiceScheduledEvent` is published via `EventPublisherInterface`; wire durable broker for production consumers.

### Competing-team Critique

**Weakness 1**: Beauty services not clinical; doesn't fit EMR domain
- **Alternative**: Right decision to separate as distinct domain

**Weakness 2**: Before/after photos large files; storage cost high
- **Alternative**: Compress/resize photos; store thumbnails for listing, full-res on-demand

---

## 6) MEDICAL DOMAIN

### Purpose
Specialty-specific domain for general medical clinic features (chronic disease management, lab integration).

### Bounded Context
**Domain**: Medical Clinical Management

### Aggregates

#### 6.1) ChronicDiseaseManagement Aggregate

**Aggregate Root**: `ChronicDiseaseCondition`

**Entities**:
- `ChronicDiseaseCondition` (root): Patient's chronic condition (diabetes, hypertension, asthma)
  - Properties: conditionId (UUID), patientId (FK), code (ICD-10), name, diagnosisDate, severity, controlStatus (well-controlled, partially-controlled, uncontrolled), lastReviewDate, nextReviewDate
  - Methods: `RecordVisit()`, `UpdateControlStatus()`, `ScheduleReview()`, `AddComplication()`, `GetRecommendedMonitoring()`

- `DiseaseMonitoring`: Monitoring plan for condition
  - Properties: monitoringId (UUID), conditionId (FK), testType (lab test, vital signs, imaging), frequency (daily, weekly, monthly, quarterly), target (e.g., BP < 130/80, glucose < 130 fasting), nextTestDue
  - Methods: `RecordResult()`, `IsMetTarget()`, `AlertIfOutOfRange()`

- `Complication`: Complication from chronic disease
  - Properties: complicationId (UUID), conditionId (FK), type, severity, onsetDate, status (active, resolved), notes
  - Methods: `Update()`

**Value Objects**:
- `DiseaseType`: Type of chronic disease
  - Properties: code (ICD-10), name, category (endocrine, cardiovascular, respiratory, etc.)
  - Methods: `GetRecommendedMonitoring()`, `GetCommonComplications()`

- `ControlStatus`: How well disease is controlled
  - Properties: status (well-controlled, partially-controlled, uncontrolled), lastUpdatedAt
  - Methods: `RequiresIntensiveManagement()`

- `MonitoringTarget`: Target goal for condition
  - Properties: metric (HbA1c, BP, blood glucose), targetValue, unit, frequency
  - Methods: `IsMetByResult(result)`

**Domain Events**:
- `ChronicDiseaseRecorded`: Patient diagnosed with chronic condition
- `DiseaseControlStatusUpdated`: Control status changed
- `MonitoringPlanCreated`: Monitoring plan established
- `MonitoringTestRecorded`: Test result recorded
- `TargetMetOrExceeded`: Patient meets/exceeds treatment target
- `OutOfRangeAlert`: Monitoring result out of target range
- `ComplicationRecorded`: New complication identified
- `ReviewDueAlert`: Condition review due (at least annual)

### Competing-team Critique

**Weakness 1**: Monitoring plan ties to disease management; should it be separate?
- **Alternative**: Keep together (one aggregate); tightly coupled

**Weakness 2**: Disease-specific templates missing (e.g., diabetes vs hypertension different)
- **Alternative**: Add Disease-specific templates in EMR domain; reference in medical domain

---

## 7) SCHEDULING DOMAIN

### Purpose
Manage provider schedules, time slots, availability, appointment scheduling logic.

### Bounded Context
**Domain**: Appointment Scheduling & Provider Availability

### Aggregates

#### 7.1) ProviderSchedule Aggregate

**Aggregate Root**: `ProviderSchedule`

**Entities**:
- `ProviderSchedule` (root): Provider's work schedule
  - Properties: scheduleId (UUID), providerId (FK), clinicId (FK), effectiveDate, expiryDate (if temp schedule), createdAt
  - Methods: `UpdateWeeklySchedule()`, `AddTimeOff()`, `RemoveTimeOff()`, `GetAvailableSlots(date, duration)`, `ReserveSlot(slot)`

- `WorkingDay`: Single day schedule
  - Properties: dayId (UUID), scheduleId (FK), dayOfWeek, startTime, endTime, isClosed, notes
  - Methods: `GetWorkingHours()`, `IsWorkingDay(date)`

- `Break`: Break or unavailability period
  - Properties: breakId (UUID), dayId (FK), startTime, endTime, type (lunch, meeting, personal), notes
  - Methods: `Overlaps(timeRange)`

- `TimeSlot`: Individual appointment slot
  - Properties: slotId (UUID), scheduleId (FK), startTime, endTime, isAvailable, reservedBy (appointmentId, if booked), serviceType (optional), capacity (1 for most, >1 for group)
  - Methods: `Reserve(appointmentId)`, `Release()`, `IsAvailable()`, `IsExpired()` (slot passed)

- `TimeOff`: Provider absence (vacation, sick leave, conference)
  - Properties: timeOffId (UUID), scheduleId (FK), startDate, endDate, type (vacation, sick, conference, other), approvalStatus, notes
  - Methods: `Approve()`, `Reject()`, `Update()`

**Value Objects**:
- `TimeRange`: Time period (start and end time)
  - Properties: startTime, endTime
  - Methods: `Duration()`, `Overlaps(otherRange)`, `Contains(time)`

- `DayOfWeek`: Day of week
  - Properties: day (Monday, Tuesday, etc.), dayNumber (1-7)
  - Methods: `IsDayOff()` (some providers don't work specific days)

- `Availability`: Provider availability status
  - Properties: status (available, on-break, off-duty, on-call), timestamp
  - Methods: `CanAcceptAppointment()`

- `Capacity`: Appointment slot capacity
  - Properties: slotCount (1 for individual, 2–20 for group), currentReservations
  - Methods: `IsAvailable()`, `GetSpacesRemaining()`

#### 7.2) AppointmentSlot Aggregate

**Aggregate Root**: `AppointmentSlot`

**Entities**:
- `AppointmentSlot` (root): Available appointment slot (separate from TimeSlot for booking)
  - Properties: slotId (UUID), providerId (FK), clinicId (FK), startTime, endTime, serviceType, capacity, isAvailable
  - Methods: `Book(patientId)`, `Release()`, `IsExpired()`, `LockForBooking()` (prevent race conditions)

**Value Objects**:
- `SlotDuration`: Duration of appointment slot
  - Properties: durationMinutes, isFlexible (true = can extend)
  - Methods: `IsStandardDuration()`

**Domain Events**:
- `ProviderScheduleCreated`: New schedule created
- `ProviderScheduleUpdated`: Schedule changed
- `WorkingDayAdded`: Working day added to schedule
- `WorkingDayRemoved`: Working day removed
- `TimeOffRequested`: Provider requests time off
- `TimeOffApproved`: Time off approved
- `TimeSlotCreated`: New time slot available for booking
- `TimeSlotReserved`: Time slot booked by appointment
- `TimeSlotReleased`: Time slot released (appointment cancelled)
- `TimeSlotExpired`: Time slot passed without booking

### Competing-team Critique

**Weakness 1**: TimeSlot and AppointmentSlot redundant; should consolidate
- **Alternative**: Single TimeSlot entity; tracks availability + booking

**Weakness 2**: No support for variable appointment duration per patient
- **Alternative**: Allow flexible duration; extend if patient needs more time

### Implementation Notes — Scheduling API Skeleton

- A minimal Scheduling API implementation exists at `apps/api/src/modules/scheduling` to demonstrate the `Appointment` aggregate, slot checks, and booking flows.

  - Domain: `Appointment` aggregate with `TimeSlot` value object and `AppointmentStatus` enum.
  - Infrastructure: `InMemoryAppointmentRepository` for local testing and concurrency-free experimentation.
  - Application: `CreateAppointmentCommand`/`GetAppointmentQuery` and handlers which check slot availability before booking.
  - Framework wiring: `SchedulingModule` and `AppointmentController` expose `POST /scheduling/appointments` and `GET /scheduling/appointments/:id`.

### Competing-Team Critique (Scheduling Implementation)

- Weakness: The in-memory repository and controller-instantiated handlers make testing and swapping implementations harder.
  - Alternative: Register repository and handlers as Nest providers with DI tokens and environment-based binding (in-memory for tests, Prisma/SQL for production).

- Weakness: Slot availability checks are done synchronously in-process; this risks race conditions under concurrent bookings.
  - Alternative: Use optimistic locking with a persistent store, or a reservation/lock service (Redis-based locks or database transactions), and implement idempotency keys for booking requests.

- Weakness: Time is represented as strings without timezone normalization; potential DST and timezone bugs.
  - Alternative: Use timezone-aware instants (ISO with zone or epoch ms + timezone) and normalize server-side to UTC. Store original timezone if needed.

- Weakness: No recurring appointment support, buffer times, or capacity for group sessions.
  - Alternative: Add recurring rules (RFC5545-like), slot buffers, and capacity attributes to support group bookings and prevent overbooking.

- Weakness: No audit trail or event publication on bookings, limiting observability and downstream systems (queueing, billing).
  - Alternative: Emit `TimeSlotReserved`/`AppointmentCreated` domain events to the message bus and append audit records with actor/context for compliance.

### Next Steps (recommended)

- Implement a persistent appointment repository using Prisma/Postgres and run migrations with constraints and unique indexes for provider/slot combinations.
- Add reservation/locking mechanism (Redis locks or DB transactions) and idempotency handling for create operations.
- Add DTO validation, timezone normalization utilities, and unit/integration tests for concurrency and DST edge cases.
- Wire event publication for key lifecycle events and add contract tests for event consumers.

---

## EMR DOMAIN — Implementation Notes

A lightweight EMR (Electronic Medical Record) domain skeleton is implemented at `apps/api/src/modules/emr` to model `Encounter` lifecycle and quick integration testing. The implementation focuses on a minimal `Encounter` aggregate containing `Diagnosis`, `Medication`, and `Observation` value objects.

Implementation details:
- Domain: `Encounter` aggregate (`encounter.entity.ts`) and value objects: `DiagnosisVO`, `MedicationVO`, `ObservationVO`.
- Infrastructure: `InMemoryEncounterRepository` for local testing and experimentation.
- Application: `CreateEncounterCommand`/`GetEncounterQuery` and handlers for simple persistence and safe projections.
- Framework wiring: `EMRModule` and `EncounterController` expose `POST /emr/encounters` and `GET /emr/encounters/:id`.

Competing-Team Critique (EMR)

- Weakness: The EMR model is intentionally narrow (encounters only) and lacks longitudinal patient records, problem lists, care plans, allergies, and structured templates.
  - Alternative: Expand domain to include `ProblemList`, `Allergy`, `CarePlan`, and `ClinicalNote` aggregates; use composition and references rather than a single monolithic `Encounter`.

- Weakness: In-memory storage and controller-instantiated handlers limit auditability and persistence guarantees.
  - Alternative: Use a normalized relational model (Postgres) with versioned clinical documents (FHIR-like resources), append-only audit logs, and provider-scoped access controls.

- Weakness: No support for clinical terminologies (SNOMED, LOINC, ICD) and code validation, risking inconsistent coding.
  - Alternative: Introduce a terminology service or static code validation layer; enforce codes at the boundary and store codified references in domain objects.

- Weakness: No consent, provenance, or data retention controls implemented; crucial for compliance.
  - Alternative: Add `Provenance` metadata on clinical records, consent checks on read access, and configurable retention policies per tenant and record type.

- Weakness: No structured versioning for clinical records; updates overwrite state without historical versioning.
  - Alternative: Implement versioned clinical documents or event-sourced encounter histories so changes are auditable and reversible.

Next steps (recommended):
- Model additional clinical aggregates (ProblemList, Allergy, CarePlan) and align with FHIR resource shapes for interoperability.
- Replace `InMemoryEncounterRepository` with a persistent store and implement versioning and audit logs.
- Add terminology validation, provenance metadata, consent checks, and comprehensive testing for clinical edge cases.



---

## 8) QUEUE DOMAIN

### Purpose
Manage waiting queues, check-in/check-out, patient flow.

### Bounded Context
**Domain**: Patient Queue & Flow Management

### Aggregates

#### 8.1) PatientQueue Aggregate

**Aggregate Root**: `PatientQueue`

**Entities**:
- `PatientQueue` (root): Queue for provider/clinic
  - Properties: queueId (UUID), providerId (FK), clinicId (FK), date, status (open, paused, closed), currentNumber, nextNumber
  - Methods: `CheckInPatient(patientId, appointmentId)`, `CallNextPatient()`, `PauseQueue()`, `ResumeQueue()`, `GetWaitTime(position)`, `ReorderQueue()`

- `QueueEntry`: Patient in queue
  - Properties: entryId (UUID), queueId (FK), patientId (FK), appointmentId (FK), entryNumber (ticket number), checkInTime, callTime (when provider called), seeTime (when patient reached provider), status (waiting, called, in-service, served, no-show)
  - Methods: `CallPatient()`, `StartService()`, `CompleteService()`, `NoShow()`, `GetWaitTime()`

**Value Objects**:
- `QueuePosition`: Patient's position in queue
  - Properties: position (1, 2, 3, ...), entryTime, estimatedCallTime
  - Methods: `CalculateWaitTime()`

- `QueueStatus`: Queue state
  - Properties: status (open, paused, closed), reason (if paused)
  - Methods: `CanAcceptNewEntries()`

- `TicketNumber`: Numerical ticket issued at check-in
  - Properties: number, prefix (e.g., "A", "B" for multiple queues), displayNumber (what shows on screen)
  - Methods: `Format()`, `Next()`

**Domain Events**:
- `PatientCheckedIn`: Patient checked in
- `PatientCalledFromQueue`: Patient's name called
- `PatientStartedService`: Patient reached provider
- `PatientServiceCompleted`: Service finished, patient leaves queue
- `PatientNoShow`: Patient didn't show up when called
- `QueuePaused`: Queue paused
- `QueueResumed`: Queue resumed
- `QueueStatusUpdated`: Queue status changed
- `AverageWaitTimeExceeded`: Wait time exceeds threshold (e.g., > 30 min)

### Competing-team Critique

**Weakness 1**: Queue tied to provider; what about clinic-wide queues?
- **Alternative**: Support both provider-specific and clinic-wide queues

**Weakness 2**: No prioritization; first-come-first-served only
- **Alternative**: Add priority levels (urgent, priority, standard); reorder queue based on priority

---

## 9) BILLING DOMAIN

### Purpose
Manage pricing, invoicing, payment processing, accounts receivable.

### Bounded Context
**Domain**: Financial & Billing Management

### Aggregates

#### 9.1) Invoice Aggregate

**Aggregate Root**: `Invoice`

**Entities**:
- `Invoice` (root): Bill for services
  - Properties: invoiceId (UUID), patientId (FK), clinicId (FK), invoiceNumber (unique per clinic), invoiceDate, dueDate, status (draft, issued, partial-paid, paid, overdue, cancelled), totalAmount, paidAmount, discountAmount, taxAmount, notes
  - Methods: `AddLineItem()`, `ApplyDiscount()`, `RecordPayment()`, `Cancel()`, `SendReminder()`, `MarkOverdue()`

- `LineItem`: Individual service/charge on invoice
  - Properties: itemId (UUID), invoiceId (FK), description (consultation, medication, procedure), quantity, unitPrice, discountAmount, taxAmount, subtotal
  - Methods: `CalculateTotal()`

- `Payment`: Payment towards invoice
  - Properties: paymentId (UUID), invoiceId (FK), amount, paymentMethod (cash, card, bank-transfer), paymentDate, reference (receipt number, transaction ID), createdAt
  - Methods: `Verify()`, `Refund()`

**Value Objects**:
- `ServiceCharge`: Price for service
  - Properties: serviceId (UUID), description, amount, taxRate, currency (SYP, USD)
  - Methods: `CalculateTax()`

- `Discount`: Discount applied to invoice
  - Properties: type (percentage, fixed-amount), value, reason (loyalty, insurance, write-off, etc.), approvedBy (userId), notes
  - Methods: `CalculateAmount(baseAmount)`

- `PaymentMethod`: How payment made
  - Properties: type (cash, credit-card, debit-card, bank-transfer, insurance, check), details (if applicable, last 4 digits of card)
  - Methods: `IsCash()`, `RequiresVerification()`

- `InvoiceStatus`: Current status of invoice
  - Properties: status (draft, issued, partial-paid, paid, overdue, cancelled), lastUpdatedAt
  - Methods: `CanAddLineItems()`, `CanCancelInvoice()`

#### 9.2) Pricing Aggregate

**Aggregate Root**: `PricingPlan`

**Entities**:
- `PricingPlan` (root): Clinic's service pricing
  - Properties: planId (UUID), clinicId (FK), name, effectiveDate, expiryDate (if temp), notes
  - Methods: `UpdatePrice()`, `AddService()`, `RemoveService()`, `GetPrice(serviceId, modifiers)`

- `ServicePrice`: Price for specific service
  - Properties: priceId (UUID), planId (FK), serviceId (UUID), providerId (optional, if provider-specific), basePrice, currency
  - Methods: `GetPrice()`, `HasProviderVariation()`

- `PriceModifier`: Adjustment to base price
  - Properties: modifierId (UUID), priceId (FK), type (percentage, fixed-amount), reason (quantity-discount, patient-type, package-deal), value
  - Methods: `Apply(basePrice)`

**Value Objects**:
- `Money`: Amount with currency
  - Properties: amount (decimal), currency (SYP, USD), taxRate
  - Methods: `Add(other)`, `Subtract(other)`, `ConvertTo(targetCurrency)`

- `PriceList`: Collection of service prices
  - Properties: prices (map of serviceId → price), effectiveDate, version
  - Methods: `GetPrice(serviceId)`, `IsEffectiveOn(date)`

**Domain Events**:
- `InvoiceCreated`: Invoice generated for services
- `LineItemAdded`: Service added to invoice
- `DiscountApplied`: Discount applied to invoice
- `PaymentRecorded`: Payment received
- `InvoicePaid`: Invoice fully paid
- `InvoiceOverdue`: Invoice not paid by due date
- `InvoiceCancelled`: Invoice cancelled
- `PriceUpdated`: Service price changed

### Implementation gap and review findings

The current Billing implementation is a strong first pass, but it exposes several practical weaknesses that should be corrected before production use:

- The live implementation models `Invoice` and `LineItem` but omits a first-class `Payment` entity or explicit receipt/tracking model. That makes refund, reconciliation, and audit scenarios harder to evolve.
- The invoice status workflow was inconsistent: the domain allowed `partial_paid` invoices to be cancellable in status rules, but the aggregate rejected cancellation once any payment existed. This invariant mismatch has been corrected to enforce clear lifecycle semantics.
- There is no durable event bus in place; events are currently published through an in-memory console publisher. For financial domain correctness, invoice events must be emitted through a reliable message channel with delivery guarantees and retry semantics.
- Tenant identity is resolved from request headers; this is acceptable for dev/test but not safe for production without a trusted gateway or authenticated tenant claims. Tenant resolution should be moved to signed tokens or gateway-provided context.
- List and query behavior is currently in-memory without pagination, sorting, or search support. A production billing service must support invoice search, paging, and indexed queries on tenant, patient, branch, status, and invoice number.
- The API returns the aggregate directly; adding a computed `amountDue` field improves UX and avoids clients having to calculate outstanding balances themselves.

**Recommendation**: model payments explicitly, tighten status transition invariants, add `amountDue` to DTO/projection, and move durable event handling into a real event bus.

### Competing-team Critique

**Weakness 1**: Invoice heavily used; might benefit from separate Payment aggregate
- **Alternative**: Separate Payment aggregate; Invoice references payments

**Weakness 2**: Multi-currency (SYP, USD) complex; may introduce bugs
- **Alternative**: Single currency per clinic; currency stored at clinic level, not invoice level

---

## 10) INVENTORY DOMAIN

### Purpose
Track medications, supplies, equipment inventory levels.

### Bounded Context
**Domain**: Inventory Management

### Aggregates

#### 10.1) InventoryItem Aggregate

**Aggregate Root**: `InventoryItem`

**Entities**:
- `InventoryItem` (root): Individual inventory item (medication, supply)
  - Properties: itemId (UUID), clinicId (FK), name, sku, category, supplierId (FK), quantityOnHand, reorderLevel, reorderQuantity, unitCost, expiryDate, lastCountDate, status (active, discontinued, obsolete)
  - Methods: `AddStock(quantity)`, `RemoveStock(quantity, reason)`, `CheckExpiryDate()`, `ReorderIfNeeded()`, `UpdateUnitCost()`, `Deactivate()`

- `StockMovement`: Record of stock addition/removal
  - Properties: movementId (UUID), itemId (FK), type (purchase, usage, damage, loss, return, adjustment), quantity, reason, reference (PO number, patient ID), timestamp, createdBy
  - Methods: `Reverse()` (undo movement if erroneous)

- `ExpiryTracker`: Track items nearing/past expiry
  - Properties: trackerId (UUID), itemId (FK), expiryDate, quantityAtRisk, status (active, expired, disposed)
  - Methods: `DaysUntilExpiry()`, `IsExpired()`, `RequiresAction()`

**Value Objects**:
- `StockLevel`: Quantity information
  - Properties: quantityOnHand, reorderLevel, reorderQuantity, safetyStock (buffer)
  - Methods: `IsLow()`, `IsVeryLow()`, `SuggestOrderQuantity()`

- `ItemCategory`: Inventory item classification
  - Properties: category (medication, supply, equipment, vaccine, etc.), subcategory
  - Methods: `RequiresTemperatureControl()`

- `ExpiryDate`: Expiration date with alerts
  - Properties: expiryDate, daysUntilExpiry, alertThreshold (alert 30 days before expiry)
  - Methods: `IsExpired()`, `DaysRemaining()`, `RequiresAction()`

#### 10.2) Supplier Aggregate

**Aggregate Root**: `Supplier`

**Entities**:
- `Supplier` (root): Vendor/supplier information
  - Properties: supplierId (UUID), clinicId (FK), name, contact, leadTime (days), paymentTerms, isActive
  - Methods: `UpdateContact()`, `DeactivateSupplier()`

**Value Objects**:
- `LeadTime`: Days to deliver from order date
  - Properties: days (typically 3–7)
  - Methods: `CalculateOrderDate(neededDate)`

- `PaymentTerms`: Supplier payment terms
  - Properties: terms (cash, net-30, net-60), discount (if paid early)
  - Methods: `CalculateDueDate(invoiceDate)`

**Domain Events**:
- `InventoryItemCreated`: New item added to inventory
- `StockAdded`: Stock received/added
- `StockRemoved`: Stock used/removed
- `LowStockAlert`: Quantity below reorder level
- `ExpiryAlert`: Item expiring soon
- `ItemExpired`: Item past expiry date
- `ReorderNeeded`: Automatic reorder triggered
- `SupplierUpdated`: Supplier info changed

### Competing-team Critique

**Weakness 1**: ExpiryTracker separate entity; could be field in InventoryItem
- **Alternative**: Keep expiryDate as simple field; move tracking logic to application layer

**Weakness 2**: No batches/lot tracking (important for recalls)
- **Alternative**: Add Batch entity; track which batch used for which patient

---

## 11) WAREHOUSE DOMAIN

### Purpose
Manage central warehouse (if clinic has one), stock transfers between clinics.

### Bounded Context
**Domain**: Warehouse & Logistics

### Aggregates

#### 11.1) StockTransfer Aggregate

**Aggregate Root**: `StockTransfer`

**Entities**:
- `StockTransfer` (root): Transfer of inventory between locations
  - Properties: transferId (UUID), fromClinicId (FK), toClinicId (FK), transferDate, expectedDeliveryDate, actualDeliveryDate, status (pending, in-transit, delivered, cancelled), notes
  - Methods: `AddLineItem()`, `Ship()`, `Receive()`, `Cancel()`, `TrackStatus()`

- `TransferLineItem`: Item being transferred
  - Properties: itemId (UUID), transferId (FK), inventoryItemId (FK), quantity, receivedQuantity, notes
  - Methods: `Receive(quantity)`, `ConfirmReceipt()`

**Value Objects**:
- `TransferStatus`: Status of transfer
  - Properties: status (pending, in-transit, delivered, cancelled), lastUpdatedAt
  - Methods: `CanCancel()`

- `Location`: Physical location (clinic or warehouse)
  - Properties: locationId (UUID), name, address, type (clinic, warehouse), contact
  - Methods: `GetCapacity()`

**Domain Events**:
- `StockTransferCreated`: Transfer initiated
- `StockTransferShipped`: Transfer sent from origin
- `StockTransferInTransit`: Transfer in transit
- `StockTransferReceived`: Transfer received at destination
- `TransferLineItemReceived`: Individual item received and verified
- `StockTransferCancelled`: Transfer cancelled

### Competing-team Critique

**Weakness 1**: Warehouse domain may not be needed early; add later
- **Alternative**: Start without warehouse; add when multi-clinic transfers needed

---

## 12) COMMISSIONS DOMAIN

### Purpose
Calculate provider commissions based on services provided, revenue generated.

### Bounded Context
**Domain**: Provider Compensation & Commissions

### Aggregates

#### 12.1) Commission Aggregate

**Aggregate Root**: `CommissionCalculation`

**Entities**:
- `CommissionCalculation` (root): Monthly/period commission calculation
  - Properties: calcId (UUID), providerId (FK), clinicId (FK), periodStart, periodEnd, status (draft, calculated, approved, paid), totalRevenue, commissionAmount, createdAt
  - Methods: `CalculateCommission()`, `Approve()`, `GeneratePayment()`, `Dispute()`

- `CommissionLineItem`: Individual service contributing to commission
  - Properties: itemId (UUID), calcId (FK), appointmentId (FK), serviceDescription, amount, commissionRate, commissionAmount, date
  - Methods: `Recalculate(newRate)`

- `CommissionRule`: Rule defining how commission calculated
  - Properties: ruleId (UUID), clinicId (FK), providerId (FK), serviceType, commissionRate (percentage or fixed), minimumAmount (threshold), effectiveDate, expiryDate
  - Methods: `AppliesTo(serviceType)`, `CalculateCommission(amount)`

**Value Objects**:
- `CommissionRate`: Commission percentage or fixed amount
  - Properties: type (percentage, fixed-amount), value, minimumThreshold (don't pay if below), maximumCap (don't pay if above)
  - Methods: `CalculateAmount(baseAmount)`

- `CommissionStatus`: Status of commission calculation
  - Properties: status (draft, calculated, approved, paid, disputed), reason (if disputed)
  - Methods: `CanModify()`

**Domain Events**:
- `CommissionCalculated`: Commission calculated for period
- `CommissionApproved`: Commission approved by manager
- `CommissionPaid`: Payment issued to provider
- `CommissionRateUpdated`: Commission rate changed
- `CommissionDisputed`: Provider disputes calculation

### Competing-team Critique

**Weakness 1**: Commission tightly tied to invoice/payment; should it be separate?
- **Alternative**: Keep separate; commission calculation independent of billing

**Weakness 2**: No support for complex commission structures (tiered, bonuses)
- **Alternative**: Add CommissionBonus entity (e.g., bonus if > 50 appointments)

**Weakness 3**: `CommissionRule` is described in the domain model but not implemented in code, creating a gap between design and execution.
- **Alternative**: Implement `CommissionRule` as a first-class domain service or aggregate so rate logic is centralized, versioned, and auditable.

**Weakness 4**: Payment lifecycle metadata is currently only emitted via events and not persisted in the commission aggregate.
- **Alternative**: Store payment metadata (`paymentMethod`, `paymentReference`, `paymentDate`) in `CommissionCalculation` so the aggregate fully models the commission payout lifecycle.

**Weakness 5**: Tenant isolation is header-driven rather than authenticated principal driven, which risks spoofing.
- **Alternative**: Resolve tenant from authenticated claims and enforce tenant ownership at the repository boundary.

---

## 13) LOYALTY DOMAIN

### Purpose
Manage patient loyalty program (points, tiers, rewards).

### Bounded Context
**Domain**: Patient Loyalty & Rewards

### Aggregates

#### 13.1) LoyaltyAccount Aggregate

**Aggregate Root**: `LoyaltyAccount`

**Entities**:
- `LoyaltyAccount` (root): Patient's loyalty account
  - Properties: accountId (UUID), patientId (FK), clinicId (FK), pointsBalance, tier (Bronze, Silver, Gold), enrollmentDate, lastActivityDate, isActive
  - Methods: `EarnPoints()`, `RedeemPoints()`, `UpdateTier()`, `GetRewards()`, `Suspend()`, `Reactivate()`

- `LoyaltyTransaction`: Points addition/subtraction
  - Properties: transactionId (UUID), accountId (FK), type (earn, redeem, expire, adjust), pointsAmount, reference (appointmentId, redemption ID), transactionDate
  - Methods: `Reverse()`

- `LoyaltyTier`: Membership tier
  - Properties: tierId (UUID), name (Bronze, Silver, Gold), minPoints, maxPoints, benefits (discount %, priority booking, etc.), annualFee (if applicable)
  - Methods: `HasBenefit(benefit)`, `GetDiscount()`

- `LoyaltyReward`: Redeemable reward
  - Properties: rewardId (UUID), accountId (FK), pointsRequiredToRedeem, discountOrItem (discount code or product), expiryDate, status (available, expired, redeemed), redeemedDate
  - Methods: `Redeem()`, `IsExpired()`, `CanRedeem(currentPoints)`

**Value Objects**:
- `LoyaltyPoints`: Points balance
  - Properties: balance, currencyUnit (1 point = currency), expiryPolicy (expire after 1 year of inactivity)
  - Methods: `Add(points)`, `Subtract(points)`, `CalculateExpiredPoints()`

- `Tier`: Membership tier level
  - Properties: tier (Bronze, Silver, Gold), pointsRequired, benefits (discount %, early access, priority)
  - Methods: `QualifiesFor(pointsBalance)`, `GetBenefit()`

**Domain Events**:
- `LoyaltyAccountCreated`: Patient enrolled in loyalty program
- `PointsEarned`: Points added (via appointment, referral, purchase)
- `PointsRedeemed`: Points used for reward
- `PointsExpired`: Points expired due to inactivity
- `TierUpgraded`: Patient advanced to higher tier
- `TierDowngraded`: Patient dropped to lower tier
- `RewardRedeemed`: Reward redeemed by patient

### Competing-team Critique

**Weakness 1**: Loyalty program adds complexity; core clinic doesn't need it early
- **Alternative**: Launch without loyalty; add in Phase 2 if desired

**Weakness 2**: Points expiration policy harsh; customers frustrate if points expire
- **Alternative**: Extend expiration on any activity (no expiration if active)

---

## 14) SUBSCRIPTIONS DOMAIN

### Purpose
Manage patient subscription plans (membership, health packages).

### Bounded Context
**Domain**: Subscriptions & Patient Packages

### Aggregates

#### 14.1) SubscriptionPlan Aggregate

**Aggregate Root**: `SubscriptionPlan`

**Entities**:
- `SubscriptionPlan` (root): Subscription/membership plan offered
  - Properties: planId (UUID), clinicId (FK), name (Basic, Premium, VIP), monthlyPrice, includesServices (array), benefitsDescription, isActive, createdAt
  - Methods: `UpdatePrice()`, `UpdateIncludedServices()`, `Deactivate()`

- `SubscriptionBenefit`: Individual benefit in plan
  - Properties: benefitId (UUID), planId (FK), type (free-consultations, discounted-procedures, priority-booking, free-lab-tests), quantity (if applicable), value
  - Methods: `GetDescription()`

#### 14.2) PatientSubscription Aggregate

**Aggregate Root**: `PatientSubscription`

**Entities**:
- `PatientSubscription` (root): Patient's active subscription
  - Properties: subscriptionId (UUID), patientId (FK), planId (FK), clinicId (FK), startDate, endDate (if fixed-term), status (active, paused, cancelled, expired), monthlyPrice, nextBillingDate, cancellationDate
  - Methods: `UseBenefit()`, `RenewSubscription()`, `CancelSubscription()`, `UpdatePaymentMethod()`, `IsExpired()`

- `BenefitUsage`: Tracking usage of benefits
  - Properties: usageId (UUID), subscriptionId (FK), benefitId (FK), usedCount, quotaRemaining, resetDate (for monthly/yearly reset)
  - Methods: `UseBenefit()`, `IsExhausted()`, `ResetQuota()`

- `SubscriptionPayment`: Automatic recurring payment
  - Properties: paymentId (UUID), subscriptionId (FK), dueDate, status (pending, succeeded, failed), paymentMethod, transactionId, retryCount, notes
  - Methods: `Retry()`, `UpdatePaymentMethod()`

**Value Objects**:
- `SubscriptionStatus`: Current status of subscription
  - Properties: status (active, paused, cancelled, expired), reason (if cancelled)
  - Methods: `IsActive()`, `CanUseServices()`

- `BenefitQuota`: Quota for benefit usage
  - Properties: type (monthly, annual, unlimited), limit (if not unlimited), used, resetDate
  - Methods: `CanUse()`, `Use()`, `Reset()`

**Domain Events**:
- `SubscriptionPlanCreated`: New subscription plan created
- `SubscriptionActivated`: Patient subscribed to plan
- `SubscriptionRenewed`: Subscription renewed for another period
- `SubscriptionCancelled`: Subscription cancelled by patient
- `BenefitUsed`: Patient used a subscription benefit
- `BenefitQuotaExhausted`: Patient used all quota for benefit
- `PaymentProcessed`: Automatic payment charged
- `PaymentFailed`: Subscription payment failed (retry needed)
- `SubscriptionExpired`: Subscription term ended

### Competing-team Critique

**Weakness 1**: Subscriptions complex; may not align with clinic business model
- **Alternative**: Skip subscriptions initially; focus on pay-per-service

---

## 15) NOTIFICATIONS DOMAIN

### Purpose
Manage in-app notifications, SMS, email, messaging.

### Bounded Context
**Domain**: Notifications & Communications

### Aggregates

#### 15.1) Notification Aggregate

**Aggregate Root**: `Notification`

**Entities**:
- `Notification` (root): Single notification to user/patient
  - Properties: notificationId (UUID), recipientId (userId or patientId), type (in-app, email, SMS, push), title, body, priority (low, medium, high, critical), status (sent, delivered, read, failed), createdAt, sentAt, deliveredAt, readAt
  - Methods: `Send()`, `Retry()`, `MarkAsRead()`, `Delete()`

- `NotificationTemplate`: Template for notifications
  - Properties: templateId (UUID), clinicId (FK), type (appointment-reminder, prescription-ready, payment-receipt, alert), subject, body, placeholders ({{patientName}}, {{appointmentTime}}, etc.)
  - Methods: `Render(data)` (fill placeholders), `Update()`, `Deactivate()`

- `NotificationPreference`: User/patient notification preferences
  - Properties: preferenceId (UUID), userId (or patientId), channels (in-app, email, SMS, push), optInCategories (appointments, payments, promotions), optOutCategories, quietHours (e.g., no SMS 9 PM–9 AM)
  - Methods: `SetPreference(channel, category, enabled)`, `IsOptedIn(channel, category)`, `IsInQuietHours()`

**Value Objects**:
- `NotificationChannel`: Delivery channel
  - Properties: channel (in-app, email, SMS, push, whatsapp), enabled, failoverChannel (SMS if email fails)
  - Methods: `GetPriority()`

- `NotificationStatus`: Delivery status
  - Properties: status (queued, sent, delivered, failed, read), failureReason (if failed), retryCount
  - Methods: `CanRetry()`

**Domain Events**:
- `NotificationCreated`: Notification created
- `NotificationSent`: Notification sent
- `NotificationDelivered`: Notification delivered to recipient
- `NotificationFailed`: Delivery failed
- `NotificationRead`: User read notification
- `PreferenceUpdated`: Notification preference changed

### Competing-team Critique

**Weakness 1**: Notification domain may not need separate aggregate; could be service
- **Alternative**: Implement as notification service (application layer); not DDD aggregate

**Weakness 2**: Complex retry/failure logic; separate Delivery aggregate?
- **Alternative**: Yes, separate Delivery aggregate for delivery tracking

**Weakness 3**: Current API implementation is intentionally scoped to core notification CRUD and read status events, not the full template/preference/opt-in ecosystem described here.
- **Alternative**: Keep the first release as an in-app notification service and defer templates/preferences until notification channel delivery and opt-in semantics are clearly defined.

**Weakness 4**: Authorization depends on request-scoped header/user context and must enforce notification ownership explicitly.
- **Alternative**: Use dedicated authorization guards that validate tenant ownership, recipient ownership, and notification entity access before returning any data.

**Weakness 5**: Testing coverage is missing request-level guard and policy scenarios for tenant isolation and patient ownership.

---

## 16) REPORTING DOMAIN

### Purpose
Generate, manage, and deliver business/clinical reports (appointment summaries, revenue analysis, compliance reports, patient statistics).

### Bounded Context
**Domain**: Business Intelligence & Analytics

### Aggregates

#### 16.1) Report Aggregate

**Aggregate Root**: `Report`

**Entities**:
- `Report` (root): Single report request/generation
  - Properties: reportId (UUID), tenantId (FK), branchId (FK, nullable for multi-branch), createdBy (userId), name, type (appointment-report, revenue-report, patient-report, compliance-report), format (pdf, csv, excel), status (queued, generating, completed, failed), dateRange (start, end), parameters (filters, grouping), createdAt, updatedAt, completedAt, downloadUrl
  - Methods: `MarkGenerating()`, `MarkCompleted(downloadUrl)`, `MarkFailed()`, `GetStatus()`, `IsExpired()`

**Value Objects**:
- `ReportType`: Type of report being generated
  - Properties: type (appointment-report, revenue-report, patient-report, compliance-report)
  - Methods: `GetDescription()`, `GetRequiredColumns()`

- `ReportFormat`: Output format
  - Properties: format (pdf, csv, excel)
  - Methods: `GetMimeType()`, `GetFileExtension()`

- `ReportStatus`: Current generation status
  - Properties: status (queued, generating, completed, failed)
  - Methods: `IsGeneratingOrLater()`, `IsTerminal()`

- `DateRange`: Time period for report data
  - Properties: start (ISO date), end (ISO date)
  - Methods: `ToJSON()`, `DurationInDays()`

- `ReportFilters`: Query parameters and filtering
  - Properties: tenantId, branchId, createdBy, type, status, startDate, endDate
  - Methods: `IsValid()`

**Domain Events**:
- `ReportRequested`: Report requested by user
- `ReportGenerating`: Report generation started
- `ReportCompleted`: Report successfully generated (includes downloadUrl)
- `ReportFailed`: Report generation failed (includes reason)

### Implementation Notes — Reporting API Skeleton

- A minimal Reporting API has been implemented under `apps/api/src/modules/reporting` following DDD bounded context and CQRS patterns.

  - Domain: `Report` aggregate with `ReportType`, `ReportFormat`, `ReportStatus`, `DateRange` value objects and domain events (`ReportRequestedEvent`, `ReportCompletedEvent`, `ReportFailedEvent`).
  - Application: `RequestReportCommand`, `GetReportQuery`, `ListReportsQuery` with corresponding handlers (`RequestReportHandler`, `GetReportHandler`, `ListReportsHandler`).
  - Infrastructure: `InMemoryReportRepository` for development; filters by tenant, branch, creator, type, status, and date range.
  - Framework wiring: `ReportingModule`, `ReportingController` (POST /reporting/reports, GET /reporting/reports/:reportId, GET /reporting/reports), `ReportingPermissionGuard` for authorization, `ReportingPolicy` for role-based access.

### Competing-Team Critique (Reporting Implementation)

**Weakness 1**: In-memory repository blocks asynchronous generation and persistence across server restarts.
- **Alternative**: Implement a database-backed repository (Prisma/TypeORM) with job queue support (Bull, Temporal, or Kubernetes jobs) for long-running report generation. Store generated report artifacts in S3 or object storage with expiration policies.

**Weakness 2**: Report generation is stubbed (`RequestReportCommand` creates entity but does not actually generate output); no generator service or template system exists.
- **Alternative**: Create a `ReportGeneratorService` interface with implementations for each report type (AppointmentReportGenerator, RevenueReportGenerator, etc.). Use templating engines (Handlebars, Liquid) or dedicated library (PuppeteerJS for PDF, xlsx for Excel) to render reports.

**Weakness 3**: Authorization is coarse (admin/tenant_admin/manager/auditor); lacks fine-grained control over report types or data visibility by role/permission.
- **Alternative**: Extend `ReportingPolicy` with method-level authorization checks (e.g., `CanRequestRevenueReport()`, `CanViewComplianceReport()`) and add Attribute-Based Access Control (ABAC) rules (e.g., only managers can request revenue reports for their branch).

**Weakness 4**: No pagination or result limiting on `ListReportsQuery`; potential performance issue for tenants with many reports.
- **Alternative**: Add pagination parameters (limit, offset) to `ListReportsQuery` and implement cursor-based pagination in the repository; add sorting (by createdAt, status, name) and filtering (by date range, creator, status).

**Weakness 5**: Report artifacts (downloadUrl, PDF files) are not managed; no lifecycle policy for deletion, archival, or retention.
- **Alternative**: Implement report artifact storage with configurable TTL (e.g., keep for 30 days, then delete). Provide an archive/export feature for compliance and audit purposes.

**Weakness 6**: No error handling or retry logic for failed report generation; users see failed status but no reason or ability to retry.
- **Alternative**: Add `failureReason` to `Report` entity, implement automatic retry with exponential backoff for transient failures, and emit notifications to user when report completes or fails.

**Weakness 7**: Multi-tenant report data isolation is enforced via tenantId filter in repository but lacks database-level constraints or encryption at rest.
- **Alternative**: Use tenant-scoped database schemas or row-level security (RLS) policies; encrypt report artifacts per tenant with tenant-specific keys; validate tenant context in guard and handler.

**Weakness 8**: Testing coverage lacks unit tests for handlers, guard, and policy; no integration tests for end-to-end report request/generation flow.
- **Alternative**: Add unit tests for `RequestReportHandler`, `GetReportHandler`, `ListReportsHandler` (mock repository); add integration tests for `ReportingPermissionGuard` (verify tenant isolation, role-based access); add E2E tests for POST/GET endpoints.

### Next Steps for Production Hardening

1. **Database Persistence**: Replace `InMemoryReportRepository` with Prisma-backed repository and migrations. Create indexes on (tenantId, branchId), (createdBy, createdAt), and (status).

2. **Report Generation**: Implement report generator service with pluggable implementations per report type. Integrate with templating library and export libraries (puppeteer, xlsx, csv).

3. **Job Queue**: Add Bull queue for asynchronous report generation. Implement job retry logic with exponential backoff and dead-letter queue for persistent failures.

4. **Artifact Storage**: Integrate with S3 or object storage for report artifacts. Implement lifecycle policy (auto-delete after 30 days) and signed URLs for secure download.

5. **Enhanced Authorization**: Add method-level authorization in policy; consider ABAC for data visibility by branch or role.

6. **Pagination & Performance**: Add pagination to `ListReportsQuery` and implement cursor-based queries in repository.

7. **Error Handling**: Add `failureReason` field, automatic retry logic, and notification emission on completion/failure.

8. **Testing**: Add unit tests for all handlers, guards, policies; add integration tests for end-to-end flow; add contract tests for domain events.

9. **Monitoring & Observability**: Add structured logging for report request/completion; emit metrics for generation time, success rate, storage usage.

10. **Documentation**: Update API OpenAPI spec with report endpoints; add user guide for requesting and downloading reports by role.

### Competing-Team Alternative Architectures

**Alternative 1**: Report generation as separate microservice
- **Rationale**: Decouples reporting from core API, allowing independent scaling and maintenance.
- **Tradeoff**: Adds operational complexity (service discovery, communication overhead); requires CQRS or event sourcing for data consistency.

**Alternative 2**: Push report requests to message queue; consume asynchronously
- **Rationale**: Non-blocking request handling; resilient to report generation delays.
- **Tradeoff**: Adds latency to request acknowledgment; requires job monitoring UI.

**Alternative 3**: Pre-generate and cache common reports; user requests pull from cache
- **Rationale**: Faster response times; reduced load on generation service.
- **Tradeoff**: Cache invalidation complexity; users see stale data; harder to support ad-hoc filters.
- **Alternative**: Add guard unit tests and end-to-end authorization tests for patient-scoped list/get/read operations as well as tenant-admin accesses.

**Weakness 6**: The current list endpoint has no pagination, unread filtering, or performance guardrails.
- **Alternative**: Add paging, cursor-based listing, and explicit unread-only semantics before exposing notifications in production.

---

## 16) AUDIT DOMAIN

### Purpose
Track all significant system activities for compliance and troubleshooting.

### Bounded Context
**Domain**: Audit Logging & Compliance

### Aggregates

#### 16.1) AuditLog Aggregate

**Aggregate Root**: `AuditLog`

**Entities**:
- `AuditLog` (root): Single audit entry
  - Properties: logId (UUID), userId (FK, who did the action), action (created, updated, deleted, accessed), entityType (patient, appointment, invoice), entityId (what was affected), timestamp, ipAddress, userAgent, changes (before/after values), reason (why, if applicable)
  - Methods: `GetChangeDetails()`, `IsModificationActivity()` (vs read-only access)

**Value Objects**:
- `AuditAction`: Type of action recorded
  - Properties: action (create, read, update, delete, approve, reject, export, print, archive)
  - Methods: `RequiresApproval()` (some actions need manager review)

- `AuditChange`: Before/after values of changed field
  - Properties: fieldName, oldValue, newValue
  - Methods: `IsSignificant()` (ignore insignificant changes like timestamps)

**Domain Events**:
- `AuditEventLogged`: Audit event recorded
- `SuspiciousActivityDetected`: Alert when unusual activity (e.g., bulk patient access by non-doctor)

### Competing-team Critique

**Weakness 1**: AuditLog aggregate too simple; should be event sourcing?
- **Alternative**: Implement event sourcing for full replay capability; more complex but better for compliance

**Weakness 2**: Audit logs grow indefinitely; storage expensive
- **Alternative**: Archive old logs to cold storage; keep recent logs online

---

## 17) ANALYTICS DOMAIN

### Purpose
Aggregate and analyze data for reporting, KPIs, business intelligence.

### Bounded Context
**Domain**: Analytics & Business Intelligence

### Aggregates

#### 17.1) AnalyticsMetric Aggregate

**Aggregate Root**: `Metric`

**Entities**:
- `Metric` (root): Single KPI or business metric
  - Properties: metricId (UUID), clinicId (FK), name (daily-revenue, patient-count, no-show-rate), type (counter, gauge, histogram), value, timestamp, dimension (optional, e.g., by provider, by service-type)
  - Methods: `Record()`, `GetTrend(dateRange)`, `Compare(otherMetric)`

- `MetricDefinition`: How metric calculated
  - Properties: defId (UUID), metricId (FK), formula (SQL query or calculation), refreshFrequency (daily, hourly, real-time), lastRefreshed
  - Methods: `Calculate()`, `Refresh()`

#### 17.2) Dashboard Aggregate

**Aggregate Root**: `Dashboard`

**Entities**:
- `Dashboard` (root): Custom dashboard view
  - Properties: dashboardId (UUID), clinicId (FK), name, owner (userId), layout, widgets (array of widget IDs), createdAt, updatedAt
  - Methods: `AddWidget()`, `RemoveWidget()`, `ReorderWidgets()`, `UpdateLayout()`

- `DashboardWidget`: Widget showing metric/chart
  - Properties: widgetId (UUID), dashboardId (FK), type (metric-card, chart, table, gauge), metricId (FK), chartType (if chart), position (x, y), size (width, height)
  - Methods: `GetData()`, `Refresh()`

**Domain Events**:
- `MetricRecorded`: Metric value recorded
- `DashboardCreated`: Dashboard created by user
- `WidgetAdded`: Widget added to dashboard
- `DashboardRefreshed`: Dashboard data refreshed

### Competing-team Critique

**Weakness 1**: Analytics aggregate may not be true domain; could be infrastructure
- **Alternative**: Move analytics to application/infrastructure layer; not core business logic

---

## 18) REPORTING DOMAIN

### Purpose
Generate reports (appointment reports, revenue reports, compliance reports).

### Bounded Context
**Domain**: Reporting & Data Export

### Aggregates

#### 18.1) Report Aggregate

**Aggregate Root**: `Report`

**Entities**:
- `Report` (root): Generated report
  - Properties: reportId (UUID), clinicId (FK), name, type (appointment-report, revenue-report, patient-report), dateRange, format (PDF, CSV, Excel), status (queued, generating, completed, failed), createdAt, completedAt, createdBy (userId), downloadUrl
  - Methods: `Generate()`, `Export()`, `Email()`, `Retry()`

- `ReportTemplate`: Template for recurring reports
  - Properties: templateId (UUID), clinicId (FK), name, type, description, defaultDateRange (daily, weekly, monthly), recipients (emails to send to automatically), schedule (daily, weekly, monthly), lastGenerated
  - Methods: `GenerateReport()`, `UpdateRecipients()`

**Domain Events**:
- `ReportRequested`: User requested report generation
- `ReportGenerated`: Report generated
- `ReportFailed`: Report generation failed
- `ReportScheduled`: Recurring report scheduled
- `ScheduledReportGenerated`: Recurring report auto-generated

### Competing-team Critique

**Weakness 1**: Report aggregate too heavy; could be separate application service
- **Alternative**: Implement as async job; Report just stores result

---

## 19) AI DOMAIN

### Purpose
Manage AI/ML models, predictions, recommendations.

### Bounded Context
**Domain**: Artificial Intelligence & Machine Learning

### Aggregates

#### 19.1) AIPrediction Aggregate

**Aggregate Root**: `Prediction`

**Entities**:
- `Prediction` (root): Single AI prediction
  - Properties: predictionId (UUID), modelId (FK), inputData (patient/appointment data), prediction (result), confidence (0–1), timestamp, entityId (patient or appointment this prediction is for)
  - Methods: `GetRecommendation()`, `GetConfidenceLevel()`, `RecordFeedback()`

- `AIModel`: Trained ML model
  - Properties: modelId (UUID), name (no-show-predictor, churn-predictor), version, trainingDate, accuracy (on test set), retrain Frequency, isActive
  - Methods: `MakePrediction(input)`, `Retrain()`, `Deprecate()`

- `ModelFeedback`: User feedback on prediction accuracy
  - Properties: feedbackId (UUID), predictionId (FK), feedbackType (correct, incorrect, partially-correct, unsure), explanation (optional), timestamp
  - Methods: `RecordFeedback()`

**Value Objects**:
- `Confidence`: Confidence score of prediction
  - Properties: score (0–1), category (low, medium, high, very-high)
  - Methods: `IsHighConfidence()`

**Domain Events**:
- `PredictionMade`: AI made prediction
- `PredictionAccuracyImproved`: Model retrained, accuracy improved
- `PredictionFeedbackRecorded`: User feedback on prediction recorded
- `ModelRetrained`: ML model retrained with new data

### Competing-team Critique

**Weakness 1**: AI domain may not be ready for Phase 1; add later
- **Alternative**: Implement AI as separate service; integrate later

---

## 20) WORKFLOW DOMAIN

### Purpose
Define and execute business workflows (multi-step approval processes).

### Bounded Context
**Domain**: Business Process Workflows

### Aggregates

#### 20.1) Workflow Aggregate

**Aggregate Root**: `Workflow`

**Entities**:
- `Workflow` (root): Business process definition
  - Properties: workflowId (UUID), clinicId (FK), name (appointment-approval, referral-approval), triggerType (appointment-created, prescription, referral), steps (array), isActive
  - Methods: `UpdateSteps()`, `Deactivate()`

- `WorkflowStep`: Individual step in workflow
  - Properties: stepId (UUID), workflowId (FK), stepNumber, action (send-notification, request-approval, check-condition), actor (role required to perform, e.g., manager, doctor), dueDate (optional), condition (optional, if-then logic), nextStep (on success/failure)
  - Methods: `Execute()`, `Skip()`, `Approve()`, `Reject(reason)`

#### 20.2) WorkflowExecution Aggregate

**Aggregate Root**: `WorkflowExecution`

**Entities**:
- `WorkflowExecution` (root): Instance of workflow in progress
  - Properties: executionId (UUID), workflowId (FK), entityType (appointment, referral, prescription), entityId (what entity triggered workflow), startDate, currentStep, status (in-progress, completed, failed, cancelled), completedDate
  - Methods: `ExecuteStep()`, `SkipStep()`, `Complete()`, `Fail(reason)`, `Cancel(reason)`

- `StepExecution`: Execution of individual step
  - Properties: stepExecId (UUID), executionId (FK), stepId (FK), startTime, completedTime, actor (userId who performed), action, outcome (success, failure, skipped), notes
  - Methods: `Complete()`, `Skip()`

**Domain Events**:
- `WorkflowStarted`: Workflow triggered for entity
- `WorkflowStepCompleted`: Step completed
- `WorkflowApprovalRequested`: Approval requested from actor
- `WorkflowApproved`: Approval granted
- `WorkflowRejected`: Approval rejected
- `WorkflowCompleted`: Workflow finished
- `WorkflowFailed`: Workflow failed (couldn't complete)

### Competing-team Critique

**Weakness 1**: Workflow domain complex; may not need separate aggregate
- **Alternative**: Use workflow engine (Camunda, Temporal); don't implement in DDD

---

## 21) APPROVALS DOMAIN

### Purpose
Manage approval workflows for high-value or sensitive operations.

### Bounded Context
**Domain**: Approval Management & Authorization

### Aggregates

#### 21.1) ApprovalRequest Aggregate

**Aggregate Root**: `ApprovalRequest`

**Entities**:
- `ApprovalRequest` (root): Request for approval
  - Properties: requestId (UUID), entityType (appointment, prescription, referral, invoice), entityId (what needs approval), requesterUserId (who requested), approverUserId (who approves), reason (why approval needed), status (pending, approved, rejected, cancelled), requestedDate, dueDate, respondedDate
  - Methods: `Approve()`, `Reject(reason)`, `Cancel()`, `Escalate(newApprover)`, `SendReminder()`

- `ApprovalRule`: Rule defining when approval required
  - Properties: ruleId (UUID), clinicId (FK), entityType, condition (e.g., amount > 1000 SYP), requiredApprover (role), approvalCount (1 or 2 approvals required)
  - Methods: `AppliesToEntity(entity)`, `GetRequiredApprovers()`

**Domain Events**:
- `ApprovalRequested`: Approval request created
- `ApprovalApproved`: Request approved
- `ApprovalRejected`: Request rejected
- `ApprovalEscalated`: Escalated to higher authority
- `ApprovalReminderSent`: Reminder to approver
- `ApprovalExpired`: Approval request expired

### Competing-team Critique

**Weakness 1**: Approvals separate from Workflow; overlapping
- **Alternative**: Use Workflow for complex multi-step approvals; ApprovalRequest for simple approve/reject

---

## 22) DOCUMENTS DOMAIN

### Purpose
Manage documents (encounter notes, prescriptions, lab reports, consent forms).

### Bounded Context
**Domain**: Document Management & Storage

### Aggregates

#### 22.1) Document Aggregate

**Aggregate Root**: `Document`

**Entities**:
- `Document` (root): Document file/record
  - Properties: documentId (UUID), clinicId (FK), type (encounter-note, prescription, lab-report, consent-form, imaging), title, description, ownerEntityType (patient, appointment, encounter), ownerEntityId, createdDate, createdBy (userId), updatedDate, updatedBy, status (draft, finalized, archived, deleted), accessLevel (private, internal, shared)
  - Methods: `Finalize()`, `Share(recipientId)`, `Archive()`, `Download()`, `Delete()`

- `DocumentVersion`: Document version history
  - Properties: versionId (UUID), documentId (FK), versionNumber, changedBy (userId), changedDate, changes (what changed), fileUrl (location of file)
  - Methods: `RestoreVersion()`

- `DocumentAccess`: Record of who accessed document
  - Properties: accessId (UUID), documentId (FK), accessedBy (userId), accessDate, accessType (read, download, print)
  - Methods: `LogAccess()`

- `DocumentSignature`: Digital signature
  - Properties: signatureId (UUID), documentId (FK), signedBy (userId), signatureDate, signatureMethod (digital-sig, SMS-OTP, manual-checkbox), certificateId (if digital signature)
  - Methods: `Verify()`, `IsValid()`

**Value Objects**:
- `DocumentType`: Type of document
  - Properties: type (encounter-note, prescription, lab-report, imaging, consent-form, invoice, referral-letter), template (optional, for generation)
  - Methods: `RequiresSignature()`, `IsPatientFacingDocument()`

- `DocumentStatus`: Document lifecycle status
  - Properties: status (draft, finalized, signed, archived, deleted), lastModified
  - Methods: `CanEdit()`, `CanDelete()`

**Domain Events**:
- `DocumentCreated`: Document created
- `DocumentFinalized`: Document locked/finalized
- `DocumentSigned`: Document digitally signed
- `DocumentShared`: Document shared with recipient
- `DocumentAccessed`: Access to document logged
- `DocumentArchived`: Document archived
- `DocumentDeleted`: Document deleted (or marked for deletion)

### Competing-team Critique

**Weakness 1**: Documents heavily tied to external storage (S3, etc.); not all DDD
- **Alternative**: Document stores reference only (URL); content stored separately

**Weakness 2**: Document aggregate may be too detailed; document service simpler
- **Alternative**: Simplify to just metadata; content management as separate service

---

## Context Map: Bounded Context Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│                         IDENTITY DOMAIN                          │
│ (User, Role, Session) ← All other domains depend on this        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  PATIENTS        │  │  EMR             │  │  SCHEDULING      │
│  (Patient, ID)   │→→│  (Encounter,     │→→│  (ProviderSched, │
│                  │  │   Medication)    │  │   AppointmentSlot)
└──────────────────┘  └──────────────────┘  └──────────────────┘
      ↓                      ↓                      ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ DENTAL           │  │ BEAUTY           │  │ MEDICAL          │
│ (DentalEncounter)│  │ (BeautyService)  │  │ (ChronicDisease) │
└──────────────────┘  └──────────────────┘  └──────────────────┘
      ↓                      ↓                      ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ QUEUE            │  │ BILLING          │  │ INVENTORY        │
│ (PatientQueue)   │→→│ (Invoice, Payment)  │ (InventoryItem)  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
      ↓                      ↓                      ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ WAREHOUSE        │  │ COMMISSIONS      │  │ LOYALTY          │
│ (StockTransfer)  │  │ (Commission)     │  │ (LoyaltyAccount) │
└──────────────────┘  └──────────────────┘  └──────────────────┘
      ↓                      ↓                      ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ SUBSCRIPTIONS    │  │ NOTIFICATIONS    │  │ AUDIT            │
│ (Subscription)   │  │ (Notification)   │  │ (AuditLog)       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
      ↓                      ↓                      ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ ANALYTICS        │  │ REPORTING        │  │ AI               │
│ (Metric)         │→→│ (Report)         │→→│ (Prediction)     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
      ↓                      ↓
┌──────────────────┐  ┌──────────────────┐
│ WORKFLOW         │  │ APPROVALS        │
│ (Workflow)       │→→│ (ApprovalRequest)│
└──────────────────┘  └──────────────────┘
      ↓
┌──────────────────┐
│ DOCUMENTS        │
│ (Document)       │
└──────────────────┘
```

### Key Dependencies

1. **Identity → All**: Every operation requires authenticated user (from Identity)
2. **Patients → EMR, Scheduling, Billing, Loyalty**: Patient is central; other domains reference patient
3. **Scheduling → Queue, Billing**: Appointments lead to queue, then billing
4. **EMR → Inventory, Billing, Documents**: Clinical decisions drive inventory usage, billing, documentation
5. **Billing → Commissions, Subscriptions**: Payments drive commissions, subscriptions manage billing
6. **Notifications → All**: Notification service called by many domains (appointment created → send notification)
7. **Audit → All**: Audit logs all changes
8. **Analytics, Reporting, AI → All**: Read from other domains

---

## Overall Architecture Critique & Competing-Team Alternatives

### Weakness 1: Too Many Domains (22); Complexity High

**Current**: 22 separate bounded contexts
**Problem**: Microservices would require 22+ services; too complex for startup phase

**Alternatives**:
- **Option A (Monolith approach)**: Start with single monolith; 5–7 core modules (Identity, Patients, EMR, Scheduling, Billing, Inventory, Notifications). Add domains as separate modules later.
- **Option B (Hybrid)**: 3 services: Core Service (Identity, Patients, EMR, Scheduling), Billing Service (Billing, Invoicing, Payments), Analytics Service (Analytics, Reporting). Expand as needed.
- **Option C (Strict DDD)**: Keep 22 domains; implement in monolith initially with clear module boundaries; migrate to microservices post-launch.

**Recommendation**: Start with Option A (5–7 core modules in monolith). Add specialty domains (Dental, Beauty, Medical) and advanced domains (AI, Analytics) as separate modules in Phase 2–4.

### Weakness 2: Circular Dependencies (Some Domains Reference Others Circularly)

**Example**: Billing ← → Subscriptions (subscriptions generate billing, billing triggers subscription renewal)

**Alternatives**:
- **Event-driven**: Use domain events to decouple; Billing publishes `SubscriptionPaymentProcessed` event; Subscriptions listens
- **Shared kernel**: Create shared types (Money, Date) in common module; reduces coupling
- **Anti-corruption layer**: Translate between domains at boundary; reduces direct coupling

**Recommendation**: Use event-driven architecture; domain events decouple domains.

### Weakness 3: Some Aggregates Too Complex (e.g., Encounter)

**Current**: Encounter includes ClinicalNote, VitalSigns, AssessmentItem, all as entities

**Alternatives**:
- **Split aggregates**: ClinicalNote, VitalSigns as separate aggregates; Encounter references them
- **Keep combined**: If tightly coupled, keep as one aggregate; trade-off is larger aggregate

**Recommendation**: Split if independent access patterns (e.g., vital signs recorded separately from notes). Keep combined if always updated together.

### Weakness 4: No Support for Multi-Tenancy in Domain Model

**Current**: Each aggregate has `clinicId` field

**Alternatives**:
- **Tenant-aware architecture**: Embed tenant context in domain; all queries filtered by tenant automatically
- **Separate schemas**: Each tenant has separate database schema; more isolation but complex deployments
- **Row-level security**: Single schema/tables; all queries filtered by tenant ID (database level)

**Recommendation**: Implement tenant context in application layer; pass to domain as value object. Simple queries filtered by tenantId; more scalable than separate schemas.

---

## TENANT DOMAIN — Implementation Notes

A Tenant domain skeleton has been added at `apps/api/src/modules/tenant` to manage tenant lifecycle, settings, and domain-level isolation.

Implementation details:
- Domain: `Tenant` aggregate with `TenantSettingsVO` for timezone, locale, features, and data retention.
- Infrastructure: `InMemoryTenantRepository` for local testing.
- Application: `CreateTenantCommand`/`GetTenantQuery` handlers and DTOs.
- Framework wiring: `TenantModule` and `TenantController` expose `POST /tenants` and `GET /tenants/:id`.

Competing-Team Critique (Tenant)

- Weakness: Single in-memory repository cannot provide production-grade isolation or persistence; no tenant bootstrap automation or initial admin user creation.
  - Alternative: Implement tenant provisioning pipeline that creates tenant rows, runs DB migrations (schema-per-tenant or shared schema with tenant_id), creates admin user, and seeds test data.

- Weakness: No tenant-scoped configuration management or feature flagging beyond a simple `features` map.
  - Alternative: Integrate a feature flag service or expose a `TenantConfig` storage with audit and versioning to support staged feature rollouts per tenant.

- Weakness: No tenant authentication/authorization boundaries or RBAC mapping; risk of cross-tenant access if not enforced at DB/query level.
  - Alternative: Enforce tenant scoping at the DB layer (Row-Level Security or separate schemas) and add middleware that resolves tenant context from request (host header or token) and denies cross-tenant access.

- Weakness: No metering/billing hooks or usage accounting.
  - Alternative: Add event emission for tenant usage (API calls, user counts) to feed billing and analytics.

- Weakness: No tenant-level data residency or retention enforcement.
  - Alternative: Support tenant-level policies (region, retentionDays) and ensure backups, exports, and deletions follow the tenant policy.

Next steps (recommended):
- Implement a robust tenant provisioning workflow with migrations and admin seeding.
- Introduce DI tokens for tenant repository so production binding can use SQL-backed repository.
- Add tenant resolver middleware to attach tenant context to requests and enforce RBAC.
- Integrate event emission for tenant lifecycle events and usage metrics.



### Weakness 5: Document Domain Too Heavy; Could Be Simpler

**Current**: Document aggregate includes version history, access logging, signatures

**Alternatives**:
- **Simplify**: Document stores metadata only (ID, type, createdBy, createdDate, fileUrl); content stored in blob storage
- **Separate services**: Document service in infrastructure layer (not DDD aggregate)

**Recommendation**: Simplify to metadata only; move file storage to infrastructure layer.

---

## Implementation Roadmap

### Phase 1 (Months 1–3): Core Domains

- **Identity Domain**
- **Patients Domain**
- **EMR Domain** (minimal: Encounter, Medication)
- **Scheduling Domain**
- **Billing Domain** (minimal: Invoice, Payment)
- **Notifications Domain** (minimal: in-app notifications)
- **Audit Domain** (minimal: basic audit logging)

### Phase 2 (Months 4–6): Enhanced Domains

- **Inventory Domain**
- **Loyalty Domain**
- **Analytics Domain** (minimal: basic metrics)
- **Workflow Domain**
- **Subscriptions Domain**
- **Advanced EMR** (templates, decision support)

### Phase 3 (Months 7–9): Enterprise Domains

- **Commissions Domain**
- **Approvals Domain**
- **Documents Domain**
- **Reporting Domain** (advanced)
- **Warehouse Domain** (if multi-clinic)

### Phase 4 (Months 10+): Specialty & AI Domains

- **Dental Domain**
- **Beauty Domain**
- **Medical Domain** (advanced)
- **AI Domain**

---

## Next Steps

1. **Validate Domain Model**: Review with domain experts (clinicians, clinic managers)
2. **Define Context Boundaries**: Clarify what each domain owns (which tables, services)
3. **Plan Service Boundaries**: Map domains to services (monolith modules first, then microservices)
4. **Define Event Schema**: Design domain events for event-driven communication
5. **Plan Phased Implementation**: Prioritize Phase 1 domains; defer Phase 3–4

