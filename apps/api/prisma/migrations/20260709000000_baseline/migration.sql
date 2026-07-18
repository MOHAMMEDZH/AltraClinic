-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPER_ADMIN', 'OWNER', 'GENERAL_MANAGER', 'BRANCH_MANAGER', 'DOCTOR', 'DENTIST', 'SPECIALIST', 'NURSE', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'CASHIER', 'HR', 'MARKETING', 'PATIENT');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "waitlist_status" AS ENUM ('OPEN', 'SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "scheduling_resource_type" AS ENUM ('ROOM', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "credit_note_status" AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "cash_session_status" AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "payment_plan_status" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "commission_status" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "commission_rate_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "queue_ticket_status" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'SKIPPED', 'NO_SHOW', 'CANCELLED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "queue_priority" AS ENUM ('NORMAL', 'APPOINTMENT', 'WALK_IN', 'PRIORITY', 'VIP', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "platform_tenant_status" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "tenant_lifecycle_status" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "privileged_access_grant_status" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "portal_account_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "notification_category" AS ENUM ('SYSTEM', 'CLINICAL', 'OPERATIONAL', 'FINANCIAL', 'INVENTORY', 'SUBSCRIPTION', 'SECURITY');

-- CreateEnum
CREATE TYPE "ai_model_status" AS ENUM ('DRAFT', 'VALIDATED', 'DEPLOYED', 'RETIRED');

-- CreateEnum
CREATE TYPE "media_category" AS ENUM ('PATIENT_ATTACHMENT', 'MEDICAL_DOCUMENT', 'DENTAL_IMAGE', 'BEAUTY_BEFORE_AFTER', 'INVOICE_ATTACHMENT');

-- CreateEnum
CREATE TYPE "media_asset_status" AS ENUM ('PENDING_SCAN', 'PROCESSING', 'READY', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "virus_scan_status" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "beauty_comparison_role" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "workflow_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED', 'PAUSED');

-- CreateEnum
CREATE TYPE "workflow_template_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "workflow_task_status" AS ENUM ('DRAFT', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'OVERDUE', 'ESCALATED');

-- CreateEnum
CREATE TYPE "workflow_task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "workflow_approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "workflow_approval_mode" AS ENUM ('SINGLE', 'SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "entitlement_plan" AS ENUM ('LITE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "platform_region" AS ENUM ('ME_SOUTH', 'ME_NORTH', 'EU_WEST', 'US_EAST', 'GLOBAL');

-- CreateEnum
CREATE TYPE "outbox_event_status" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "loyalty_tier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "loyalty_transaction_type" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'ARCHIVED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "BranchAccessMode" AS ENUM ('SINGLE', 'MULTI', 'GLOBAL');

-- CreateEnum
CREATE TYPE "StaffInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "encounter_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'SIGNED');

-- CreateEnum
CREATE TYPE "clinical_note_type" AS ENUM ('SOAP', 'PROGRESS', 'CONSULTATION', 'PROCEDURE', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "odontogram_mode" AS ENUM ('ADULT', 'PEDIATRIC');

-- CreateEnum
CREATE TYPE "orthodontic_case_status" AS ENUM ('ACTIVE', 'RETENTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "implant_record_status" AS ENUM ('PLANNED', 'PLACED', 'RESTORED', 'FAILED');

-- CreateEnum
CREATE TYPE "TreatmentPlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TreatmentPlanItemStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "loyalty_reward_status" AS ENUM ('AVAILABLE', 'EXPIRED', 'REDEEMED');

-- CreateEnum
CREATE TYPE "AnalyticsReportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV', 'JSON');

-- CreateEnum
CREATE TYPE "AnalyticsReportStatus" AS ENUM ('QUEUED', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "customDomain" VARCHAR(255),
    "status" "tenant_status" NOT NULL DEFAULT 'ACTIVE',
    "lifecycleStatus" "tenant_lifecycle_status" NOT NULL DEFAULT 'TRIAL',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ar-SY',
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "features" JSONB NOT NULL DEFAULT '{}',
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "regionId" UUID,
    "name" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(100),
    "phone" VARCHAR(30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_region_access" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_region_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branch_access" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_branch_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_roles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_custom_roles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "customRoleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_saved_filters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_weekly_schedules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "startMin" INTEGER NOT NULL DEFAULT 0,
    "endHour" INTEGER NOT NULL DEFAULT 17,
    "endMin" INTEGER NOT NULL DEFAULT 0,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_weekly_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "firstNameAr" VARCHAR(100),
    "lastNameAr" VARCHAR(100),
    "phone" VARCHAR(30),
    "jobTitle" VARCHAR(120),
    "departmentId" UUID,
    "managerId" UUID,
    "startDate" DATE,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" VARCHAR(64),
    "languages" JSONB,
    "avatarUrl" VARCHAR(512),
    "notes" TEXT,
    "emergencyContactName" VARCHAR(120),
    "emergencyContactPhone" VARCHAR(30),
    "branchAccessMode" "BranchAccessMode" NOT NULL DEFAULT 'SINGLE',
    "suspendedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" VARCHAR(88),
    "lockedUntil" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "grantedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_invitations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "email" VARCHAR(255) NOT NULL,
    "roles" JSONB NOT NULL,
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "firstNameAr" VARCHAR(100),
    "lastNameAr" VARCHAR(100),
    "phone" VARCHAR(30),
    "invitedBy" UUID NOT NULL,
    "status" "StaffInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_dashboard_layouts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profile" VARCHAR(50) NOT NULL,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "sessionId" UUID NOT NULL,
    "deviceName" VARCHAR(255),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tenantId" UUID,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "failReason" VARCHAR(100),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_backup_codes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "deviceName" VARCHAR(255),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "firstNameAr" VARCHAR(100),
    "lastNameAr" VARCHAR(100),
    "dateOfBirth" DATE,
    "gender" VARCHAR(10),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "nationalId" VARCHAR(50),
    "bloodGroup" VARCHAR(5),
    "notes" TEXT,
    "profileData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_addresses" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "line1" VARCHAR(255) NOT NULL,
    "line2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "country" VARCHAR(2) NOT NULL DEFAULT 'SY',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "patientId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "cancellationReason" VARCHAR(500),
    "serviceType" VARCHAR(100),
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceSeriesId" UUID,
    "resourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_waitlist" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "patientId" UUID NOT NULL,
    "providerId" UUID,
    "preferredDate" TIMESTAMP(3),
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "status" "waitlist_status" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appointment_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_resources" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "resourceType" "scheduling_resource_type" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "scheduling_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "serviceType" VARCHAR(100),
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "providerId" UUID,
    "notes" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appointment_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_operating_hours" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openHour" INTEGER NOT NULL DEFAULT 7,
    "openMin" INTEGER NOT NULL DEFAULT 0,
    "closeHour" INTEGER NOT NULL DEFAULT 20,
    "closeMin" INTEGER NOT NULL DEFAULT 0,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_weekly_schedules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "providerId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "startMin" INTEGER NOT NULL DEFAULT 0,
    "endHour" INTEGER NOT NULL DEFAULT 17,
    "endMin" INTEGER NOT NULL DEFAULT 0,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_weekly_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_reminder_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "reminderType" VARCHAR(20) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "clinicianId" UUID NOT NULL,
    "chiefComplaint" TEXT,
    "diagnoses" JSONB NOT NULL DEFAULT '[]',
    "medications" JSONB NOT NULL DEFAULT '[]',
    "observations" JSONB NOT NULL DEFAULT '[]',
    "soapNotes" JSONB NOT NULL DEFAULT '{}',
    "structuredNotes" JSONB NOT NULL DEFAULT '[]',
    "status" "encounter_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "followUpDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedBy" UUID,
    "coSignedAt" TIMESTAMP(3),
    "coSignedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_problems" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "code" VARCHAR(20),
    "codingSystem" VARCHAR(32) DEFAULT 'ICD-10',
    "description" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "onsetDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "actorUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_note_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "noteType" "clinical_note_type" NOT NULL DEFAULT 'CONSULTATION',
    "soapNotes" JSONB NOT NULL DEFAULT '{}',
    "body" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_note_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "testName" VARCHAR(200) NOT NULL,
    "value" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(50),
    "referenceRange" VARCHAR(100),
    "status" VARCHAR(30),
    "resultedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dental_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "odontogramMode" "odontogram_mode" NOT NULL DEFAULT 'ADULT',
    "odontogramState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dental_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orthodontic_cases" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "orthodontic_case_status" NOT NULL DEFAULT 'ACTIVE',
    "applianceType" VARCHAR(50) NOT NULL,
    "startDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "clinicalData" JSONB NOT NULL DEFAULT '{}',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orthodontic_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implant_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "toothId" VARCHAR(4) NOT NULL,
    "implantSystem" VARCHAR(100),
    "implantDiameter" DECIMAL(5,2),
    "implantLength" DECIMAL(5,2),
    "abutmentType" VARCHAR(100),
    "status" "implant_record_status" NOT NULL DEFAULT 'PLANNED',
    "placedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "notes" TEXT,
    "surgicalData" JSONB NOT NULL DEFAULT '{}',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implant_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dental_clinical_notes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "dentalRecordId" UUID,
    "encounterId" UUID,
    "noteType" VARCHAR(30) NOT NULL DEFAULT 'progress',
    "content" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dental_clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dental_tooth_conditions" (
    "id" UUID NOT NULL,
    "dentalRecordId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "toothId" VARCHAR(4) NOT NULL,
    "surface" VARCHAR(20),
    "conditionCode" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "encounterId" UUID,
    "recordedBy" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dental_tooth_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dental_procedure_materials" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "procedureCode" VARCHAR(30) NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "defaultQuantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dental_procedure_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beauty_procedure_materials" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "procedureCode" VARCHAR(30) NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "defaultQuantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beauty_procedure_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" "TreatmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "clinicalNotes" TEXT,
    "totalEstimatedCost" DECIMAL(12,2),
    "totalEstimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "consentSignedAt" TIMESTAMP(3),
    "consentRecordedBy" UUID,
    "consentMethod" VARCHAR(50),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "submittedAt" TIMESTAMP(3),
    "submittedBy" UUID,
    "insuranceSnapshot" JSONB NOT NULL DEFAULT '{}',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_phases" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visitNumber" INTEGER,
    "estimatedVisitDate" TIMESTAMP(3),
    "clinicalNotes" TEXT,

    CONSTRAINT "treatment_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plan_items" (
    "id" UUID NOT NULL,
    "phaseId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "toothNumbers" JSONB NOT NULL DEFAULT '[]',
    "status" "TreatmentPlanItemStatus" NOT NULL DEFAULT 'PLANNED',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dependsOnItemId" UUID,
    "completedAt" TIMESTAMP(3),
    "completedBy" UUID,
    "encounterId" UUID,
    "insuranceEligible" BOOLEAN NOT NULL DEFAULT true,
    "insuranceEstimate" DECIMAL(12,2),
    "patientPortion" DECIMAL(12,2),
    "requiresPreAuth" BOOLEAN NOT NULL DEFAULT false,
    "preAuthStatus" VARCHAR(30),

    CONSTRAINT "treatment_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodontal_exams" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "recordedBy" UUID NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "chartData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodontal_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beauty_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "bodyMapState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beauty_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beauty_annotations" (
    "id" UUID NOT NULL,
    "beautyRecordId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "zone" VARCHAR(100) NOT NULL,
    "treatment" VARCHAR(100) NOT NULL,
    "coordinates" JSONB NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "encounterId" UUID,
    "recordedBy" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "beauty_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "nameEn" VARCHAR(100) NOT NULL,
    "nameAr" VARCHAR(100),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_suppliers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "contactName" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" VARCHAR(500),
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "categoryId" UUID,
    "sku" VARCHAR(100) NOT NULL,
    "barcode" VARCHAR(100),
    "brand" VARCHAR(100),
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "unit" VARCHAR(30) NOT NULL,
    "quantityOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorderThreshold" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "minQuantity" DECIMAL(18,4),
    "maxQuantity" DECIMAL(18,4),
    "costPerUnit" DECIMAL(18,4),
    "sellingPrice" DECIMAL(18,4),
    "storageLocation" VARCHAR(255),
    "expiryDate" DATE,
    "supplierId" UUID,
    "lotNumber" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_consumption_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "encounterId" UUID,
    "patientId" UUID,
    "procedureCode" VARCHAR(30),
    "quantityUsed" DECIMAL(18,4) NOT NULL,
    "consumedBy" UUID NOT NULL,
    "notes" TEXT,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" UUID,
    "invoiceLineItemId" UUID,

    CONSTRAINT "inventory_consumption_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_movements" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "movementType" VARCHAR(30) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "quantityBefore" DECIMAL(18,4) NOT NULL,
    "quantityAfter" DECIMAL(18,4) NOT NULL,
    "reason" VARCHAR(255),
    "notes" TEXT,
    "encounterId" UUID,
    "patientId" UUID,
    "procedureCode" VARCHAR(30),
    "warehouseId" UUID,
    "performedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "lotNumber" VARCHAR(100),
    "manufacturedDate" DATE,
    "expiryDate" DATE,
    "quantityOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_disposal_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "batchId" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "disposedBy" UUID NOT NULL,
    "disposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_disposal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "poNumber" VARCHAR(30) NOT NULL,
    "supplierId" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "requestedBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantityOrdered" DECIMAL(18,4) NOT NULL,
    "quantityReceived" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_warehouses" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "code" VARCHAR(50) NOT NULL,
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "address" VARCHAR(500),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_warehouse_stock" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantityOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_warehouse_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_transfers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "transferNumber" VARCHAR(30) NOT NULL,
    "fromWarehouseId" UUID NOT NULL,
    "toWarehouseId" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "requestedBy" UUID NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_transfer_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "stockTransferId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "quantityReceived" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_counts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "countNumber" VARCHAR(30) NOT NULL,
    "warehouseId" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "requestedBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_count_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "stockCountId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "systemQuantity" DECIMAL(18,4) NOT NULL,
    "countedQuantity" DECIMAL(18,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_requests" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestNumber" VARCHAR(30) NOT NULL,
    "requestType" VARCHAR(20) NOT NULL DEFAULT 'DEPARTMENT',
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "departmentName" VARCHAR(120),
    "patientId" UUID,
    "warehouseId" UUID,
    "notes" TEXT,
    "requestedBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "fulfilledBy" UUID,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_request_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "stockRequestId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantityRequested" DECIMAL(18,4) NOT NULL,
    "quantityFulfilled" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_tickets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "appointmentId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "queue_ticket_status" NOT NULL DEFAULT 'WAITING',
    "priority" "queue_priority" NOT NULL DEFAULT 'NORMAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "checkedInAt" TIMESTAMP(3),
    "calledAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "waitTimeSeconds" INTEGER,
    "resourceId" UUID,
    "etaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_ticket_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "queueTicketId" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "fromStatus" VARCHAR(32),
    "toStatus" VARCHAR(32),
    "actorUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "patientId" UUID NOT NULL,
    "invoiceNumber" VARCHAR(50) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SYP',
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "amountSubtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amountDiscount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amountTax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "insuranceProvider" VARCHAR(255),
    "insurancePolicyNumber" VARCHAR(100),
    "insuranceAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "patientResponsibility" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "insuranceClaimStatus" VARCHAR(50),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discountAmount" DECIMAL(18,4) NOT NULL,
    "taxAmount" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,
    "serviceCode" VARCHAR(50),
    "encounterId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paymentMethod" VARCHAR(50) NOT NULL,
    "paymentReference" VARCHAR(255),
    "paymentDate" DATE NOT NULL,
    "recordedBy" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_billing_sequences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "prefix" VARCHAR(20) NOT NULL DEFAULT 'INV',
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_billing_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_refunds" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "paymentId" UUID,
    "amount" DECIMAL(18,4) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "refundMethod" VARCHAR(50) NOT NULL,
    "refundReference" VARCHAR(255),
    "refundDate" DATE NOT NULL,
    "approvedBy" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "creditNoteNumber" VARCHAR(50) NOT NULL,
    "status" "credit_note_status" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,4) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "issuedBy" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_write_offs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "approvedBy" UUID NOT NULL,
    "writeOffDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_write_offs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "openedBy" UUID NOT NULL,
    "closedBy" UUID,
    "status" "cash_session_status" NOT NULL DEFAULT 'OPEN',
    "openingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "actualCash" DECIMAL(18,4),
    "variance" DECIMAL(18,4),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "payment_plan_status" NOT NULL DEFAULT 'ACTIVE',
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SYP',
    "startDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plan_installments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "paymentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_plan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_prices" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceCode" VARCHAR(50) NOT NULL,
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SYP',
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "paymentId" UUID,
    "receiptNumber" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SYP',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy" UUID NOT NULL,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerId" UUID,
    "serviceType" VARCHAR(100),
    "rateType" "commission_rate_type" NOT NULL,
    "rateValue" DECIMAL(10,4) NOT NULL,
    "minimumThreshold" DECIMAL(18,4),
    "maximumCap" DECIMAL(18,4),
    "effectiveDate" DATE NOT NULL,
    "expiryDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_calculations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "providerId" UUID NOT NULL,
    "patientId" UUID,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "commission_status" NOT NULL DEFAULT 'CALCULATED',
    "totalRevenue" DECIMAL(18,4) NOT NULL,
    "commissionAmount" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SYP',
    "basisDocumentIds" TEXT[],
    "paymentMethod" VARCHAR(50),
    "paymentReference" VARCHAR(255),
    "paymentDate" TIMESTAMP(3),
    "disputeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_line_items" (
    "id" UUID NOT NULL,
    "commissionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "appointmentId" UUID,
    "serviceDescription" VARCHAR(500) NOT NULL,
    "serviceType" VARCHAR(100),
    "amount" DECIMAL(18,4) NOT NULL,
    "commissionRateType" "commission_rate_type" NOT NULL,
    "commissionRateValue" DECIMAL(10,4) NOT NULL,
    "minimumThreshold" DECIMAL(18,4),
    "maximumCap" DECIMAL(18,4),
    "commissionAmount" DECIMAL(18,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePointsEarned" INTEGER NOT NULL DEFAULT 0,
    "tier" "loyalty_tier" NOT NULL DEFAULT 'BRONZE',
    "enrollmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "loyalty_transaction_type" NOT NULL,
    "pointsAmount" INTEGER NOT NULL,
    "reference" VARCHAR(255),
    "description" TEXT,
    "balanceAfter" INTEGER,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "pointsRequired" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "expiryDate" TIMESTAMP(3),
    "status" "loyalty_reward_status" NOT NULL DEFAULT 'AVAILABLE',
    "redeemedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "customerId" UUID NOT NULL,
    "plan" VARCHAR(100) NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SYP',
    "createdBy" UUID NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_tenants" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "region" "platform_region" NOT NULL,
    "plan" "entitlement_plan" NOT NULL DEFAULT 'LITE',
    "maxBranches" INTEGER,
    "maxUsers" INTEGER,
    "status" "platform_tenant_status" NOT NULL DEFAULT 'PROVISIONING',
    "provisionedBy" UUID NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedReason" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privileged_access_grants" (
    "id" UUID NOT NULL,
    "platformTenantId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "adminName" VARCHAR(255) NOT NULL,
    "scopes" TEXT[],
    "justification" TEXT NOT NULL,
    "status" "privileged_access_grant_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "breakGlass" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privileged_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_subscriptions" (
    "id" UUID NOT NULL,
    "platformTenantId" UUID NOT NULL,
    "plan" "entitlement_plan" NOT NULL,
    "status" "subscription_status" NOT NULL,
    "billingCycleMonths" INTEGER NOT NULL DEFAULT 12,
    "pricePerMonth" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "paidManuallyBy" UUID,
    "paidManuallyAt" TIMESTAMP(3),
    "paymentReference" VARCHAR(255),
    "paymentNotes" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalAttemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "patientId" UUID NOT NULL,
    "userId" UUID,
    "status" "portal_account_status" NOT NULL DEFAULT 'INVITED',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifySms" BOOLEAN NOT NULL DEFAULT false,
    "notifyPush" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" UUID NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregiver_access_grants" (
    "id" UUID NOT NULL,
    "portalAccountId" UUID NOT NULL,
    "caregiverContact" VARCHAR(255) NOT NULL,
    "caregiverName" VARCHAR(255) NOT NULL,
    "scopes" TEXT[],
    "grantedBy" VARCHAR(255) NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caregiver_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_reports" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "reportType" VARCHAR(50) NOT NULL,
    "format" "AnalyticsReportFormat" NOT NULL,
    "status" "AnalyticsReportStatus" NOT NULL DEFAULT 'QUEUED',
    "createdBy" UUID NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "recipientEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "downloadUrl" VARCHAR(1000),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleFrequency" VARCHAR(20),
    "lastScheduledRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "analytics_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_metrics" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "metricName" VARCHAR(120) NOT NULL,
    "metricValue" JSONB NOT NULL,
    "dimensionFilter" JSONB NOT NULL DEFAULT '{}',
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" UUID NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_filter_presets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_filter_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_layouts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profile" VARCHAR(64) NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_dashboards" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "dashboardType" VARCHAR(50) NOT NULL,
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "createdBy" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_reports" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(500) NOT NULL,
    "reportType" VARCHAR(80) NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "status" "AnalyticsReportStatus" NOT NULL DEFAULT 'QUEUED',
    "createdBy" UUID NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "downloadUrl" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "operational_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_shares" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "reportKind" VARCHAR(20) NOT NULL,
    "targetType" VARCHAR(20) NOT NULL,
    "targetId" VARCHAR(255) NOT NULL,
    "access" VARCHAR(20) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_filter_presets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_filter_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_custom_definitions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "reportType" VARCHAR(50) NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "visualization" VARCHAR(20) NOT NULL,
    "dataset" VARCHAR(50) NOT NULL,
    "dimensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "measures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB NOT NULL DEFAULT '{}',
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleFrequency" VARCHAR(20),
    "recipientEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_custom_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "recipientId" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "category" "notification_category",
    "eventType" VARCHAR(100),
    "templateId" UUID,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "notification_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "notification_status" NOT NULL DEFAULT 'QUEUED',
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" VARCHAR(500),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_device_tokens" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "channel" "notification_channel" NOT NULL,
    "category" "notification_category" NOT NULL DEFAULT 'SYSTEM',
    "subjectEn" VARCHAR(500) NOT NULL,
    "subjectAr" VARCHAR(500),
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_template_versions" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "subjectEn" VARCHAR(500) NOT NULL,
    "subjectAr" VARCHAR(500),
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "patientId" UUID,
    "channelSettings" JSONB NOT NULL DEFAULT '{}',
    "categorySettings" JSONB NOT NULL DEFAULT '{}',
    "quietHoursStart" VARCHAR(5),
    "quietHoursEnd" VARCHAR(5),
    "timezone" VARCHAR(64),
    "language" VARCHAR(10),
    "frequencyLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_automation_rules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "eventType" VARCHAR(100) NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "templateId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schedule" VARCHAR(100),
    "recipientRoles" JSONB NOT NULL DEFAULT '[]',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_channel_configs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "provider" VARCHAR(100),
    "providerStatus" VARCHAR(50) NOT NULL DEFAULT 'unknown',
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_saved_filters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resourceType" VARCHAR(100) NOT NULL,
    "resourceId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "actorRoles" TEXT[],
    "category" VARCHAR(50),
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "reason" TEXT,
    "changes" JSONB,
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "correlationId" UUID,
    "locale" VARCHAR(5),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "templateId" UUID,
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255) NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "steps" TEXT[],
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "workflow_status" NOT NULL DEFAULT 'ACTIVE',
    "triggerType" VARCHAR(100),
    "priority" "workflow_task_priority" DEFAULT 'MEDIUM',
    "assigneeId" UUID,
    "dueAt" TIMESTAMP(3),
    "dataContext" JSONB,
    "createdBy" UUID NOT NULL,
    "canceledBy" UUID,
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "category" VARCHAR(50),
    "triggerType" VARCHAR(100) NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "workflow_template_status" NOT NULL DEFAULT 'DRAFT',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "slaHours" INTEGER,
    "createdBy" UUID,
    "updatedBy" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_tasks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "workflowId" UUID,
    "title" VARCHAR(500) NOT NULL,
    "titleAr" VARCHAR(500),
    "description" TEXT,
    "status" "workflow_task_status" NOT NULL DEFAULT 'PENDING',
    "priority" "workflow_task_priority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" UUID,
    "assignedBy" UUID,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_approvals" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "workflowId" UUID,
    "title" VARCHAR(500) NOT NULL,
    "titleAr" VARCHAR(500),
    "status" "workflow_approval_status" NOT NULL DEFAULT 'PENDING',
    "mode" "workflow_approval_mode" NOT NULL DEFAULT 'SINGLE',
    "category" VARCHAR(50),
    "requestedBy" UUID NOT NULL,
    "approverRoles" JSONB NOT NULL DEFAULT '[]',
    "approverIds" JSONB NOT NULL DEFAULT '[]',
    "approvedBy" UUID,
    "rejectedBy" UUID,
    "comment" TEXT,
    "rejectionReason" TEXT,
    "dueAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_automation_rules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "templateId" UUID,
    "name" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255),
    "eventType" VARCHAR(100) NOT NULL,
    "actionType" VARCHAR(50) NOT NULL,
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_execution_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "workflowId" UUID NOT NULL,
    "stepIndex" INTEGER,
    "eventType" VARCHAR(100) NOT NULL,
    "actorId" UUID,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_saved_filters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255) NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "modelType" VARCHAR(50) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "status" "ai_model_status" NOT NULL DEFAULT 'DRAFT',
    "createdBy" UUID NOT NULL,
    "validatedBy" UUID,
    "validatedAt" TIMESTAMP(3),
    "validationNotes" TEXT,
    "deployedBy" UUID,
    "deployedAt" TIMESTAMP(3),
    "retiredBy" UUID,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "branchId" UUID,
    "title" VARCHAR(255) NOT NULL,
    "workspaceId" VARCHAR(50),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "contextJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "citationsJson" JSONB NOT NULL DEFAULT '[]',
    "attachmentsJson" JSONB NOT NULL DEFAULT '[]',
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "category" VARCHAR(50) NOT NULL,
    "titleEn" VARCHAR(255) NOT NULL,
    "titleAr" VARCHAR(255),
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" UUID NOT NULL,
    "promptId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "titleEn" VARCHAR(255) NOT NULL,
    "titleAr" VARCHAR(255),
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "usageDate" DATE NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_user_settings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "preferencesJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tenant_settings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "settingsJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "category" "media_category" NOT NULL,
    "ownerType" VARCHAR(50) NOT NULL,
    "ownerId" UUID NOT NULL,
    "patientId" UUID,
    "originalFilename" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(127) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "status" "media_asset_status" NOT NULL DEFAULT 'PENDING_SCAN',
    "virusScanStatus" "virus_scan_status" NOT NULL DEFAULT 'PENDING',
    "storageKey" VARCHAR(1000) NOT NULL,
    "variants" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "comparisonGroupId" UUID,
    "comparisonRole" "beauty_comparison_role",
    "uploadedBy" UUID NOT NULL,
    "quarantineReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "eventType" VARCHAR(100) NOT NULL,
    "aggregateType" VARCHAR(100) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_event_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_lifecycleStatus_idx" ON "tenants"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "tenants_deletedAt_idx" ON "tenants"("deletedAt");

-- CreateIndex
CREATE INDEX "branches_tenantId_idx" ON "branches"("tenantId");

-- CreateIndex
CREATE INDEX "branches_tenantId_isActive_idx" ON "branches"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "regions_tenantId_idx" ON "regions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "regions_tenantId_name_key" ON "regions"("tenantId", "name");

-- CreateIndex
CREATE INDEX "user_region_access_tenantId_userId_idx" ON "user_region_access"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_region_access_userId_regionId_key" ON "user_region_access"("userId", "regionId");

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE INDEX "departments_tenantId_branchId_idx" ON "departments"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "user_branch_access_tenantId_userId_idx" ON "user_branch_access"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_branch_access_userId_branchId_key" ON "user_branch_access"("userId", "branchId");

-- CreateIndex
CREATE INDEX "custom_roles_tenantId_isArchived_idx" ON "custom_roles"("tenantId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_tenantId_name_key" ON "custom_roles"("tenantId", "name");

-- CreateIndex
CREATE INDEX "user_custom_roles_tenantId_userId_idx" ON "user_custom_roles"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_custom_roles_userId_customRoleId_key" ON "user_custom_roles"("userId", "customRoleId");

-- CreateIndex
CREATE INDEX "user_saved_filters_tenantId_userId_idx" ON "user_saved_filters"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_saved_filters_tenantId_userId_name_key" ON "user_saved_filters"("tenantId", "userId", "name");

-- CreateIndex
CREATE INDEX "staff_weekly_schedules_tenantId_userId_idx" ON "staff_weekly_schedules"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_weekly_schedules_tenantId_userId_dayOfWeek_key" ON "staff_weekly_schedules"("tenantId", "userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_isActive_idx" ON "users"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "users_tenantId_deletedAt_idx" ON "users"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "user_role_assignments_userId_idx" ON "user_role_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_userId_role_key" ON "user_role_assignments"("userId", "role");

-- CreateIndex
CREATE INDEX "staff_invitations_tenantId_status_idx" ON "staff_invitations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "staff_invitations_tenantId_email_idx" ON "staff_invitations"("tenantId", "email");

-- CreateIndex
CREATE INDEX "user_dashboard_layouts_tenantId_userId_idx" ON "user_dashboard_layouts"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_dashboard_layouts_tenantId_userId_profile_key" ON "user_dashboard_layouts"("tenantId", "userId", "profile");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_sessionId_key" ON "refresh_tokens"("sessionId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenantId_idx" ON "refresh_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_sessionId_idx" ON "refresh_tokens"("sessionId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_attemptedAt_idx" ON "login_attempts"("email", "attemptedAt");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_attemptedAt_idx" ON "login_attempts"("ipAddress", "attemptedAt");

-- CreateIndex
CREATE INDEX "login_attempts_tenantId_attemptedAt_idx" ON "login_attempts"("tenantId", "attemptedAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_tenantId_idx" ON "password_reset_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_tenantId_idx" ON "email_verification_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_tokenHash_idx" ON "email_verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "mfa_backup_codes_userId_idx" ON "mfa_backup_codes"("userId");

-- CreateIndex
CREATE INDEX "mfa_backup_codes_tenantId_idx" ON "mfa_backup_codes"("tenantId");

-- CreateIndex
CREATE INDEX "mfa_backup_codes_codeHash_idx" ON "mfa_backup_codes"("codeHash");

-- CreateIndex
CREATE INDEX "trusted_devices_userId_idx" ON "trusted_devices"("userId");

-- CreateIndex
CREATE INDEX "trusted_devices_tenantId_idx" ON "trusted_devices"("tenantId");

-- CreateIndex
CREATE INDEX "trusted_devices_tokenHash_idx" ON "trusted_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "patients_tenantId_idx" ON "patients"("tenantId");

-- CreateIndex
CREATE INDEX "patients_tenantId_deletedAt_idx" ON "patients"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "patients_tenantId_phone_idx" ON "patients"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "patients_tenantId_nationalId_idx" ON "patients"("tenantId", "nationalId");

-- CreateIndex
CREATE INDEX "patient_addresses_patientId_idx" ON "patient_addresses"("patientId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_idx" ON "appointments"("tenantId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_status_idx" ON "appointments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "appointments_tenantId_patientId_idx" ON "appointments"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_providerId_idx" ON "appointments"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_scheduledStart_idx" ON "appointments"("tenantId", "scheduledStart");

-- CreateIndex
CREATE INDEX "appointments_tenantId_recurrenceSeriesId_idx" ON "appointments"("tenantId", "recurrenceSeriesId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_resourceId_idx" ON "appointments"("tenantId", "resourceId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_deletedAt_idx" ON "appointments"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "appointment_waitlist_tenantId_status_idx" ON "appointment_waitlist"("tenantId", "status");

-- CreateIndex
CREATE INDEX "appointment_waitlist_tenantId_patientId_idx" ON "appointment_waitlist"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "scheduling_resources_tenantId_resourceType_idx" ON "scheduling_resources"("tenantId", "resourceType");

-- CreateIndex
CREATE INDEX "scheduling_resources_tenantId_branchId_idx" ON "scheduling_resources"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "appointment_templates_tenantId_idx" ON "appointment_templates"("tenantId");

-- CreateIndex
CREATE INDEX "branch_operating_hours_tenantId_branchId_idx" ON "branch_operating_hours"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_operating_hours_branchId_dayOfWeek_key" ON "branch_operating_hours"("branchId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "provider_weekly_schedules_tenantId_providerId_idx" ON "provider_weekly_schedules"("tenantId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_weekly_schedules_tenantId_providerId_dayOfWeek_key" ON "provider_weekly_schedules"("tenantId", "providerId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "appointment_reminder_logs_tenantId_appointmentId_idx" ON "appointment_reminder_logs"("tenantId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_reminder_logs_appointmentId_reminderType_key" ON "appointment_reminder_logs"("appointmentId", "reminderType");

-- CreateIndex
CREATE INDEX "encounters_tenantId_idx" ON "encounters"("tenantId");

-- CreateIndex
CREATE INDEX "encounters_tenantId_patientId_idx" ON "encounters"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "encounters_tenantId_clinicianId_idx" ON "encounters"("tenantId", "clinicianId");

-- CreateIndex
CREATE INDEX "encounters_tenantId_createdAt_idx" ON "encounters"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "encounters_tenantId_deletedAt_idx" ON "encounters"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "encounters_tenantId_status_idx" ON "encounters"("tenantId", "status");

-- CreateIndex
CREATE INDEX "patient_problems_tenantId_patientId_idx" ON "patient_problems"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "patient_problems_tenantId_status_idx" ON "patient_problems"("tenantId", "status");

-- CreateIndex
CREATE INDEX "encounter_events_tenantId_encounterId_idx" ON "encounter_events"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "encounter_events_tenantId_createdAt_idx" ON "encounter_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "clinical_note_templates_tenantId_isActive_idx" ON "clinical_note_templates"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "lab_results_tenantId_patientId_idx" ON "lab_results"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "lab_results_tenantId_encounterId_idx" ON "lab_results"("tenantId", "encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "dental_records_patientId_key" ON "dental_records"("patientId");

-- CreateIndex
CREATE INDEX "dental_records_tenantId_idx" ON "dental_records"("tenantId");

-- CreateIndex
CREATE INDEX "orthodontic_cases_tenantId_patientId_idx" ON "orthodontic_cases"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "orthodontic_cases_tenantId_status_idx" ON "orthodontic_cases"("tenantId", "status");

-- CreateIndex
CREATE INDEX "implant_records_tenantId_patientId_idx" ON "implant_records"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "implant_records_tenantId_toothId_idx" ON "implant_records"("tenantId", "toothId");

-- CreateIndex
CREATE INDEX "implant_records_tenantId_status_idx" ON "implant_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "dental_clinical_notes_tenantId_patientId_idx" ON "dental_clinical_notes"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "dental_clinical_notes_tenantId_createdAt_idx" ON "dental_clinical_notes"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "dental_tooth_conditions_dentalRecordId_idx" ON "dental_tooth_conditions"("dentalRecordId");

-- CreateIndex
CREATE INDEX "dental_tooth_conditions_tenantId_toothId_idx" ON "dental_tooth_conditions"("tenantId", "toothId");

-- CreateIndex
CREATE INDEX "dental_tooth_conditions_tenantId_conditionCode_idx" ON "dental_tooth_conditions"("tenantId", "conditionCode");

-- CreateIndex
CREATE INDEX "dental_procedure_materials_tenantId_idx" ON "dental_procedure_materials"("tenantId");

-- CreateIndex
CREATE INDEX "dental_procedure_materials_tenantId_procedureCode_idx" ON "dental_procedure_materials"("tenantId", "procedureCode");

-- CreateIndex
CREATE UNIQUE INDEX "dental_procedure_materials_tenantId_procedureCode_inventory_key" ON "dental_procedure_materials"("tenantId", "procedureCode", "inventoryItemId");

-- CreateIndex
CREATE INDEX "beauty_procedure_materials_tenantId_idx" ON "beauty_procedure_materials"("tenantId");

-- CreateIndex
CREATE INDEX "beauty_procedure_materials_tenantId_procedureCode_idx" ON "beauty_procedure_materials"("tenantId", "procedureCode");

-- CreateIndex
CREATE UNIQUE INDEX "beauty_procedure_materials_tenantId_procedureCode_inventory_key" ON "beauty_procedure_materials"("tenantId", "procedureCode", "inventoryItemId");

-- CreateIndex
CREATE INDEX "treatment_plans_tenantId_patientId_idx" ON "treatment_plans"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "treatment_plans_tenantId_status_idx" ON "treatment_plans"("tenantId", "status");

-- CreateIndex
CREATE INDEX "treatment_phases_planId_idx" ON "treatment_phases"("planId");

-- CreateIndex
CREATE INDEX "treatment_plan_items_phaseId_idx" ON "treatment_plan_items"("phaseId");

-- CreateIndex
CREATE INDEX "treatment_plan_items_tenantId_status_idx" ON "treatment_plan_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "periodontal_exams_tenantId_patientId_idx" ON "periodontal_exams"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "periodontal_exams_tenantId_patientId_examDate_idx" ON "periodontal_exams"("tenantId", "patientId", "examDate");

-- CreateIndex
CREATE UNIQUE INDEX "beauty_records_patientId_key" ON "beauty_records"("patientId");

-- CreateIndex
CREATE INDEX "beauty_records_tenantId_idx" ON "beauty_records"("tenantId");

-- CreateIndex
CREATE INDEX "beauty_annotations_beautyRecordId_idx" ON "beauty_annotations"("beautyRecordId");

-- CreateIndex
CREATE INDEX "beauty_annotations_tenantId_recordedAt_idx" ON "beauty_annotations"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "inventory_categories_tenantId_idx" ON "inventory_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_tenantId_key_key" ON "inventory_categories"("tenantId", "key");

-- CreateIndex
CREATE INDEX "inventory_suppliers_tenantId_idx" ON "inventory_suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_suppliers_tenantId_deletedAt_idx" ON "inventory_suppliers"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_suppliers_tenantId_code_key" ON "inventory_suppliers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_idx" ON "inventory_items"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_deletedAt_idx" ON "inventory_items"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_categoryId_idx" ON "inventory_items"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_barcode_idx" ON "inventory_items"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_supplierId_idx" ON "inventory_items"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_expiryDate_idx" ON "inventory_items"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_quantityOnHand_idx" ON "inventory_items"("tenantId", "quantityOnHand");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_deletedAt_nameEn_idx" ON "inventory_items"("tenantId", "deletedAt", "nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_tenantId_sku_key" ON "inventory_items"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "inventory_consumption_logs_tenantId_idx" ON "inventory_consumption_logs"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_consumption_logs_inventoryItemId_idx" ON "inventory_consumption_logs"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_consumption_logs_tenantId_consumedAt_idx" ON "inventory_consumption_logs"("tenantId", "consumedAt");

-- CreateIndex
CREATE INDEX "inventory_consumption_logs_tenantId_patientId_idx" ON "inventory_consumption_logs"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "inventory_consumption_logs_tenantId_invoiceId_idx" ON "inventory_consumption_logs"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_tenantId_idx" ON "inventory_stock_movements"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_inventoryItemId_idx" ON "inventory_stock_movements"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_tenantId_createdAt_idx" ON "inventory_stock_movements"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_tenantId_movementType_idx" ON "inventory_stock_movements"("tenantId", "movementType");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_tenantId_warehouseId_idx" ON "inventory_stock_movements"("tenantId", "warehouseId");

-- CreateIndex
CREATE INDEX "inventory_batches_tenantId_idx" ON "inventory_batches"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_batches_inventoryItemId_idx" ON "inventory_batches"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_batches_tenantId_expiryDate_idx" ON "inventory_batches"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "inventory_batches_tenantId_status_idx" ON "inventory_batches"("tenantId", "status");

-- CreateIndex
CREATE INDEX "inventory_disposal_logs_tenantId_idx" ON "inventory_disposal_logs"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_disposal_logs_inventoryItemId_idx" ON "inventory_disposal_logs"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_disposal_logs_batchId_idx" ON "inventory_disposal_logs"("batchId");

-- CreateIndex
CREATE INDEX "inventory_disposal_logs_tenantId_disposedAt_idx" ON "inventory_disposal_logs"("tenantId", "disposedAt");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_idx" ON "purchase_orders"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_status_idx" ON "purchase_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_supplierId_idx" ON "purchase_orders"("tenantId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenantId_poNumber_key" ON "purchase_orders"("tenantId", "poNumber");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchaseOrderId_idx" ON "purchase_order_lines"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_lines_tenantId_idx" ON "purchase_order_lines"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_order_lines_inventoryItemId_idx" ON "purchase_order_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_warehouses_tenantId_idx" ON "inventory_warehouses"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_warehouses_tenantId_deletedAt_idx" ON "inventory_warehouses"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "inventory_warehouses_tenantId_isDefault_idx" ON "inventory_warehouses"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_warehouses_tenantId_code_key" ON "inventory_warehouses"("tenantId", "code");

-- CreateIndex
CREATE INDEX "inventory_warehouse_stock_tenantId_idx" ON "inventory_warehouse_stock"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_warehouse_stock_warehouseId_idx" ON "inventory_warehouse_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_warehouse_stock_inventoryItemId_idx" ON "inventory_warehouse_stock"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_warehouse_stock_tenantId_warehouseId_inventoryIte_key" ON "inventory_warehouse_stock"("tenantId", "warehouseId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_stock_transfers_tenantId_idx" ON "inventory_stock_transfers"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stock_transfers_tenantId_status_idx" ON "inventory_stock_transfers"("tenantId", "status");

-- CreateIndex
CREATE INDEX "inventory_stock_transfers_fromWarehouseId_idx" ON "inventory_stock_transfers"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "inventory_stock_transfers_toWarehouseId_idx" ON "inventory_stock_transfers"("toWarehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_transfers_tenantId_transferNumber_key" ON "inventory_stock_transfers"("tenantId", "transferNumber");

-- CreateIndex
CREATE INDEX "inventory_stock_transfer_lines_stockTransferId_idx" ON "inventory_stock_transfer_lines"("stockTransferId");

-- CreateIndex
CREATE INDEX "inventory_stock_transfer_lines_tenantId_idx" ON "inventory_stock_transfer_lines"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stock_transfer_lines_inventoryItemId_idx" ON "inventory_stock_transfer_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_stock_counts_tenantId_idx" ON "inventory_stock_counts"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stock_counts_tenantId_status_idx" ON "inventory_stock_counts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "inventory_stock_counts_warehouseId_idx" ON "inventory_stock_counts"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_counts_tenantId_countNumber_key" ON "inventory_stock_counts"("tenantId", "countNumber");

-- CreateIndex
CREATE INDEX "inventory_stock_count_lines_stockCountId_idx" ON "inventory_stock_count_lines"("stockCountId");

-- CreateIndex
CREATE INDEX "inventory_stock_count_lines_tenantId_idx" ON "inventory_stock_count_lines"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stock_count_lines_inventoryItemId_idx" ON "inventory_stock_count_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_stock_requests_tenantId_idx" ON "inventory_stock_requests"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stock_requests_tenantId_status_idx" ON "inventory_stock_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "inventory_stock_requests_tenantId_requestedBy_idx" ON "inventory_stock_requests"("tenantId", "requestedBy");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_requests_tenantId_requestNumber_key" ON "inventory_stock_requests"("tenantId", "requestNumber");

-- CreateIndex
CREATE INDEX "inventory_stock_request_lines_stockRequestId_idx" ON "inventory_stock_request_lines"("stockRequestId");

-- CreateIndex
CREATE INDEX "inventory_stock_request_lines_tenantId_idx" ON "inventory_stock_request_lines"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stock_request_lines_inventoryItemId_idx" ON "inventory_stock_request_lines"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "queue_tickets_appointmentId_key" ON "queue_tickets"("appointmentId");

-- CreateIndex
CREATE INDEX "queue_tickets_tenantId_idx" ON "queue_tickets"("tenantId");

-- CreateIndex
CREATE INDEX "queue_tickets_tenantId_status_idx" ON "queue_tickets"("tenantId", "status");

-- CreateIndex
CREATE INDEX "queue_tickets_tenantId_scheduledStart_idx" ON "queue_tickets"("tenantId", "scheduledStart");

-- CreateIndex
CREATE INDEX "queue_tickets_tenantId_providerId_idx" ON "queue_tickets"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "queue_ticket_events_tenantId_queueTicketId_idx" ON "queue_ticket_events"("tenantId", "queueTicketId");

-- CreateIndex
CREATE INDEX "queue_ticket_events_tenantId_createdAt_idx" ON "queue_ticket_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_status_idx" ON "invoices"("tenantId", "status");

-- CreateIndex
CREATE INDEX "invoices_tenantId_patientId_idx" ON "invoices"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_invoiceDate_idx" ON "invoices"("tenantId", "invoiceDate");

-- CreateIndex
CREATE INDEX "invoices_tenantId_dueDate_idx" ON "invoices"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_tenantId_deletedAt_idx" ON "invoices"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenantId_invoiceNumber_key" ON "invoices"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_line_items_tenantId_idx" ON "invoice_line_items"("tenantId");

-- CreateIndex
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payments_tenantId_idx" ON "invoice_payments"("tenantId");

-- CreateIndex
CREATE INDEX "invoice_payments_tenantId_paymentDate_idx" ON "invoice_payments"("tenantId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_billing_sequences_tenantId_prefix_key" ON "tenant_billing_sequences"("tenantId", "prefix");

-- CreateIndex
CREATE INDEX "invoice_refunds_tenantId_idx" ON "invoice_refunds"("tenantId");

-- CreateIndex
CREATE INDEX "invoice_refunds_invoiceId_idx" ON "invoice_refunds"("invoiceId");

-- CreateIndex
CREATE INDEX "credit_notes_tenantId_idx" ON "credit_notes"("tenantId");

-- CreateIndex
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_tenantId_creditNoteNumber_key" ON "credit_notes"("tenantId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "invoice_write_offs_tenantId_idx" ON "invoice_write_offs"("tenantId");

-- CreateIndex
CREATE INDEX "invoice_write_offs_invoiceId_idx" ON "invoice_write_offs"("invoiceId");

-- CreateIndex
CREATE INDEX "cash_sessions_tenantId_idx" ON "cash_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "cash_sessions_tenantId_status_idx" ON "cash_sessions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "payment_plans_tenantId_idx" ON "payment_plans"("tenantId");

-- CreateIndex
CREATE INDEX "payment_plans_invoiceId_idx" ON "payment_plans"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_plan_installments_tenantId_idx" ON "payment_plan_installments"("tenantId");

-- CreateIndex
CREATE INDEX "payment_plan_installments_planId_idx" ON "payment_plan_installments"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_plan_installments_planId_sequence_key" ON "payment_plan_installments"("planId", "sequence");

-- CreateIndex
CREATE INDEX "service_prices_tenantId_isActive_idx" ON "service_prices"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "service_prices_tenantId_serviceCode_key" ON "service_prices"("tenantId", "serviceCode");

-- CreateIndex
CREATE INDEX "payment_receipts_tenantId_idx" ON "payment_receipts"("tenantId");

-- CreateIndex
CREATE INDEX "payment_receipts_invoiceId_idx" ON "payment_receipts"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_tenantId_receiptNumber_key" ON "payment_receipts"("tenantId", "receiptNumber");

-- CreateIndex
CREATE INDEX "commission_rules_tenantId_idx" ON "commission_rules"("tenantId");

-- CreateIndex
CREATE INDEX "commission_rules_tenantId_providerId_idx" ON "commission_rules"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "commission_rules_tenantId_effectiveDate_idx" ON "commission_rules"("tenantId", "effectiveDate");

-- CreateIndex
CREATE INDEX "commission_calculations_tenantId_idx" ON "commission_calculations"("tenantId");

-- CreateIndex
CREATE INDEX "commission_calculations_tenantId_providerId_idx" ON "commission_calculations"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "commission_calculations_tenantId_status_idx" ON "commission_calculations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "commission_calculations_tenantId_periodStart_periodEnd_idx" ON "commission_calculations"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "commission_line_items_commissionId_idx" ON "commission_line_items"("commissionId");

-- CreateIndex
CREATE INDEX "commission_line_items_tenantId_idx" ON "commission_line_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_patientId_key" ON "loyalty_accounts"("patientId");

-- CreateIndex
CREATE INDEX "loyalty_accounts_tenantId_idx" ON "loyalty_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "loyalty_accounts_tenantId_tier_idx" ON "loyalty_accounts"("tenantId", "tier");

-- CreateIndex
CREATE INDEX "loyalty_accounts_tenantId_isActive_idx" ON "loyalty_accounts"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "loyalty_transactions_accountId_idx" ON "loyalty_transactions"("accountId");

-- CreateIndex
CREATE INDEX "loyalty_transactions_tenantId_idx" ON "loyalty_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "loyalty_transactions_tenantId_createdAt_idx" ON "loyalty_transactions"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_rewards_tenantId_idx" ON "loyalty_rewards"("tenantId");

-- CreateIndex
CREATE INDEX "loyalty_rewards_accountId_idx" ON "loyalty_rewards"("accountId");

-- CreateIndex
CREATE INDEX "loyalty_rewards_tenantId_status_idx" ON "loyalty_rewards"("tenantId", "status");

-- CreateIndex
CREATE INDEX "loyalty_rewards_tenantId_deletedAt_idx" ON "loyalty_rewards"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "clinic_subscriptions_tenantId_idx" ON "clinic_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "clinic_subscriptions_tenantId_customerId_idx" ON "clinic_subscriptions"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "clinic_subscriptions_tenantId_status_idx" ON "clinic_subscriptions"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_tenants_tenantId_key" ON "platform_tenants"("tenantId");

-- CreateIndex
CREATE INDEX "platform_tenants_status_idx" ON "platform_tenants"("status");

-- CreateIndex
CREATE INDEX "platform_tenants_plan_idx" ON "platform_tenants"("plan");

-- CreateIndex
CREATE INDEX "platform_tenants_contractEndDate_idx" ON "platform_tenants"("contractEndDate");

-- CreateIndex
CREATE INDEX "platform_tenants_trialEndsAt_idx" ON "platform_tenants"("trialEndsAt");

-- CreateIndex
CREATE INDEX "privileged_access_grants_platformTenantId_idx" ON "privileged_access_grants"("platformTenantId");

-- CreateIndex
CREATE INDEX "privileged_access_grants_adminId_idx" ON "privileged_access_grants"("adminId");

-- CreateIndex
CREATE INDEX "privileged_access_grants_status_expiresAt_idx" ON "privileged_access_grants"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "platform_subscriptions_platformTenantId_idx" ON "platform_subscriptions"("platformTenantId");

-- CreateIndex
CREATE INDEX "platform_subscriptions_status_idx" ON "platform_subscriptions"("status");

-- CreateIndex
CREATE INDEX "platform_subscriptions_endDate_idx" ON "platform_subscriptions"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "portal_accounts_patientId_key" ON "portal_accounts"("patientId");

-- CreateIndex
CREATE INDEX "portal_accounts_tenantId_idx" ON "portal_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "portal_accounts_tenantId_status_idx" ON "portal_accounts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "caregiver_access_grants_portalAccountId_idx" ON "caregiver_access_grants"("portalAccountId");

-- CreateIndex
CREATE INDEX "caregiver_access_grants_expiresAt_idx" ON "caregiver_access_grants"("expiresAt");

-- CreateIndex
CREATE INDEX "analytics_reports_tenantId_idx" ON "analytics_reports"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_reports_tenantId_status_idx" ON "analytics_reports"("tenantId", "status");

-- CreateIndex
CREATE INDEX "analytics_reports_tenantId_isScheduled_idx" ON "analytics_reports"("tenantId", "isScheduled");

-- CreateIndex
CREATE INDEX "analytics_reports_tenantId_createdAt_idx" ON "analytics_reports"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_metrics_tenantId_metricName_recordedAt_idx" ON "analytics_metrics"("tenantId", "metricName", "recordedAt");

-- CreateIndex
CREATE INDEX "analytics_metrics_tenantId_branchId_idx" ON "analytics_metrics"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "analytics_filter_presets_tenantId_userId_idx" ON "analytics_filter_presets"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_layouts_tenantId_userId_profile_key" ON "analytics_layouts"("tenantId", "userId", "profile");

-- CreateIndex
CREATE INDEX "analytics_dashboards_tenantId_idx" ON "analytics_dashboards"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_dashboards_tenantId_dashboardType_idx" ON "analytics_dashboards"("tenantId", "dashboardType");

-- CreateIndex
CREATE INDEX "operational_reports_tenantId_idx" ON "operational_reports"("tenantId");

-- CreateIndex
CREATE INDEX "operational_reports_tenantId_status_idx" ON "operational_reports"("tenantId", "status");

-- CreateIndex
CREATE INDEX "operational_reports_tenantId_createdAt_idx" ON "operational_reports"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "report_shares_tenantId_reportId_idx" ON "report_shares"("tenantId", "reportId");

-- CreateIndex
CREATE INDEX "report_filter_presets_tenantId_userId_idx" ON "report_filter_presets"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "report_custom_definitions_tenantId_userId_idx" ON "report_custom_definitions"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_recipientId_idx" ON "notifications"("tenantId", "recipientId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_status_idx" ON "notifications"("tenantId", "status");

-- CreateIndex
CREATE INDEX "notifications_tenantId_createdAt_idx" ON "notifications"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_tenantId_recipientId_readAt_idx" ON "notifications"("tenantId", "recipientId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_tenantId_isArchived_idx" ON "notifications"("tenantId", "isArchived");

-- CreateIndex
CREATE INDEX "notifications_tenantId_category_idx" ON "notifications"("tenantId", "category");

-- CreateIndex
CREATE INDEX "notifications_tenantId_scheduledAt_idx" ON "notifications"("tenantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "notifications_tenantId_recipientId_isArchived_createdAt_idx" ON "notifications"("tenantId", "recipientId", "isArchived", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_device_tokens_tenantId_userId_idx" ON "user_device_tokens"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_device_tokens_tenantId_userId_token_key" ON "user_device_tokens"("tenantId", "userId", "token");

-- CreateIndex
CREATE INDEX "notification_templates_tenantId_isActive_idx" ON "notification_templates"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_tenantId_key_channel_key" ON "notification_templates"("tenantId", "key", "channel");

-- CreateIndex
CREATE INDEX "notification_template_versions_templateId_idx" ON "notification_template_versions"("templateId");

-- CreateIndex
CREATE INDEX "notification_preferences_tenantId_idx" ON "notification_preferences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenantId_userId_key" ON "notification_preferences"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenantId_patientId_key" ON "notification_preferences"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "notification_automation_rules_tenantId_isActive_idx" ON "notification_automation_rules"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_channel_configs_tenantId_channel_key" ON "tenant_channel_configs"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "notification_saved_filters_tenantId_userId_idx" ON "notification_saved_filters"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "audit_entries_tenantId_idx" ON "audit_entries"("tenantId");

-- CreateIndex
CREATE INDEX "audit_entries_tenantId_resourceType_resourceId_idx" ON "audit_entries"("tenantId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_entries_tenantId_actorId_idx" ON "audit_entries"("tenantId", "actorId");

-- CreateIndex
CREATE INDEX "audit_entries_tenantId_createdAt_idx" ON "audit_entries"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_entries_correlationId_idx" ON "audit_entries"("correlationId");

-- CreateIndex
CREATE INDEX "workflows_tenantId_idx" ON "workflows"("tenantId");

-- CreateIndex
CREATE INDEX "workflows_tenantId_status_idx" ON "workflows"("tenantId", "status");

-- CreateIndex
CREATE INDEX "workflows_tenantId_assigneeId_idx" ON "workflows"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX "workflows_tenantId_createdAt_idx" ON "workflows"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "workflows_tenantId_templateId_idx" ON "workflows"("tenantId", "templateId");

-- CreateIndex
CREATE INDEX "workflow_templates_tenantId_status_idx" ON "workflow_templates"("tenantId", "status");

-- CreateIndex
CREATE INDEX "workflow_templates_tenantId_category_idx" ON "workflow_templates"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_tenantId_key_key" ON "workflow_templates"("tenantId", "key");

-- CreateIndex
CREATE INDEX "workflow_tasks_tenantId_assigneeId_idx" ON "workflow_tasks"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX "workflow_tasks_tenantId_status_idx" ON "workflow_tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "workflow_tasks_tenantId_dueAt_idx" ON "workflow_tasks"("tenantId", "dueAt");

-- CreateIndex
CREATE INDEX "workflow_tasks_tenantId_workflowId_idx" ON "workflow_tasks"("tenantId", "workflowId");

-- CreateIndex
CREATE INDEX "workflow_approvals_tenantId_status_idx" ON "workflow_approvals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "workflow_approvals_tenantId_requestedBy_idx" ON "workflow_approvals"("tenantId", "requestedBy");

-- CreateIndex
CREATE INDEX "workflow_approvals_tenantId_workflowId_idx" ON "workflow_approvals"("tenantId", "workflowId");

-- CreateIndex
CREATE INDEX "workflow_automation_rules_tenantId_isActive_idx" ON "workflow_automation_rules"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_tenantId_workflowId_idx" ON "workflow_execution_logs"("tenantId", "workflowId");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_tenantId_createdAt_idx" ON "workflow_execution_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "workflow_saved_filters_tenantId_userId_idx" ON "workflow_saved_filters"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ai_models_tenantId_idx" ON "ai_models"("tenantId");

-- CreateIndex
CREATE INDEX "ai_models_tenantId_status_idx" ON "ai_models"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ai_conversations_tenantId_userId_updatedAt_idx" ON "ai_conversations"("tenantId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_prompts_tenantId_category_idx" ON "ai_prompts"("tenantId", "category");

-- CreateIndex
CREATE INDEX "ai_prompts_tenantId_userId_idx" ON "ai_prompts"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ai_prompt_versions_promptId_idx" ON "ai_prompt_versions"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_promptId_version_key" ON "ai_prompt_versions"("promptId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_daily_tenantId_userId_usageDate_key" ON "ai_usage_daily"("tenantId", "userId", "usageDate");

-- CreateIndex
CREATE UNIQUE INDEX "ai_user_settings_tenantId_userId_key" ON "ai_user_settings"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_tenant_settings_tenantId_key" ON "ai_tenant_settings"("tenantId");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_idx" ON "media_assets"("tenantId");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_category_idx" ON "media_assets"("tenantId", "category");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_ownerType_ownerId_idx" ON "media_assets"("tenantId", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_patientId_idx" ON "media_assets"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_status_idx" ON "media_assets"("tenantId", "status");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_comparisonGroupId_idx" ON "media_assets"("tenantId", "comparisonGroupId");

-- CreateIndex
CREATE INDEX "media_assets_deletedAt_idx" ON "media_assets"("deletedAt");

-- CreateIndex
CREATE INDEX "outbox_events_status_createdAt_idx" ON "outbox_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "outbox_events_tenantId_idx" ON "outbox_events"("tenantId");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_region_access" ADD CONSTRAINT "user_region_access_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_region_access" ADD CONSTRAINT "user_region_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_region_access" ADD CONSTRAINT "user_region_access_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_roles" ADD CONSTRAINT "user_custom_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_roles" ADD CONSTRAINT "user_custom_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_roles" ADD CONSTRAINT "user_custom_roles_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_filters" ADD CONSTRAINT "user_saved_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_filters" ADD CONSTRAINT "user_saved_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_weekly_schedules" ADD CONSTRAINT "staff_weekly_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_weekly_schedules" ADD CONSTRAINT "staff_weekly_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dashboard_layouts" ADD CONSTRAINT "user_dashboard_layouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dashboard_layouts" ADD CONSTRAINT "user_dashboard_layouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_backup_codes" ADD CONSTRAINT "mfa_backup_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_addresses" ADD CONSTRAINT "patient_addresses_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist" ADD CONSTRAINT "appointment_waitlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist" ADD CONSTRAINT "appointment_waitlist_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_resources" ADD CONSTRAINT "scheduling_resources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_templates" ADD CONSTRAINT "appointment_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_operating_hours" ADD CONSTRAINT "branch_operating_hours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_weekly_schedules" ADD CONSTRAINT "provider_weekly_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_events" ADD CONSTRAINT "encounter_events_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_templates" ADD CONSTRAINT "clinical_note_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_records" ADD CONSTRAINT "dental_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orthodontic_cases" ADD CONSTRAINT "orthodontic_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implant_records" ADD CONSTRAINT "implant_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_clinical_notes" ADD CONSTRAINT "dental_clinical_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_clinical_notes" ADD CONSTRAINT "dental_clinical_notes_dentalRecordId_fkey" FOREIGN KEY ("dentalRecordId") REFERENCES "dental_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_tooth_conditions" ADD CONSTRAINT "dental_tooth_conditions_dentalRecordId_fkey" FOREIGN KEY ("dentalRecordId") REFERENCES "dental_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_procedure_materials" ADD CONSTRAINT "dental_procedure_materials_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beauty_procedure_materials" ADD CONSTRAINT "beauty_procedure_materials_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_phases" ADD CONSTRAINT "treatment_phases_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "treatment_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_dependsOnItemId_fkey" FOREIGN KEY ("dependsOnItemId") REFERENCES "treatment_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontal_exams" ADD CONSTRAINT "periodontal_exams_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beauty_records" ADD CONSTRAINT "beauty_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beauty_annotations" ADD CONSTRAINT "beauty_annotations_beautyRecordId_fkey" FOREIGN KEY ("beautyRecordId") REFERENCES "beauty_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_suppliers" ADD CONSTRAINT "inventory_suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_consumption_logs" ADD CONSTRAINT "inventory_consumption_logs_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_consumption_logs" ADD CONSTRAINT "inventory_consumption_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_consumption_logs" ADD CONSTRAINT "inventory_consumption_logs_invoiceLineItemId_fkey" FOREIGN KEY ("invoiceLineItemId") REFERENCES "invoice_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_disposal_logs" ADD CONSTRAINT "inventory_disposal_logs_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_disposal_logs" ADD CONSTRAINT "inventory_disposal_logs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_warehouse_stock" ADD CONSTRAINT "inventory_warehouse_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_warehouse_stock" ADD CONSTRAINT "inventory_warehouse_stock_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfer_lines" ADD CONSTRAINT "inventory_stock_transfer_lines_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "inventory_stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfer_lines" ADD CONSTRAINT "inventory_stock_transfer_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_counts" ADD CONSTRAINT "inventory_stock_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_count_lines" ADD CONSTRAINT "inventory_stock_count_lines_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "inventory_stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_count_lines" ADD CONSTRAINT "inventory_stock_count_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_requests" ADD CONSTRAINT "inventory_stock_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_request_lines" ADD CONSTRAINT "inventory_stock_request_lines_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "inventory_stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_request_lines" ADD CONSTRAINT "inventory_stock_request_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "scheduling_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_ticket_events" ADD CONSTRAINT "queue_ticket_events_queueTicketId_fkey" FOREIGN KEY ("queueTicketId") REFERENCES "queue_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_billing_sequences" ADD CONSTRAINT "tenant_billing_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_refunds" ADD CONSTRAINT "invoice_refunds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_refunds" ADD CONSTRAINT "invoice_refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_refunds" ADD CONSTRAINT "invoice_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "invoice_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_write_offs" ADD CONSTRAINT "invoice_write_offs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_write_offs" ADD CONSTRAINT "invoice_write_offs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plan_installments" ADD CONSTRAINT "payment_plan_installments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "payment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_line_items" ADD CONSTRAINT "commission_line_items_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commission_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_subscriptions" ADD CONSTRAINT "clinic_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_subscriptions" ADD CONSTRAINT "clinic_subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_tenants" ADD CONSTRAINT "platform_tenants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privileged_access_grants" ADD CONSTRAINT "privileged_access_grants_platformTenantId_fkey" FOREIGN KEY ("platformTenantId") REFERENCES "platform_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_platformTenantId_fkey" FOREIGN KEY ("platformTenantId") REFERENCES "platform_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_accounts" ADD CONSTRAINT "portal_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_accounts" ADD CONSTRAINT "portal_accounts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_access_grants" ADD CONSTRAINT "caregiver_access_grants_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_reports" ADD CONSTRAINT "analytics_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_metrics" ADD CONSTRAINT "analytics_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_filter_presets" ADD CONSTRAINT "analytics_filter_presets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_layouts" ADD CONSTRAINT "analytics_layouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_dashboards" ADD CONSTRAINT "analytics_dashboards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_reports" ADD CONSTRAINT "operational_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_filter_presets" ADD CONSTRAINT "report_filter_presets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_custom_definitions" ADD CONSTRAINT "report_custom_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_automation_rules" ADD CONSTRAINT "notification_automation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_automation_rules" ADD CONSTRAINT "notification_automation_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_channel_configs" ADD CONSTRAINT "tenant_channel_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_saved_filters" ADD CONSTRAINT "notification_saved_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_automation_rules" ADD CONSTRAINT "workflow_automation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_automation_rules" ADD CONSTRAINT "workflow_automation_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_saved_filters" ADD CONSTRAINT "workflow_saved_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tenant_settings" ADD CONSTRAINT "ai_tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
