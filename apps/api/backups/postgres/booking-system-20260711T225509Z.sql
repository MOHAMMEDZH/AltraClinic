--
-- PostgreSQL database dump
--

\restrict k6rVQGQOvjJ0EeG8zM570SVEQfuPxZvYUPoFOTF9gLnfEKGxAF2vfKpsTBtbbsk

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AnalyticsReportFormat; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnalyticsReportFormat" AS ENUM (
    'PDF',
    'EXCEL',
    'CSV',
    'JSON'
);


--
-- Name: AnalyticsReportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnalyticsReportStatus" AS ENUM (
    'QUEUED',
    'GENERATING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: BranchAccessMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BranchAccessMode" AS ENUM (
    'SINGLE',
    'MULTI',
    'GLOBAL'
);


--
-- Name: EmploymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmploymentStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'ON_LEAVE',
    'ARCHIVED',
    'TERMINATED'
);


--
-- Name: StaffInvitationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StaffInvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'EXPIRED',
    'CANCELLED'
);


--
-- Name: TreatmentPlanItemStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TreatmentPlanItemStatus" AS ENUM (
    'PLANNED',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'BLOCKED'
);


--
-- Name: TreatmentPlanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TreatmentPlanStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: ai_model_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_model_status AS ENUM (
    'DRAFT',
    'VALIDATED',
    'DEPLOYED',
    'RETIRED'
);


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CHECKED_IN',
    'IN_PROGRESS',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW'
);


--
-- Name: beauty_comparison_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.beauty_comparison_role AS ENUM (
    'BEFORE',
    'AFTER'
);


--
-- Name: cash_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cash_session_status AS ENUM (
    'OPEN',
    'CLOSED',
    'RECONCILED'
);


--
-- Name: clinical_note_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinical_note_type AS ENUM (
    'SOAP',
    'PROGRESS',
    'CONSULTATION',
    'PROCEDURE',
    'FOLLOW_UP'
);


--
-- Name: commission_rate_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.commission_rate_type AS ENUM (
    'PERCENTAGE',
    'FIXED_AMOUNT'
);


--
-- Name: commission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.commission_status AS ENUM (
    'DRAFT',
    'CALCULATED',
    'APPROVED',
    'PAID',
    'DISPUTED'
);


--
-- Name: credit_note_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credit_note_status AS ENUM (
    'DRAFT',
    'ISSUED',
    'APPLIED',
    'CANCELLED'
);


--
-- Name: encounter_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.encounter_status AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'SIGNED'
);


--
-- Name: entitlement_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entitlement_plan AS ENUM (
    'LITE',
    'PRO',
    'ENTERPRISE'
);


--
-- Name: implant_record_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.implant_record_status AS ENUM (
    'PLANNED',
    'PLACED',
    'RESTORED',
    'FAILED'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'DRAFT',
    'ISSUED',
    'PARTIAL_PAID',
    'PAID',
    'OVERDUE',
    'CANCELLED',
    'WRITTEN_OFF'
);


--
-- Name: loyalty_reward_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_reward_status AS ENUM (
    'AVAILABLE',
    'EXPIRED',
    'REDEEMED'
);


--
-- Name: loyalty_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_tier AS ENUM (
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM'
);


--
-- Name: loyalty_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_transaction_type AS ENUM (
    'EARN',
    'REDEEM',
    'ADJUST',
    'EXPIRE'
);


--
-- Name: media_asset_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_asset_status AS ENUM (
    'PENDING_SCAN',
    'PROCESSING',
    'READY',
    'QUARANTINED',
    'DELETED'
);


--
-- Name: media_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_category AS ENUM (
    'PATIENT_ATTACHMENT',
    'MEDICAL_DOCUMENT',
    'DENTAL_IMAGE',
    'BEAUTY_BEFORE_AFTER',
    'INVOICE_ATTACHMENT'
);


--
-- Name: notification_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_category AS ENUM (
    'SYSTEM',
    'CLINICAL',
    'OPERATIONAL',
    'FINANCIAL',
    'INVENTORY',
    'SUBSCRIPTION',
    'SECURITY'
);


--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel AS ENUM (
    'EMAIL',
    'SMS',
    'PUSH',
    'IN_APP',
    'WHATSAPP'
);


--
-- Name: notification_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_status AS ENUM (
    'DRAFT',
    'QUEUED',
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED'
);


--
-- Name: odontogram_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.odontogram_mode AS ENUM (
    'ADULT',
    'PEDIATRIC'
);


--
-- Name: orthodontic_case_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orthodontic_case_status AS ENUM (
    'ACTIVE',
    'RETENTION',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: outbox_event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.outbox_event_status AS ENUM (
    'PENDING',
    'PUBLISHED',
    'FAILED'
);


--
-- Name: payment_plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_plan_status AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'DEFAULTED',
    'CANCELLED'
);


--
-- Name: platform_region; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_region AS ENUM (
    'ME_SOUTH',
    'ME_NORTH',
    'EU_WEST',
    'US_EAST',
    'GLOBAL'
);


--
-- Name: platform_tenant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_tenant_status AS ENUM (
    'PROVISIONING',
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);


--
-- Name: portal_account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.portal_account_status AS ENUM (
    'INVITED',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED'
);


--
-- Name: privileged_access_grant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.privileged_access_grant_status AS ENUM (
    'PENDING_APPROVAL',
    'ACTIVE',
    'REJECTED',
    'REVOKED'
);


--
-- Name: queue_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queue_priority AS ENUM (
    'NORMAL',
    'APPOINTMENT',
    'WALK_IN',
    'PRIORITY',
    'VIP',
    'EMERGENCY'
);


--
-- Name: queue_ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queue_ticket_status AS ENUM (
    'WAITING',
    'CALLED',
    'SERVING',
    'COMPLETED',
    'SKIPPED',
    'NO_SHOW',
    'CANCELLED',
    'TRANSFERRED'
);


--
-- Name: scheduling_resource_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scheduling_resource_type AS ENUM (
    'ROOM',
    'EQUIPMENT'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'TRIAL',
    'ACTIVE',
    'SUSPENDED',
    'EXPIRED',
    'CANCELLED'
);


--
-- Name: tenant_lifecycle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_lifecycle_status AS ENUM (
    'TRIAL',
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);


--
-- Name: tenant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'SUPER_ADMIN',
    'OWNER',
    'GENERAL_MANAGER',
    'BRANCH_MANAGER',
    'DOCTOR',
    'DENTIST',
    'SPECIALIST',
    'NURSE',
    'ASSISTANT',
    'RECEPTIONIST',
    'ACCOUNTANT',
    'INVENTORY_MANAGER',
    'LAB_TECHNICIAN',
    'RADIOLOGIST',
    'CASHIER',
    'HR',
    'MARKETING',
    'PATIENT'
);


--
-- Name: virus_scan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.virus_scan_status AS ENUM (
    'PENDING',
    'CLEAN',
    'INFECTED',
    'SKIPPED',
    'ERROR'
);


--
-- Name: waitlist_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.waitlist_status AS ENUM (
    'OPEN',
    'SCHEDULED',
    'CANCELLED'
);


--
-- Name: workflow_approval_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_approval_mode AS ENUM (
    'SINGLE',
    'SEQUENTIAL',
    'PARALLEL'
);


--
-- Name: workflow_approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_approval_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


--
-- Name: workflow_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_status AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
    'PAUSED'
);


--
-- Name: workflow_task_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_task_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


--
-- Name: workflow_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_task_status AS ENUM (
    'DRAFT',
    'PENDING',
    'ASSIGNED',
    'IN_PROGRESS',
    'WAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
    'CANCELLED',
    'OVERDUE',
    'ESCALATED'
);


--
-- Name: workflow_template_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_template_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ARCHIVED'
);


--
-- Name: app_rls_bypass(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_rls_bypass() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT current_setting('app.platform_rls_bypass', true) = 'true';
$$;


--
-- Name: app_rls_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_rls_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "branchId" uuid,
    title character varying(255) NOT NULL,
    "workspaceId" character varying(50),
    pinned boolean DEFAULT false NOT NULL,
    "contextJson" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.ai_conversations FORCE ROW LEVEL SECURITY;


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "conversationId" uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    "citationsJson" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "attachmentsJson" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tokenCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.ai_messages FORCE ROW LEVEL SECURITY;


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255) NOT NULL,
    "descriptionEn" text NOT NULL,
    "descriptionAr" text NOT NULL,
    "modelType" character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    status public.ai_model_status DEFAULT 'DRAFT'::public.ai_model_status NOT NULL,
    "createdBy" uuid NOT NULL,
    "validatedBy" uuid,
    "validatedAt" timestamp(3) without time zone,
    "validationNotes" text,
    "deployedBy" uuid,
    "deployedAt" timestamp(3) without time zone,
    "retiredBy" uuid,
    "retiredAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.ai_models FORCE ROW LEVEL SECURITY;


--
-- Name: ai_prompt_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompt_versions (
    id uuid NOT NULL,
    "promptId" uuid NOT NULL,
    version integer NOT NULL,
    category character varying(50) NOT NULL,
    "titleEn" character varying(255) NOT NULL,
    "titleAr" character varying(255),
    "bodyEn" text NOT NULL,
    "bodyAr" text,
    favorite boolean DEFAULT false NOT NULL,
    roles text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" uuid
);

ALTER TABLE ONLY public.ai_prompt_versions FORCE ROW LEVEL SECURITY;


--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid,
    category character varying(50) NOT NULL,
    "titleEn" character varying(255) NOT NULL,
    "titleAr" character varying(255),
    "bodyEn" text NOT NULL,
    "bodyAr" text,
    favorite boolean DEFAULT false NOT NULL,
    roles text[] DEFAULT ARRAY[]::text[],
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.ai_prompts FORCE ROW LEVEL SECURITY;


--
-- Name: ai_tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_tenant_settings (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "settingsJson" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.ai_tenant_settings FORCE ROW LEVEL SECURITY;


--
-- Name: ai_usage_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_daily (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "usageDate" date NOT NULL,
    "messageCount" integer DEFAULT 0 NOT NULL,
    "tokenCount" integer DEFAULT 0 NOT NULL,
    "successCount" integer DEFAULT 0 NOT NULL,
    "failureCount" integer DEFAULT 0 NOT NULL,
    "avgLatencyMs" integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.ai_usage_daily FORCE ROW LEVEL SECURITY;


--
-- Name: ai_user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_user_settings (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "preferencesJson" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.ai_user_settings FORCE ROW LEVEL SECURITY;


--
-- Name: analytics_dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_dashboards (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    name character varying(255) NOT NULL,
    description text,
    "dashboardType" character varying(50) NOT NULL,
    widgets jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdBy" uuid NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "favoriteCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.analytics_dashboards FORCE ROW LEVEL SECURITY;


--
-- Name: analytics_filter_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_filter_presets (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.analytics_filter_presets FORCE ROW LEVEL SECURITY;


--
-- Name: analytics_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_layouts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    profile character varying(64) NOT NULL,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.analytics_layouts FORCE ROW LEVEL SECURITY;


--
-- Name: analytics_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_metrics (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "metricName" character varying(120) NOT NULL,
    "metricValue" jsonb NOT NULL,
    "dimensionFilter" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "recordedAt" timestamp(3) without time zone NOT NULL,
    "recordedBy" uuid NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.analytics_metrics FORCE ROW LEVEL SECURITY;


--
-- Name: analytics_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_reports (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    name character varying(500) NOT NULL,
    description text,
    "reportType" character varying(50) NOT NULL,
    format public."AnalyticsReportFormat" NOT NULL,
    status public."AnalyticsReportStatus" DEFAULT 'QUEUED'::public."AnalyticsReportStatus" NOT NULL,
    "createdBy" uuid NOT NULL,
    parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "recipientEmails" text[] DEFAULT ARRAY[]::text[],
    "downloadUrl" character varying(1000),
    "rowCount" integer DEFAULT 0 NOT NULL,
    "isScheduled" boolean DEFAULT false NOT NULL,
    "scheduleFrequency" character varying(20),
    "lastScheduledRunAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.analytics_reports FORCE ROW LEVEL SECURITY;


--
-- Name: appointment_reminder_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_reminder_logs (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "appointmentId" uuid NOT NULL,
    "reminderType" character varying(20) NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.appointment_reminder_logs FORCE ROW LEVEL SECURITY;


--
-- Name: appointment_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_templates (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    name character varying(120) NOT NULL,
    "serviceType" character varying(100),
    "durationMin" integer DEFAULT 30 NOT NULL,
    "providerId" uuid,
    notes text,
    "isEmergency" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.appointment_templates FORCE ROW LEVEL SECURITY;


--
-- Name: appointment_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_waitlist (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "patientId" uuid NOT NULL,
    "providerId" uuid,
    "preferredDate" timestamp(3) without time zone,
    "durationMin" integer DEFAULT 30 NOT NULL,
    notes text,
    status public.waitlist_status DEFAULT 'OPEN'::public.waitlist_status NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.appointment_waitlist FORCE ROW LEVEL SECURITY;


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "patientId" uuid NOT NULL,
    "providerId" uuid NOT NULL,
    "scheduledStart" timestamp(3) without time zone NOT NULL,
    "scheduledEnd" timestamp(3) without time zone NOT NULL,
    status public.appointment_status DEFAULT 'PENDING'::public.appointment_status NOT NULL,
    notes text,
    "cancellationReason" character varying(500),
    "serviceType" character varying(100),
    "isEmergency" boolean DEFAULT false NOT NULL,
    "recurrenceSeriesId" uuid,
    "resourceId" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.appointments FORCE ROW LEVEL SECURITY;


--
-- Name: audit_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_entries (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    action character varying(100) NOT NULL,
    "resourceType" character varying(100) NOT NULL,
    "resourceId" uuid NOT NULL,
    "actorId" uuid NOT NULL,
    "actorRoles" text[],
    category character varying(50),
    "descriptionEn" text,
    "descriptionAr" text,
    reason text,
    changes jsonb,
    details jsonb,
    "ipAddress" character varying(45),
    "userAgent" text,
    "correlationId" uuid,
    locale character varying(5),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.audit_entries FORCE ROW LEVEL SECURITY;


--
-- Name: beauty_annotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beauty_annotations (
    id uuid NOT NULL,
    "beautyRecordId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    zone character varying(100) NOT NULL,
    treatment character varying(100) NOT NULL,
    coordinates jsonb NOT NULL,
    parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "encounterId" uuid,
    "recordedBy" uuid NOT NULL,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);

ALTER TABLE ONLY public.beauty_annotations FORCE ROW LEVEL SECURITY;


--
-- Name: beauty_procedure_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beauty_procedure_materials (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "procedureCode" character varying(30) NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "defaultQuantity" numeric(18,4) DEFAULT 1 NOT NULL,
    notes text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.beauty_procedure_materials FORCE ROW LEVEL SECURITY;


--
-- Name: beauty_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beauty_records (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "bodyMapState" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.beauty_records FORCE ROW LEVEL SECURITY;


--
-- Name: branch_operating_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_operating_hours (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "openHour" integer DEFAULT 7 NOT NULL,
    "openMin" integer DEFAULT 0 NOT NULL,
    "closeHour" integer DEFAULT 20 NOT NULL,
    "closeMin" integer DEFAULT 0 NOT NULL,
    "isClosed" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.branch_operating_hours FORCE ROW LEVEL SECURITY;


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "regionId" uuid,
    name character varying(255) NOT NULL,
    "nameAr" character varying(255),
    address text,
    city character varying(100),
    phone character varying(30),
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.branches FORCE ROW LEVEL SECURITY;


--
-- Name: caregiver_access_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caregiver_access_grants (
    id uuid NOT NULL,
    "portalAccountId" uuid NOT NULL,
    "caregiverContact" character varying(255) NOT NULL,
    "caregiverName" character varying(255) NOT NULL,
    scopes text[],
    "grantedBy" character varying(255) NOT NULL,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "revokedReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: cash_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_sessions (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "openedBy" uuid NOT NULL,
    "closedBy" uuid,
    status public.cash_session_status DEFAULT 'OPEN'::public.cash_session_status NOT NULL,
    "openingBalance" numeric(18,4) DEFAULT 0 NOT NULL,
    "expectedCash" numeric(18,4) DEFAULT 0 NOT NULL,
    "actualCash" numeric(18,4),
    variance numeric(18,4),
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.cash_sessions FORCE ROW LEVEL SECURITY;


--
-- Name: clinic_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_subscriptions (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "customerId" uuid NOT NULL,
    plan character varying(100) NOT NULL,
    status public.subscription_status DEFAULT 'ACTIVE'::public.subscription_status NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "autoRenew" boolean DEFAULT false NOT NULL,
    currency character varying(3) DEFAULT 'SYP'::character varying NOT NULL,
    "createdBy" uuid NOT NULL,
    "canceledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.clinic_subscriptions FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_note_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_note_templates (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    name character varying(200) NOT NULL,
    "noteType" public.clinical_note_type DEFAULT 'CONSULTATION'::public.clinical_note_type NOT NULL,
    "soapNotes" jsonb DEFAULT '{}'::jsonb NOT NULL,
    body text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.clinical_note_templates FORCE ROW LEVEL SECURITY;


--
-- Name: commission_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_calculations (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "providerId" uuid NOT NULL,
    "patientId" uuid,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    status public.commission_status DEFAULT 'CALCULATED'::public.commission_status NOT NULL,
    "totalRevenue" numeric(18,4) NOT NULL,
    "commissionAmount" numeric(18,4) NOT NULL,
    currency character varying(3) DEFAULT 'SYP'::character varying NOT NULL,
    "basisDocumentIds" text[],
    "paymentMethod" character varying(50),
    "paymentReference" character varying(255),
    "paymentDate" timestamp(3) without time zone,
    "disputeReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.commission_calculations FORCE ROW LEVEL SECURITY;


--
-- Name: commission_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_line_items (
    id uuid NOT NULL,
    "commissionId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "appointmentId" uuid,
    "serviceDescription" character varying(500) NOT NULL,
    "serviceType" character varying(100),
    amount numeric(18,4) NOT NULL,
    "commissionRateType" public.commission_rate_type NOT NULL,
    "commissionRateValue" numeric(10,4) NOT NULL,
    "minimumThreshold" numeric(18,4),
    "maximumCap" numeric(18,4),
    "commissionAmount" numeric(18,4) NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.commission_line_items FORCE ROW LEVEL SECURITY;


--
-- Name: commission_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_rules (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "providerId" uuid,
    "serviceType" character varying(100),
    "rateType" public.commission_rate_type NOT NULL,
    "rateValue" numeric(10,4) NOT NULL,
    "minimumThreshold" numeric(18,4),
    "maximumCap" numeric(18,4),
    "effectiveDate" date NOT NULL,
    "expiryDate" date,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.commission_rules FORCE ROW LEVEL SECURITY;


--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_notes (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "creditNoteNumber" character varying(50) NOT NULL,
    status public.credit_note_status DEFAULT 'DRAFT'::public.credit_note_status NOT NULL,
    amount numeric(18,4) NOT NULL,
    reason character varying(500) NOT NULL,
    "issuedAt" timestamp(3) without time zone,
    "appliedAt" timestamp(3) without time zone,
    "issuedBy" uuid,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.credit_notes FORCE ROW LEVEL SECURITY;


--
-- Name: custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_roles (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    permissions jsonb NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.custom_roles FORCE ROW LEVEL SECURITY;


--
-- Name: dental_clinical_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dental_clinical_notes (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "dentalRecordId" uuid,
    "encounterId" uuid,
    "noteType" character varying(30) DEFAULT 'progress'::character varying NOT NULL,
    content text NOT NULL,
    "authorId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.dental_clinical_notes FORCE ROW LEVEL SECURITY;


--
-- Name: dental_procedure_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dental_procedure_materials (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "procedureCode" character varying(30) NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "defaultQuantity" numeric(18,4) DEFAULT 1 NOT NULL,
    notes text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.dental_procedure_materials FORCE ROW LEVEL SECURITY;


--
-- Name: dental_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dental_records (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "odontogramMode" public.odontogram_mode DEFAULT 'ADULT'::public.odontogram_mode NOT NULL,
    "odontogramState" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.dental_records FORCE ROW LEVEL SECURITY;


--
-- Name: dental_tooth_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dental_tooth_conditions (
    id uuid NOT NULL,
    "dentalRecordId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "toothId" character varying(4) NOT NULL,
    surface character varying(20),
    "conditionCode" character varying(50) NOT NULL,
    notes text,
    "encounterId" uuid,
    "recordedBy" uuid NOT NULL,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.dental_tooth_conditions FORCE ROW LEVEL SECURITY;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    name character varying(255) NOT NULL,
    "nameAr" character varying(255),
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.departments FORCE ROW LEVEL SECURITY;


--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "tokenHash" character varying(64) NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.email_verification_tokens FORCE ROW LEVEL SECURITY;


--
-- Name: encounter_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounter_events (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "encounterId" uuid NOT NULL,
    action character varying(64) NOT NULL,
    "actorUserId" uuid,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.encounter_events FORCE ROW LEVEL SECURITY;


--
-- Name: encounters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounters (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "patientId" uuid NOT NULL,
    "appointmentId" uuid,
    "clinicianId" uuid NOT NULL,
    "chiefComplaint" text,
    diagnoses jsonb DEFAULT '[]'::jsonb NOT NULL,
    medications jsonb DEFAULT '[]'::jsonb NOT NULL,
    observations jsonb DEFAULT '[]'::jsonb NOT NULL,
    "soapNotes" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "structuredNotes" jsonb DEFAULT '[]'::jsonb NOT NULL,
    status public.encounter_status DEFAULT 'IN_PROGRESS'::public.encounter_status NOT NULL,
    "followUpDate" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "signedAt" timestamp(3) without time zone,
    "signedBy" uuid,
    "coSignedAt" timestamp(3) without time zone,
    "coSignedBy" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.encounters FORCE ROW LEVEL SECURITY;


--
-- Name: implant_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.implant_records (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "toothId" character varying(4) NOT NULL,
    "implantSystem" character varying(100),
    "implantDiameter" numeric(5,2),
    "implantLength" numeric(5,2),
    "abutmentType" character varying(100),
    status public.implant_record_status DEFAULT 'PLANNED'::public.implant_record_status NOT NULL,
    "placedAt" timestamp(3) without time zone,
    "restoredAt" timestamp(3) without time zone,
    notes text,
    "surgicalData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.implant_records FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_batches (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "lotNumber" character varying(100),
    "manufacturedDate" date,
    "expiryDate" date,
    "quantityOnHand" numeric(18,4) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_batches FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    key character varying(50) NOT NULL,
    "nameEn" character varying(100) NOT NULL,
    "nameAr" character varying(100),
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.inventory_categories FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_consumption_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_consumption_logs (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "encounterId" uuid,
    "patientId" uuid,
    "procedureCode" character varying(30),
    "quantityUsed" numeric(18,4) NOT NULL,
    "consumedBy" uuid NOT NULL,
    notes text,
    "consumedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "invoiceId" uuid,
    "invoiceLineItemId" uuid
);

ALTER TABLE ONLY public.inventory_consumption_logs FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_disposal_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_disposal_logs (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "batchId" uuid,
    quantity numeric(18,4) NOT NULL,
    reason character varying(255) NOT NULL,
    notes text,
    "disposedBy" uuid NOT NULL,
    "disposedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.inventory_disposal_logs FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "categoryId" uuid,
    sku character varying(100) NOT NULL,
    barcode character varying(100),
    brand character varying(100),
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255),
    unit character varying(30) NOT NULL,
    "quantityOnHand" numeric(18,4) DEFAULT 0 NOT NULL,
    "reorderThreshold" numeric(18,4) DEFAULT 0 NOT NULL,
    "minQuantity" numeric(18,4),
    "maxQuantity" numeric(18,4),
    "costPerUnit" numeric(18,4),
    "sellingPrice" numeric(18,4),
    "storageLocation" character varying(255),
    "expiryDate" date,
    "supplierId" uuid,
    "lotNumber" character varying(100),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.inventory_items FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_stock_count_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_count_lines (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "stockCountId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "systemQuantity" numeric(18,4) NOT NULL,
    "countedQuantity" numeric(18,4),
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_stock_count_lines FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_stock_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_counts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "countNumber" character varying(30) NOT NULL,
    "warehouseId" uuid NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    notes text,
    "requestedBy" uuid NOT NULL,
    "approvedBy" uuid,
    "approvedAt" timestamp(3) without time zone,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_stock_counts FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_movements (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "movementType" character varying(30) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    "quantityBefore" numeric(18,4) NOT NULL,
    "quantityAfter" numeric(18,4) NOT NULL,
    reason character varying(255),
    notes text,
    "encounterId" uuid,
    "patientId" uuid,
    "procedureCode" character varying(30),
    "warehouseId" uuid,
    "performedBy" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.inventory_stock_movements FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_stock_request_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_request_lines (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "stockRequestId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "quantityRequested" numeric(18,4) NOT NULL,
    "quantityFulfilled" numeric(18,4) DEFAULT 0 NOT NULL,
    notes text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_stock_request_lines FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_stock_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_requests (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "requestNumber" character varying(30) NOT NULL,
    "requestType" character varying(20) DEFAULT 'DEPARTMENT'::character varying NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    "departmentName" character varying(120),
    "patientId" uuid,
    "warehouseId" uuid,
    notes text,
    "requestedBy" uuid NOT NULL,
    "approvedBy" uuid,
    "approvedAt" timestamp(3) without time zone,
    "rejectedBy" uuid,
    "rejectedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "fulfilledBy" uuid,
    "fulfilledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_stock_requests FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_stock_transfer_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_transfer_lines (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "stockTransferId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    quantity numeric(18,4) NOT NULL,
    "quantityReceived" numeric(18,4) DEFAULT 0 NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_stock_transfer_lines FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_transfers (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "transferNumber" character varying(30) NOT NULL,
    "fromWarehouseId" uuid NOT NULL,
    "toWarehouseId" uuid NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    notes text,
    "requestedBy" uuid NOT NULL,
    "shippedAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_stock_transfers FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_suppliers (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    code character varying(50) NOT NULL,
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255),
    "contactName" character varying(255),
    email character varying(255),
    phone character varying(50),
    address character varying(500),
    "leadTimeDays" integer,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.inventory_suppliers FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_warehouse_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_warehouse_stock (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "warehouseId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "quantityOnHand" numeric(18,4) DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.inventory_warehouse_stock FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_warehouses (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    code character varying(50) NOT NULL,
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255),
    address character varying(500),
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.inventory_warehouses FORCE ROW LEVEL SECURITY;


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line_items (
    id uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    "unitPrice" numeric(18,4) NOT NULL,
    "discountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "taxPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    subtotal numeric(18,4) NOT NULL,
    "discountAmount" numeric(18,4) NOT NULL,
    "taxAmount" numeric(18,4) NOT NULL,
    "lineTotal" numeric(18,4) NOT NULL,
    "serviceCode" character varying(50),
    "encounterId" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.invoice_line_items FORCE ROW LEVEL SECURITY;


--
-- Name: invoice_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_payments (
    id uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    amount numeric(18,4) NOT NULL,
    "paymentMethod" character varying(50) NOT NULL,
    "paymentReference" character varying(255),
    "paymentDate" date NOT NULL,
    "recordedBy" uuid NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.invoice_payments FORCE ROW LEVEL SECURITY;


--
-- Name: invoice_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_refunds (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "paymentId" uuid,
    amount numeric(18,4) NOT NULL,
    reason character varying(500) NOT NULL,
    "refundMethod" character varying(50) NOT NULL,
    "refundReference" character varying(255),
    "refundDate" date NOT NULL,
    "approvedBy" uuid NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.invoice_refunds FORCE ROW LEVEL SECURITY;


--
-- Name: invoice_write_offs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_write_offs (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    amount numeric(18,4) NOT NULL,
    reason character varying(500) NOT NULL,
    "approvedBy" uuid NOT NULL,
    "writeOffDate" date NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.invoice_write_offs FORCE ROW LEVEL SECURITY;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "patientId" uuid NOT NULL,
    "invoiceNumber" character varying(50) NOT NULL,
    "invoiceDate" date NOT NULL,
    "dueDate" date,
    currency character varying(3) DEFAULT 'SYP'::character varying NOT NULL,
    status public.invoice_status DEFAULT 'DRAFT'::public.invoice_status NOT NULL,
    "amountSubtotal" numeric(18,4) DEFAULT 0 NOT NULL,
    "amountDiscount" numeric(18,4) DEFAULT 0 NOT NULL,
    "amountTax" numeric(18,4) DEFAULT 0 NOT NULL,
    "amountTotal" numeric(18,4) DEFAULT 0 NOT NULL,
    "amountPaid" numeric(18,4) DEFAULT 0 NOT NULL,
    "insuranceProvider" character varying(255),
    "insurancePolicyNumber" character varying(100),
    "insuranceAmount" numeric(18,4) DEFAULT 0 NOT NULL,
    "patientResponsibility" numeric(18,4) DEFAULT 0 NOT NULL,
    "insuranceClaimStatus" character varying(50),
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.invoices FORCE ROW LEVEL SECURITY;


--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_results (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "encounterId" uuid,
    "testName" character varying(200) NOT NULL,
    value character varying(100) NOT NULL,
    unit character varying(50),
    "referenceRange" character varying(100),
    status character varying(30),
    "resultedAt" timestamp(3) without time zone NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.lab_results FORCE ROW LEVEL SECURITY;


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempts (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    "tenantId" uuid,
    "ipAddress" character varying(45) NOT NULL,
    "userAgent" text,
    success boolean NOT NULL,
    "failReason" character varying(100),
    "attemptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.login_attempts FORCE ROW LEVEL SECURITY;


--
-- Name: loyalty_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_accounts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "clinicId" uuid NOT NULL,
    "pointsBalance" integer DEFAULT 0 NOT NULL,
    "lifetimePointsEarned" integer DEFAULT 0 NOT NULL,
    tier public.loyalty_tier DEFAULT 'BRONZE'::public.loyalty_tier NOT NULL,
    "enrollmentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastActivityDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.loyalty_accounts FORCE ROW LEVEL SECURITY;


--
-- Name: loyalty_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_rewards (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "accountId" uuid NOT NULL,
    "pointsRequired" integer NOT NULL,
    description text NOT NULL,
    metadata jsonb,
    "expiryDate" timestamp(3) without time zone,
    status public.loyalty_reward_status DEFAULT 'AVAILABLE'::public.loyalty_reward_status NOT NULL,
    "redeemedDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.loyalty_rewards FORCE ROW LEVEL SECURITY;


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id uuid NOT NULL,
    "accountId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    type public.loyalty_transaction_type NOT NULL,
    "pointsAmount" integer NOT NULL,
    reference character varying(255),
    description text,
    "balanceAfter" integer,
    "transactionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.loyalty_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_assets (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    category public.media_category NOT NULL,
    "ownerType" character varying(50) NOT NULL,
    "ownerId" uuid NOT NULL,
    "patientId" uuid,
    "originalFilename" character varying(500) NOT NULL,
    "mimeType" character varying(127) NOT NULL,
    "sizeBytes" bigint NOT NULL,
    status public.media_asset_status DEFAULT 'PENDING_SCAN'::public.media_asset_status NOT NULL,
    "virusScanStatus" public.virus_scan_status DEFAULT 'PENDING'::public.virus_scan_status NOT NULL,
    "storageKey" character varying(1000) NOT NULL,
    variants jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "comparisonGroupId" uuid,
    "comparisonRole" public.beauty_comparison_role,
    "uploadedBy" uuid NOT NULL,
    "quarantineReason" text,
    "processedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.media_assets FORCE ROW LEVEL SECURITY;


--
-- Name: mfa_backup_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfa_backup_codes (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "codeHash" character varying(64) NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.mfa_backup_codes FORCE ROW LEVEL SECURITY;


--
-- Name: notification_automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_automation_rules (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    "nameAr" character varying(255),
    "eventType" character varying(100) NOT NULL,
    channel public.notification_channel NOT NULL,
    "templateId" uuid,
    "isActive" boolean DEFAULT true NOT NULL,
    schedule character varying(100),
    "recipientRoles" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdBy" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.notification_automation_rules FORCE ROW LEVEL SECURITY;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid,
    "patientId" uuid,
    "channelSettings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "categorySettings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "quietHoursStart" character varying(5),
    "quietHoursEnd" character varying(5),
    timezone character varying(64),
    language character varying(10),
    "frequencyLimit" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.notification_preferences FORCE ROW LEVEL SECURITY;


--
-- Name: notification_saved_filters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_saved_filters (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    name character varying(100) NOT NULL,
    filters jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.notification_saved_filters FORCE ROW LEVEL SECURITY;


--
-- Name: notification_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_template_versions (
    id uuid NOT NULL,
    "templateId" uuid NOT NULL,
    version integer NOT NULL,
    "subjectEn" character varying(500) NOT NULL,
    "subjectAr" character varying(500),
    "bodyEn" text NOT NULL,
    "bodyAr" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" uuid
);

ALTER TABLE ONLY public.notification_template_versions FORCE ROW LEVEL SECURITY;


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_templates (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    "nameAr" character varying(255),
    channel public.notification_channel NOT NULL,
    category public.notification_category DEFAULT 'SYSTEM'::public.notification_category NOT NULL,
    "subjectEn" character varying(500) NOT NULL,
    "subjectAr" character varying(500),
    "bodyEn" text NOT NULL,
    "bodyAr" text,
    variables jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" uuid,
    "updatedBy" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.notification_templates FORCE ROW LEVEL SECURITY;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "recipientId" uuid NOT NULL,
    channel public.notification_channel NOT NULL,
    category public.notification_category,
    "eventType" character varying(100),
    "templateId" uuid,
    title character varying(500) NOT NULL,
    body text NOT NULL,
    priority public.notification_priority DEFAULT 'MEDIUM'::public.notification_priority NOT NULL,
    status public.notification_status DEFAULT 'QUEUED'::public.notification_status NOT NULL,
    "isStarred" boolean DEFAULT false NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL,
    "failureReason" character varying(500),
    "retryCount" integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    "sentAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "readAt" timestamp(3) without time zone,
    "scheduledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.notifications FORCE ROW LEVEL SECURITY;


--
-- Name: operational_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_reports (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    name character varying(500) NOT NULL,
    "reportType" character varying(80) NOT NULL,
    format character varying(20) NOT NULL,
    status public."AnalyticsReportStatus" DEFAULT 'QUEUED'::public."AnalyticsReportStatus" NOT NULL,
    "createdBy" uuid NOT NULL,
    parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "dateStart" timestamp(3) without time zone,
    "dateEnd" timestamp(3) without time zone,
    "downloadUrl" character varying(1000),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.operational_reports FORCE ROW LEVEL SECURITY;


--
-- Name: orthodontic_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orthodontic_cases (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    status public.orthodontic_case_status DEFAULT 'ACTIVE'::public.orthodontic_case_status NOT NULL,
    "applianceType" character varying(50) NOT NULL,
    "startDate" timestamp(3) without time zone,
    "estimatedEndDate" timestamp(3) without time zone,
    notes text,
    "clinicalData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.orthodontic_cases FORCE ROW LEVEL SECURITY;


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    id uuid NOT NULL,
    "tenantId" uuid,
    "eventType" character varying(100) NOT NULL,
    "aggregateType" character varying(100) NOT NULL,
    "aggregateId" uuid NOT NULL,
    payload jsonb NOT NULL,
    status public.outbox_event_status DEFAULT 'PENDING'::public.outbox_event_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "lastAttemptAt" timestamp(3) without time zone,
    "publishedAt" timestamp(3) without time zone,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.outbox_events FORCE ROW LEVEL SECURITY;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "tokenHash" character varying(64) NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "ipAddress" character varying(45),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.password_reset_tokens FORCE ROW LEVEL SECURITY;


--
-- Name: patient_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_addresses (
    id uuid NOT NULL,
    "patientId" uuid NOT NULL,
    line1 character varying(255) NOT NULL,
    line2 character varying(255),
    city character varying(100) NOT NULL,
    state character varying(100),
    "postalCode" character varying(20),
    country character varying(2) DEFAULT 'SY'::character varying NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.patient_addresses FORCE ROW LEVEL SECURITY;


--
-- Name: patient_problems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_problems (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    code character varying(20),
    "codingSystem" character varying(32) DEFAULT 'ICD-10'::character varying,
    description character varying(500) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "onsetDate" timestamp(3) without time zone,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.patient_problems FORCE ROW LEVEL SECURITY;


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "firstName" character varying(100) NOT NULL,
    "lastName" character varying(100) NOT NULL,
    "firstNameAr" character varying(100),
    "lastNameAr" character varying(100),
    "dateOfBirth" date,
    gender character varying(10),
    phone character varying(30),
    email character varying(255),
    "nationalId" character varying(50),
    "bloodGroup" character varying(5),
    notes text,
    "profileData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.patients FORCE ROW LEVEL SECURITY;


--
-- Name: payment_plan_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_plan_installments (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "planId" uuid NOT NULL,
    sequence integer NOT NULL,
    "dueDate" date NOT NULL,
    amount numeric(18,4) NOT NULL,
    "paidAmount" numeric(18,4) DEFAULT 0 NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "paymentId" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.payment_plan_installments FORCE ROW LEVEL SECURITY;


--
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_plans (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    status public.payment_plan_status DEFAULT 'ACTIVE'::public.payment_plan_status NOT NULL,
    "totalAmount" numeric(18,4) NOT NULL,
    "installmentCount" integer NOT NULL,
    currency character varying(3) DEFAULT 'SYP'::character varying NOT NULL,
    "startDate" date NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.payment_plans FORCE ROW LEVEL SECURITY;


--
-- Name: payment_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_receipts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "paymentId" uuid,
    "receiptNumber" character varying(50) NOT NULL,
    amount numeric(18,4) NOT NULL,
    currency character varying(3) DEFAULT 'SYP'::character varying NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "issuedBy" uuid NOT NULL
);

ALTER TABLE ONLY public.payment_receipts FORCE ROW LEVEL SECURITY;


--
-- Name: periodontal_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.periodontal_exams (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "recordedBy" uuid NOT NULL,
    "examDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    "chartData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.periodontal_exams FORCE ROW LEVEL SECURITY;


--
-- Name: platform_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_subscriptions (
    id uuid NOT NULL,
    "platformTenantId" uuid NOT NULL,
    plan public.entitlement_plan NOT NULL,
    status public.subscription_status NOT NULL,
    "billingCycleMonths" integer DEFAULT 12 NOT NULL,
    "pricePerMonth" numeric(18,4) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "paidManuallyBy" uuid,
    "paidManuallyAt" timestamp(3) without time zone,
    "paymentReference" character varying(255),
    "paymentNotes" text,
    "autoRenew" boolean DEFAULT false NOT NULL,
    "renewalAttemptedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: platform_tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenants (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "displayName" character varying(255) NOT NULL,
    region public.platform_region NOT NULL,
    plan public.entitlement_plan DEFAULT 'LITE'::public.entitlement_plan NOT NULL,
    "maxBranches" integer,
    "maxUsers" integer,
    status public.platform_tenant_status DEFAULT 'PROVISIONING'::public.platform_tenant_status NOT NULL,
    "provisionedBy" uuid NOT NULL,
    "activatedAt" timestamp(3) without time zone,
    "suspendedAt" timestamp(3) without time zone,
    "suspensionReason" text,
    "archivedAt" timestamp(3) without time zone,
    "archivedReason" text,
    "trialEndsAt" timestamp(3) without time zone,
    "contractStartDate" timestamp(3) without time zone,
    "contractEndDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: portal_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_accounts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "patientId" uuid NOT NULL,
    "userId" uuid,
    status public.portal_account_status DEFAULT 'INVITED'::public.portal_account_status NOT NULL,
    locale character varying(5) DEFAULT 'en'::character varying NOT NULL,
    "notifyEmail" boolean DEFAULT true NOT NULL,
    "notifySms" boolean DEFAULT false NOT NULL,
    "notifyPush" boolean DEFAULT false NOT NULL,
    "invitedBy" uuid NOT NULL,
    "activatedAt" timestamp(3) without time zone,
    "suspendedAt" timestamp(3) without time zone,
    "suspensionReason" text,
    "deactivatedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.portal_accounts FORCE ROW LEVEL SECURITY;


--
-- Name: privileged_access_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.privileged_access_grants (
    id uuid NOT NULL,
    "platformTenantId" uuid NOT NULL,
    "adminId" uuid NOT NULL,
    "adminName" character varying(255) NOT NULL,
    scopes text[],
    justification text NOT NULL,
    status public.privileged_access_grant_status DEFAULT 'PENDING_APPROVAL'::public.privileged_access_grant_status NOT NULL,
    "breakGlass" boolean DEFAULT false NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "approvedBy" uuid,
    "approvedAt" timestamp(3) without time zone,
    "rejectedBy" uuid,
    "rejectedAt" timestamp(3) without time zone,
    "rejectedReason" text,
    "revokedAt" timestamp(3) without time zone,
    "revokedReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: provider_weekly_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_weekly_schedules (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "providerId" uuid NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "startHour" integer DEFAULT 9 NOT NULL,
    "startMin" integer DEFAULT 0 NOT NULL,
    "endHour" integer DEFAULT 17 NOT NULL,
    "endMin" integer DEFAULT 0 NOT NULL,
    "isOff" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.provider_weekly_schedules FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_lines (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "purchaseOrderId" uuid NOT NULL,
    "inventoryItemId" uuid NOT NULL,
    "quantityOrdered" numeric(18,4) NOT NULL,
    "quantityReceived" numeric(18,4) DEFAULT 0 NOT NULL,
    "unitCost" numeric(18,4),
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.purchase_order_lines FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "poNumber" character varying(30) NOT NULL,
    "supplierId" uuid,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    notes text,
    "requestedBy" uuid NOT NULL,
    "approvedBy" uuid,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.purchase_orders FORCE ROW LEVEL SECURITY;


--
-- Name: queue_ticket_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_ticket_events (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "queueTicketId" uuid NOT NULL,
    action character varying(64) NOT NULL,
    "fromStatus" character varying(32),
    "toStatus" character varying(32),
    "actorUserId" uuid,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.queue_ticket_events FORCE ROW LEVEL SECURITY;


--
-- Name: queue_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_tickets (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "appointmentId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "providerId" uuid NOT NULL,
    "scheduledStart" timestamp(3) without time zone NOT NULL,
    "scheduledEnd" timestamp(3) without time zone NOT NULL,
    status public.queue_ticket_status DEFAULT 'WAITING'::public.queue_ticket_status NOT NULL,
    priority public.queue_priority DEFAULT 'NORMAL'::public.queue_priority NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "checkedInAt" timestamp(3) without time zone,
    "calledAt" timestamp(3) without time zone,
    "servedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "waitTimeSeconds" integer,
    "resourceId" uuid,
    "etaAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.queue_tickets FORCE ROW LEVEL SECURITY;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "tokenHash" character varying(64) NOT NULL,
    "sessionId" uuid NOT NULL,
    "deviceName" character varying(255),
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "ipAddress" character varying(45),
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.refresh_tokens FORCE ROW LEVEL SECURITY;


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    "nameAr" character varying(255),
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.regions FORCE ROW LEVEL SECURITY;


--
-- Name: report_custom_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_custom_definitions (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    "reportType" character varying(50) NOT NULL,
    format character varying(20) NOT NULL,
    visualization character varying(20) NOT NULL,
    dataset character varying(50) NOT NULL,
    dimensions text[] DEFAULT ARRAY[]::text[],
    measures text[] DEFAULT ARRAY[]::text[],
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isScheduled" boolean DEFAULT false NOT NULL,
    "scheduleFrequency" character varying(20),
    "recipientEmails" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.report_custom_definitions FORCE ROW LEVEL SECURITY;


--
-- Name: report_filter_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_filter_presets (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.report_filter_presets FORCE ROW LEVEL SECURITY;


--
-- Name: report_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_shares (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "reportId" uuid NOT NULL,
    "reportKind" character varying(20) NOT NULL,
    "targetType" character varying(20) NOT NULL,
    "targetId" character varying(255) NOT NULL,
    access character varying(20) NOT NULL,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.report_shares FORCE ROW LEVEL SECURITY;


--
-- Name: scheduling_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduling_resources (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    name character varying(120) NOT NULL,
    "resourceType" public.scheduling_resource_type NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.scheduling_resources FORCE ROW LEVEL SECURITY;


--
-- Name: service_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_prices (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "serviceCode" character varying(50) NOT NULL,
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255),
    "unitPrice" numeric(18,4) NOT NULL,
    currency character varying(3) DEFAULT 'SYP'::character varying NOT NULL,
    "taxPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.service_prices FORCE ROW LEVEL SECURITY;


--
-- Name: staff_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_invitations (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    email character varying(255) NOT NULL,
    roles jsonb NOT NULL,
    "firstName" character varying(100),
    "lastName" character varying(100),
    "firstNameAr" character varying(100),
    "lastNameAr" character varying(100),
    phone character varying(30),
    "invitedBy" uuid NOT NULL,
    status public."StaffInvitationStatus" DEFAULT 'PENDING'::public."StaffInvitationStatus" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "userId" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.staff_invitations FORCE ROW LEVEL SECURITY;


--
-- Name: staff_weekly_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_weekly_schedules (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "startHour" integer DEFAULT 9 NOT NULL,
    "startMin" integer DEFAULT 0 NOT NULL,
    "endHour" integer DEFAULT 17 NOT NULL,
    "endMin" integer DEFAULT 0 NOT NULL,
    "isOff" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.staff_weekly_schedules FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_billing_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_billing_sequences (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    prefix character varying(20) DEFAULT 'INV'::character varying NOT NULL,
    "lastNumber" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.tenant_billing_sequences FORCE ROW LEVEL SECURITY;


--
-- Name: tenant_channel_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_channel_configs (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    channel public.notification_channel NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    provider character varying(100),
    "providerStatus" character varying(50) DEFAULT 'unknown'::character varying NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.tenant_channel_configs FORCE ROW LEVEL SECURITY;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    "customDomain" character varying(255),
    status public.tenant_status DEFAULT 'ACTIVE'::public.tenant_status NOT NULL,
    "lifecycleStatus" public.tenant_lifecycle_status DEFAULT 'TRIAL'::public.tenant_lifecycle_status NOT NULL,
    timezone character varying(50) DEFAULT 'UTC'::character varying NOT NULL,
    locale character varying(10) DEFAULT 'ar-SY'::character varying NOT NULL,
    "dataRetentionDays" integer DEFAULT 365 NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    "trialStartedAt" timestamp(3) without time zone,
    "trialEndsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: treatment_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_phases (
    id uuid NOT NULL,
    "planId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    name character varying(120) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "visitNumber" integer,
    "estimatedVisitDate" timestamp(3) without time zone,
    "clinicalNotes" text
);

ALTER TABLE ONLY public.treatment_phases FORCE ROW LEVEL SECURITY;


--
-- Name: treatment_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_plan_items (
    id uuid NOT NULL,
    "phaseId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    code character varying(20) NOT NULL,
    description character varying(500) NOT NULL,
    "toothNumbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
    status public."TreatmentPlanItemStatus" DEFAULT 'PLANNED'::public."TreatmentPlanItemStatus" NOT NULL,
    "estimatedMinutes" integer DEFAULT 30 NOT NULL,
    "estimatedCost" numeric(12,2) DEFAULT 0 NOT NULL,
    "dependsOnItemId" uuid,
    "completedAt" timestamp(3) without time zone,
    "completedBy" uuid,
    "encounterId" uuid,
    "insuranceEligible" boolean DEFAULT true NOT NULL,
    "insuranceEstimate" numeric(12,2),
    "patientPortion" numeric(12,2),
    "requiresPreAuth" boolean DEFAULT false NOT NULL,
    "preAuthStatus" character varying(30)
);

ALTER TABLE ONLY public.treatment_plan_items FORCE ROW LEVEL SECURITY;


--
-- Name: treatment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_plans (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    title character varying(200) NOT NULL,
    status public."TreatmentPlanStatus" DEFAULT 'DRAFT'::public."TreatmentPlanStatus" NOT NULL,
    "clinicalNotes" text,
    "totalEstimatedCost" numeric(12,2),
    "totalEstimatedMinutes" integer DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "consentSignedAt" timestamp(3) without time zone,
    "consentRecordedBy" uuid,
    "consentMethod" character varying(50),
    "approvedAt" timestamp(3) without time zone,
    "approvedBy" uuid,
    "submittedAt" timestamp(3) without time zone,
    "submittedBy" uuid,
    "insuranceSnapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.treatment_plans FORCE ROW LEVEL SECURITY;


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_devices (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "tokenHash" character varying(64) NOT NULL,
    "deviceName" character varying(255),
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "lastUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.trusted_devices FORCE ROW LEVEL SECURITY;


--
-- Name: user_branch_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_branch_access (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "branchId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.user_branch_access FORCE ROW LEVEL SECURITY;


--
-- Name: user_custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_custom_roles (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "customRoleId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.user_custom_roles FORCE ROW LEVEL SECURITY;


--
-- Name: user_dashboard_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_dashboard_layouts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    profile character varying(50) NOT NULL,
    layout jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.user_dashboard_layouts FORCE ROW LEVEL SECURITY;


--
-- Name: user_device_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_device_tokens (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    platform character varying(20) NOT NULL,
    token character varying(512) NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.user_device_tokens FORCE ROW LEVEL SECURITY;


--
-- Name: user_region_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_region_access (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "regionId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.user_region_access FORCE ROW LEVEL SECURITY;


--
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_assignments (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    role public.user_role NOT NULL,
    "grantedBy" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.user_role_assignments FORCE ROW LEVEL SECURITY;


--
-- Name: user_saved_filters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_saved_filters (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    name character varying(120) NOT NULL,
    filters jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.user_saved_filters FORCE ROW LEVEL SECURITY;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    email character varying(255) NOT NULL,
    "passwordHash" character varying(255) NOT NULL,
    "firstName" character varying(100) NOT NULL,
    "lastName" character varying(100) NOT NULL,
    "firstNameAr" character varying(100),
    "lastNameAr" character varying(100),
    phone character varying(30),
    "jobTitle" character varying(120),
    "departmentId" uuid,
    "managerId" uuid,
    "startDate" date,
    "employmentStatus" public."EmploymentStatus" DEFAULT 'ACTIVE'::public."EmploymentStatus" NOT NULL,
    timezone character varying(64),
    languages jsonb,
    "avatarUrl" character varying(512),
    notes text,
    "emergencyContactName" character varying(120),
    "emergencyContactPhone" character varying(30),
    "branchAccessMode" public."BranchAccessMode" DEFAULT 'SINGLE'::public."BranchAccessMode" NOT NULL,
    "suspendedAt" timestamp(3) without time zone,
    "archivedAt" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "mfaEnabled" boolean DEFAULT false NOT NULL,
    "mfaSecret" character varying(88),
    "lockedUntil" timestamp(3) without time zone,
    "failedLoginCount" integer DEFAULT 0 NOT NULL,
    "passwordChangedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "lastLoginIp" character varying(45),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_approvals (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "workflowId" uuid,
    title character varying(500) NOT NULL,
    "titleAr" character varying(500),
    status public.workflow_approval_status DEFAULT 'PENDING'::public.workflow_approval_status NOT NULL,
    mode public.workflow_approval_mode DEFAULT 'SINGLE'::public.workflow_approval_mode NOT NULL,
    category character varying(50),
    "requestedBy" uuid NOT NULL,
    "approverRoles" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "approverIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "approvedBy" uuid,
    "rejectedBy" uuid,
    comment text,
    "rejectionReason" text,
    "dueAt" timestamp(3) without time zone,
    "decidedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.workflow_approvals FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_automation_rules (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "templateId" uuid,
    name character varying(255) NOT NULL,
    "nameAr" character varying(255),
    "eventType" character varying(100) NOT NULL,
    "actionType" character varying(50) NOT NULL,
    "actionConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.workflow_automation_rules FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_execution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_execution_logs (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "workflowId" uuid NOT NULL,
    "stepIndex" integer,
    "eventType" character varying(100) NOT NULL,
    "actorId" uuid,
    details jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.workflow_execution_logs FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_saved_filters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_saved_filters (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    name character varying(100) NOT NULL,
    filters jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.workflow_saved_filters FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_tasks (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "workflowId" uuid,
    title character varying(500) NOT NULL,
    "titleAr" character varying(500),
    description text,
    status public.workflow_task_status DEFAULT 'PENDING'::public.workflow_task_status NOT NULL,
    priority public.workflow_task_priority DEFAULT 'MEDIUM'::public.workflow_task_priority NOT NULL,
    "assigneeId" uuid,
    "assignedBy" uuid,
    "dueAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.workflow_tasks FORCE ROW LEVEL SECURITY;


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    key character varying(100) NOT NULL,
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255),
    "descriptionEn" text,
    "descriptionAr" text,
    category character varying(50),
    "triggerType" character varying(100) NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status public.workflow_template_status DEFAULT 'DRAFT'::public.workflow_template_status NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "slaHours" integer,
    "createdBy" uuid,
    "updatedBy" uuid,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.workflow_templates FORCE ROW LEVEL SECURITY;


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "branchId" uuid,
    "templateId" uuid,
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255) NOT NULL,
    "descriptionEn" text NOT NULL,
    "descriptionAr" text NOT NULL,
    steps text[],
    "currentStepIndex" integer DEFAULT 0 NOT NULL,
    status public.workflow_status DEFAULT 'ACTIVE'::public.workflow_status NOT NULL,
    "triggerType" character varying(100),
    priority public.workflow_task_priority DEFAULT 'MEDIUM'::public.workflow_task_priority,
    "assigneeId" uuid,
    "dueAt" timestamp(3) without time zone,
    "dataContext" jsonb,
    "createdBy" uuid NOT NULL,
    "canceledBy" uuid,
    "canceledAt" timestamp(3) without time zone,
    "cancelReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.workflows FORCE ROW LEVEL SECURITY;


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
cd6b19f3-6b52-4319-916d-b8a1639d8632	55c920c3ec3d22fe059541dd2c8ed29f3c0e70039e24310c0710630d650b360f	2026-07-11 20:54:08.868892+00	20260709000000_baseline	\N	\N	2026-07-11 20:54:05.329059+00	1
\.


--
-- Data for Name: ai_conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_conversations (id, "tenantId", "userId", "branchId", title, "workspaceId", pinned, "contextJson", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ai_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_messages (id, "tenantId", "conversationId", role, content, "citationsJson", "attachmentsJson", "tokenCount", "createdAt") FROM stdin;
\.


--
-- Data for Name: ai_models; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_models (id, "tenantId", "branchId", "nameEn", "nameAr", "descriptionEn", "descriptionAr", "modelType", version, status, "createdBy", "validatedBy", "validatedAt", "validationNotes", "deployedBy", "deployedAt", "retiredBy", "retiredAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ai_prompt_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_prompt_versions (id, "promptId", version, category, "titleEn", "titleAr", "bodyEn", "bodyAr", favorite, roles, "createdAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: ai_prompts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_prompts (id, "tenantId", "userId", category, "titleEn", "titleAr", "bodyEn", "bodyAr", favorite, roles, version, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ai_tenant_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_tenant_settings (id, "tenantId", "settingsJson", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ai_usage_daily; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_usage_daily (id, "tenantId", "userId", "usageDate", "messageCount", "tokenCount", "successCount", "failureCount", "avgLatencyMs") FROM stdin;
\.


--
-- Data for Name: ai_user_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_user_settings (id, "tenantId", "userId", "preferencesJson", "updatedAt") FROM stdin;
\.


--
-- Data for Name: analytics_dashboards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analytics_dashboards (id, "tenantId", "branchId", name, description, "dashboardType", widgets, "createdBy", "isDefault", "isPublic", "favoriteCount", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: analytics_filter_presets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analytics_filter_presets (id, "tenantId", "userId", name, filters, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: analytics_layouts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analytics_layouts (id, "tenantId", "userId", profile, layout, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: analytics_metrics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analytics_metrics (id, "tenantId", "branchId", "metricName", "metricValue", "dimensionFilter", "recordedAt", "recordedBy", tags, metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: analytics_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analytics_reports (id, "tenantId", "branchId", name, description, "reportType", format, status, "createdBy", parameters, "recipientEmails", "downloadUrl", "rowCount", "isScheduled", "scheduleFrequency", "lastScheduledRunAt", "createdAt", "updatedAt", "completedAt") FROM stdin;
\.


--
-- Data for Name: appointment_reminder_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_reminder_logs (id, "tenantId", "appointmentId", "reminderType", "sentAt") FROM stdin;
\.


--
-- Data for Name: appointment_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_templates (id, "tenantId", "branchId", name, "serviceType", "durationMin", "providerId", notes, "isEmergency", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: appointment_waitlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_waitlist (id, "tenantId", "branchId", "patientId", "providerId", "preferredDate", "durationMin", notes, status, "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointments (id, "tenantId", "branchId", "patientId", "providerId", "scheduledStart", "scheduledEnd", status, notes, "cancellationReason", "serviceType", "isEmergency", "recurrenceSeriesId", "resourceId", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: audit_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_entries (id, "tenantId", "branchId", action, "resourceType", "resourceId", "actorId", "actorRoles", category, "descriptionEn", "descriptionAr", reason, changes, details, "ipAddress", "userAgent", "correlationId", locale, "createdAt") FROM stdin;
\.


--
-- Data for Name: beauty_annotations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.beauty_annotations (id, "beautyRecordId", "tenantId", zone, treatment, coordinates, parameters, "encounterId", "recordedBy", "recordedAt", notes) FROM stdin;
\.


--
-- Data for Name: beauty_procedure_materials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.beauty_procedure_materials (id, "tenantId", "procedureCode", "inventoryItemId", "defaultQuantity", notes, "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: beauty_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.beauty_records (id, "tenantId", "patientId", "bodyMapState", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: branch_operating_hours; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branch_operating_hours (id, "tenantId", "branchId", "dayOfWeek", "openHour", "openMin", "closeHour", "closeMin", "isClosed", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branches (id, "tenantId", "regionId", name, "nameAr", address, city, phone, "isActive", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: caregiver_access_grants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.caregiver_access_grants (id, "portalAccountId", "caregiverContact", "caregiverName", scopes, "grantedBy", "grantedAt", "expiresAt", "revokedAt", "revokedReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: cash_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cash_sessions (id, "tenantId", "branchId", "openedBy", "closedBy", status, "openingBalance", "expectedCash", "actualCash", variance, "openedAt", "closedAt", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: clinic_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clinic_subscriptions (id, "tenantId", "branchId", "customerId", plan, status, "startDate", "endDate", "autoRenew", currency, "createdBy", "canceledAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: clinical_note_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clinical_note_templates (id, "tenantId", name, "noteType", "soapNotes", body, "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: commission_calculations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_calculations (id, "tenantId", "branchId", "providerId", "patientId", "periodStart", "periodEnd", status, "totalRevenue", "commissionAmount", currency, "basisDocumentIds", "paymentMethod", "paymentReference", "paymentDate", "disputeReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: commission_line_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_line_items (id, "commissionId", "tenantId", "appointmentId", "serviceDescription", "serviceType", amount, "commissionRateType", "commissionRateValue", "minimumThreshold", "maximumCap", "commissionAmount", date, "createdAt") FROM stdin;
\.


--
-- Data for Name: commission_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commission_rules (id, "tenantId", "providerId", "serviceType", "rateType", "rateValue", "minimumThreshold", "maximumCap", "effectiveDate", "expiryDate", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: credit_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.credit_notes (id, "tenantId", "invoiceId", "creditNoteNumber", status, amount, reason, "issuedAt", "appliedAt", "issuedBy", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: custom_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.custom_roles (id, "tenantId", name, description, permissions, "isArchived", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dental_clinical_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dental_clinical_notes (id, "tenantId", "patientId", "dentalRecordId", "encounterId", "noteType", content, "authorId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dental_procedure_materials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dental_procedure_materials (id, "tenantId", "procedureCode", "inventoryItemId", "defaultQuantity", notes, "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dental_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dental_records (id, "tenantId", "patientId", "odontogramMode", "odontogramState", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dental_tooth_conditions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dental_tooth_conditions (id, "dentalRecordId", "tenantId", "toothId", surface, "conditionCode", notes, "encounterId", "recordedBy", "recordedAt") FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, "tenantId", "branchId", name, "nameAr", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_verification_tokens (id, "userId", "tenantId", "tokenHash", "expiresAt", "usedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: encounter_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.encounter_events (id, "tenantId", "encounterId", action, "actorUserId", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: encounters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.encounters (id, "tenantId", "branchId", "patientId", "appointmentId", "clinicianId", "chiefComplaint", diagnoses, medications, observations, "soapNotes", "structuredNotes", status, "followUpDate", "completedAt", "signedAt", "signedBy", "coSignedAt", "coSignedBy", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: implant_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.implant_records (id, "tenantId", "patientId", "toothId", "implantSystem", "implantDiameter", "implantLength", "abutmentType", status, "placedAt", "restoredAt", notes, "surgicalData", "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_batches (id, "tenantId", "inventoryItemId", "lotNumber", "manufacturedDate", "expiryDate", "quantityOnHand", status, "receivedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_categories (id, "tenantId", key, "nameEn", "nameAr", "sortOrder", "isSystem", "createdAt") FROM stdin;
\.


--
-- Data for Name: inventory_consumption_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_consumption_logs (id, "tenantId", "inventoryItemId", "encounterId", "patientId", "procedureCode", "quantityUsed", "consumedBy", notes, "consumedAt", "invoiceId", "invoiceLineItemId") FROM stdin;
\.


--
-- Data for Name: inventory_disposal_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_disposal_logs (id, "tenantId", "inventoryItemId", "batchId", quantity, reason, notes, "disposedBy", "disposedAt") FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_items (id, "tenantId", "branchId", "categoryId", sku, barcode, brand, "nameEn", "nameAr", unit, "quantityOnHand", "reorderThreshold", "minQuantity", "maxQuantity", "costPerUnit", "sellingPrice", "storageLocation", "expiryDate", "supplierId", "lotNumber", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: inventory_stock_count_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_stock_count_lines (id, "tenantId", "stockCountId", "inventoryItemId", "systemQuantity", "countedQuantity", "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_stock_counts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_stock_counts (id, "tenantId", "countNumber", "warehouseId", status, notes, "requestedBy", "approvedBy", "approvedAt", "startedAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_stock_movements (id, "tenantId", "inventoryItemId", "movementType", quantity, "quantityBefore", "quantityAfter", reason, notes, "encounterId", "patientId", "procedureCode", "warehouseId", "performedBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: inventory_stock_request_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_stock_request_lines (id, "tenantId", "stockRequestId", "inventoryItemId", "quantityRequested", "quantityFulfilled", notes, "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_stock_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_stock_requests (id, "tenantId", "requestNumber", "requestType", status, "departmentName", "patientId", "warehouseId", notes, "requestedBy", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt", "rejectionReason", "fulfilledBy", "fulfilledAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_stock_transfer_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_stock_transfer_lines (id, "tenantId", "stockTransferId", "inventoryItemId", quantity, "quantityReceived", "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_stock_transfers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_stock_transfers (id, "tenantId", "transferNumber", "fromWarehouseId", "toWarehouseId", status, notes, "requestedBy", "shippedAt", "receivedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_suppliers (id, "tenantId", code, "nameEn", "nameAr", "contactName", email, phone, address, "leadTimeDays", notes, "isActive", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: inventory_warehouse_stock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_warehouse_stock (id, "tenantId", "warehouseId", "inventoryItemId", "quantityOnHand", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory_warehouses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_warehouses (id, "tenantId", "branchId", code, "nameEn", "nameAr", address, "isDefault", "isActive", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: invoice_line_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoice_line_items (id, "invoiceId", "tenantId", description, quantity, "unitPrice", "discountPercent", "taxPercent", subtotal, "discountAmount", "taxAmount", "lineTotal", "serviceCode", "encounterId", "createdAt") FROM stdin;
\.


--
-- Data for Name: invoice_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoice_payments (id, "invoiceId", "tenantId", amount, "paymentMethod", "paymentReference", "paymentDate", "recordedBy", notes, "createdAt") FROM stdin;
\.


--
-- Data for Name: invoice_refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoice_refunds (id, "tenantId", "invoiceId", "paymentId", amount, reason, "refundMethod", "refundReference", "refundDate", "approvedBy", notes, "createdAt") FROM stdin;
\.


--
-- Data for Name: invoice_write_offs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoice_write_offs (id, "tenantId", "invoiceId", amount, reason, "approvedBy", "writeOffDate", notes, "createdAt") FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, "tenantId", "branchId", "patientId", "invoiceNumber", "invoiceDate", "dueDate", currency, status, "amountSubtotal", "amountDiscount", "amountTax", "amountTotal", "amountPaid", "insuranceProvider", "insurancePolicyNumber", "insuranceAmount", "patientResponsibility", "insuranceClaimStatus", notes, "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: lab_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lab_results (id, "tenantId", "patientId", "encounterId", "testName", value, unit, "referenceRange", status, "resultedAt", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_attempts (id, email, "tenantId", "ipAddress", "userAgent", success, "failReason", "attemptedAt") FROM stdin;
\.


--
-- Data for Name: loyalty_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_accounts (id, "tenantId", "patientId", "clinicId", "pointsBalance", "lifetimePointsEarned", tier, "enrollmentDate", "lastActivityDate", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: loyalty_rewards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_rewards (id, "tenantId", "accountId", "pointsRequired", description, metadata, "expiryDate", status, "redeemedDate", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: loyalty_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_transactions (id, "accountId", "tenantId", type, "pointsAmount", reference, description, "balanceAfter", "transactionDate", "createdAt") FROM stdin;
\.


--
-- Data for Name: media_assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media_assets (id, "tenantId", "branchId", category, "ownerType", "ownerId", "patientId", "originalFilename", "mimeType", "sizeBytes", status, "virusScanStatus", "storageKey", variants, metadata, "comparisonGroupId", "comparisonRole", "uploadedBy", "quarantineReason", "processedAt", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: mfa_backup_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mfa_backup_codes (id, "userId", "tenantId", "codeHash", "usedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: notification_automation_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_automation_rules (id, "tenantId", name, "nameAr", "eventType", channel, "templateId", "isActive", schedule, "recipientRoles", "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_preferences (id, "tenantId", "userId", "patientId", "channelSettings", "categorySettings", "quietHoursStart", "quietHoursEnd", timezone, language, "frequencyLimit", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: notification_saved_filters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_saved_filters (id, "tenantId", "userId", name, filters, "createdAt") FROM stdin;
\.


--
-- Data for Name: notification_template_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_template_versions (id, "templateId", version, "subjectEn", "subjectAr", "bodyEn", "bodyAr", "createdAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_templates (id, "tenantId", key, name, "nameAr", channel, category, "subjectEn", "subjectAr", "bodyEn", "bodyAr", variables, version, "isActive", "createdBy", "updatedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, "tenantId", "branchId", "recipientId", channel, category, "eventType", "templateId", title, body, priority, status, "isStarred", "isArchived", "failureReason", "retryCount", metadata, "sentAt", "deliveredAt", "readAt", "scheduledAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: operational_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operational_reports (id, "tenantId", "branchId", name, "reportType", format, status, "createdBy", parameters, "dateStart", "dateEnd", "downloadUrl", "createdAt", "updatedAt", "completedAt") FROM stdin;
\.


--
-- Data for Name: orthodontic_cases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orthodontic_cases (id, "tenantId", "patientId", status, "applianceType", "startDate", "estimatedEndDate", notes, "clinicalData", "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.outbox_events (id, "tenantId", "eventType", "aggregateType", "aggregateId", payload, status, attempts, "lastAttemptAt", "publishedAt", "errorMessage", "createdAt") FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, "userId", "tenantId", "tokenHash", "expiresAt", "usedAt", "ipAddress", "createdAt") FROM stdin;
\.


--
-- Data for Name: patient_addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_addresses (id, "patientId", line1, line2, city, state, "postalCode", country, "isPrimary", "createdAt") FROM stdin;
\.


--
-- Data for Name: patient_problems; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_problems (id, "tenantId", "patientId", code, "codingSystem", description, status, "onsetDate", "resolvedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patients (id, "tenantId", "branchId", "firstName", "lastName", "firstNameAr", "lastNameAr", "dateOfBirth", gender, phone, email, "nationalId", "bloodGroup", notes, "profileData", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: payment_plan_installments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_plan_installments (id, "tenantId", "planId", sequence, "dueDate", amount, "paidAmount", "paidAt", "paymentId", "createdAt") FROM stdin;
\.


--
-- Data for Name: payment_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_plans (id, "tenantId", "invoiceId", "patientId", status, "totalAmount", "installmentCount", currency, "startDate", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: payment_receipts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_receipts (id, "tenantId", "invoiceId", "paymentId", "receiptNumber", amount, currency, "issuedAt", "issuedBy") FROM stdin;
\.


--
-- Data for Name: periodontal_exams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.periodontal_exams (id, "tenantId", "patientId", "recordedBy", "examDate", notes, "chartData", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: platform_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.platform_subscriptions (id, "platformTenantId", plan, status, "billingCycleMonths", "pricePerMonth", currency, "startDate", "endDate", "paidManuallyBy", "paidManuallyAt", "paymentReference", "paymentNotes", "autoRenew", "renewalAttemptedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: platform_tenants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.platform_tenants (id, "tenantId", "displayName", region, plan, "maxBranches", "maxUsers", status, "provisionedBy", "activatedAt", "suspendedAt", "suspensionReason", "archivedAt", "archivedReason", "trialEndsAt", "contractStartDate", "contractEndDate", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: portal_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portal_accounts (id, "tenantId", "branchId", "patientId", "userId", status, locale, "notifyEmail", "notifySms", "notifyPush", "invitedBy", "activatedAt", "suspendedAt", "suspensionReason", "deactivatedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: privileged_access_grants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.privileged_access_grants (id, "platformTenantId", "adminId", "adminName", scopes, justification, status, "breakGlass", "requestedAt", "expiresAt", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt", "rejectedReason", "revokedAt", "revokedReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: provider_weekly_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider_weekly_schedules (id, "tenantId", "branchId", "providerId", "dayOfWeek", "startHour", "startMin", "endHour", "endMin", "isOff", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: purchase_order_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_order_lines (id, "tenantId", "purchaseOrderId", "inventoryItemId", "quantityOrdered", "quantityReceived", "unitCost", "sortOrder", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_orders (id, "tenantId", "poNumber", "supplierId", status, notes, "requestedBy", "approvedBy", "approvedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: queue_ticket_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.queue_ticket_events (id, "tenantId", "queueTicketId", action, "fromStatus", "toStatus", "actorUserId", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: queue_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.queue_tickets (id, "tenantId", "branchId", "appointmentId", "patientId", "providerId", "scheduledStart", "scheduledEnd", status, priority, "sortOrder", "checkedInAt", "calledAt", "servedAt", "completedAt", "waitTimeSeconds", "resourceId", "etaAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, "userId", "tenantId", "tokenHash", "sessionId", "deviceName", "expiresAt", "revokedAt", "ipAddress", "userAgent", "createdAt") FROM stdin;
\.


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.regions (id, "tenantId", name, "nameAr", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: report_custom_definitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_custom_definitions (id, "tenantId", "userId", name, "reportType", format, visualization, dataset, dimensions, measures, filters, "isScheduled", "scheduleFrequency", "recipientEmails", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: report_filter_presets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_filter_presets (id, "tenantId", "userId", name, filters, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: report_shares; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_shares (id, "tenantId", "reportId", "reportKind", "targetType", "targetId", access, "createdBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: scheduling_resources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scheduling_resources (id, "tenantId", "branchId", name, "resourceType", "isActive", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: service_prices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_prices (id, "tenantId", "serviceCode", "nameEn", "nameAr", "unitPrice", currency, "taxPercent", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: staff_invitations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff_invitations (id, "tenantId", "branchId", email, roles, "firstName", "lastName", "firstNameAr", "lastNameAr", phone, "invitedBy", status, "expiresAt", "acceptedAt", "userId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: staff_weekly_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff_weekly_schedules (id, "tenantId", "userId", "dayOfWeek", "startHour", "startMin", "endHour", "endMin", "isOff", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: tenant_billing_sequences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_billing_sequences (id, "tenantId", prefix, "lastNumber", "updatedAt") FROM stdin;
\.


--
-- Data for Name: tenant_channel_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_channel_configs (id, "tenantId", channel, "isEnabled", provider, "providerStatus", config, "updatedAt") FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenants (id, name, slug, "customDomain", status, "lifecycleStatus", timezone, locale, "dataRetentionDays", features, "trialStartedAt", "trialEndsAt", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: treatment_phases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.treatment_phases (id, "planId", "tenantId", name, "sortOrder", "visitNumber", "estimatedVisitDate", "clinicalNotes") FROM stdin;
\.


--
-- Data for Name: treatment_plan_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.treatment_plan_items (id, "phaseId", "tenantId", "sortOrder", code, description, "toothNumbers", status, "estimatedMinutes", "estimatedCost", "dependsOnItemId", "completedAt", "completedBy", "encounterId", "insuranceEligible", "insuranceEstimate", "patientPortion", "requiresPreAuth", "preAuthStatus") FROM stdin;
\.


--
-- Data for Name: treatment_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.treatment_plans (id, "tenantId", "patientId", title, status, "clinicalNotes", "totalEstimatedCost", "totalEstimatedMinutes", currency, "consentSignedAt", "consentRecordedBy", "consentMethod", "approvedAt", "approvedBy", "submittedAt", "submittedBy", "insuranceSnapshot", "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: trusted_devices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trusted_devices (id, "userId", "tenantId", "tokenHash", "deviceName", "expiresAt", "lastUsedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: user_branch_access; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_branch_access (id, "tenantId", "userId", "branchId", "createdAt") FROM stdin;
\.


--
-- Data for Name: user_custom_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_custom_roles (id, "tenantId", "userId", "customRoleId", "createdAt") FROM stdin;
\.


--
-- Data for Name: user_dashboard_layouts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_dashboard_layouts (id, "tenantId", "userId", profile, layout, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: user_device_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_device_tokens (id, "tenantId", "userId", platform, token, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: user_region_access; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_region_access (id, "tenantId", "userId", "regionId", "createdAt") FROM stdin;
\.


--
-- Data for Name: user_role_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_role_assignments (id, "userId", role, "grantedBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: user_saved_filters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_saved_filters (id, "tenantId", "userId", name, filters, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, "tenantId", "branchId", email, "passwordHash", "firstName", "lastName", "firstNameAr", "lastNameAr", phone, "jobTitle", "departmentId", "managerId", "startDate", "employmentStatus", timezone, languages, "avatarUrl", notes, "emergencyContactName", "emergencyContactPhone", "branchAccessMode", "suspendedAt", "archivedAt", "isActive", "emailVerified", "emailVerifiedAt", "mfaEnabled", "mfaSecret", "lockedUntil", "failedLoginCount", "passwordChangedAt", "lastLoginAt", "lastLoginIp", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: workflow_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_approvals (id, "tenantId", "branchId", "workflowId", title, "titleAr", status, mode, category, "requestedBy", "approverRoles", "approverIds", "approvedBy", "rejectedBy", comment, "rejectionReason", "dueAt", "decidedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: workflow_automation_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_automation_rules (id, "tenantId", "templateId", name, "nameAr", "eventType", "actionType", "actionConfig", "isActive", "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: workflow_execution_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_execution_logs (id, "tenantId", "workflowId", "stepIndex", "eventType", "actorId", details, "createdAt") FROM stdin;
\.


--
-- Data for Name: workflow_saved_filters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_saved_filters (id, "tenantId", "userId", name, filters, "createdAt") FROM stdin;
\.


--
-- Data for Name: workflow_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_tasks (id, "tenantId", "branchId", "workflowId", title, "titleAr", description, status, priority, "assigneeId", "assignedBy", "dueAt", "completedAt", metadata, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: workflow_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_templates (id, "tenantId", key, "nameEn", "nameAr", "descriptionEn", "descriptionAr", category, "triggerType", steps, version, status, "isSystem", "slaHours", "createdBy", "updatedBy", "publishedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: workflows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflows (id, "tenantId", "branchId", "templateId", "nameEn", "nameAr", "descriptionEn", "descriptionAr", steps, "currentStepIndex", status, "triggerType", priority, "assigneeId", "dueAt", "dataContext", "createdBy", "canceledBy", "canceledAt", "cancelReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_prompt_versions ai_prompt_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompt_versions
    ADD CONSTRAINT ai_prompt_versions_pkey PRIMARY KEY (id);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


--
-- Name: ai_tenant_settings ai_tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tenant_settings
    ADD CONSTRAINT ai_tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_daily ai_usage_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_daily
    ADD CONSTRAINT ai_usage_daily_pkey PRIMARY KEY (id);


--
-- Name: ai_user_settings ai_user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_user_settings
    ADD CONSTRAINT ai_user_settings_pkey PRIMARY KEY (id);


--
-- Name: analytics_dashboards analytics_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_dashboards
    ADD CONSTRAINT analytics_dashboards_pkey PRIMARY KEY (id);


--
-- Name: analytics_filter_presets analytics_filter_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_filter_presets
    ADD CONSTRAINT analytics_filter_presets_pkey PRIMARY KEY (id);


--
-- Name: analytics_layouts analytics_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_layouts
    ADD CONSTRAINT analytics_layouts_pkey PRIMARY KEY (id);


--
-- Name: analytics_metrics analytics_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_metrics
    ADD CONSTRAINT analytics_metrics_pkey PRIMARY KEY (id);


--
-- Name: analytics_reports analytics_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_reports
    ADD CONSTRAINT analytics_reports_pkey PRIMARY KEY (id);


--
-- Name: appointment_reminder_logs appointment_reminder_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reminder_logs
    ADD CONSTRAINT appointment_reminder_logs_pkey PRIMARY KEY (id);


--
-- Name: appointment_templates appointment_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_templates
    ADD CONSTRAINT appointment_templates_pkey PRIMARY KEY (id);


--
-- Name: appointment_waitlist appointment_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_entries audit_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_entries
    ADD CONSTRAINT audit_entries_pkey PRIMARY KEY (id);


--
-- Name: beauty_annotations beauty_annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beauty_annotations
    ADD CONSTRAINT beauty_annotations_pkey PRIMARY KEY (id);


--
-- Name: beauty_procedure_materials beauty_procedure_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beauty_procedure_materials
    ADD CONSTRAINT beauty_procedure_materials_pkey PRIMARY KEY (id);


--
-- Name: beauty_records beauty_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beauty_records
    ADD CONSTRAINT beauty_records_pkey PRIMARY KEY (id);


--
-- Name: branch_operating_hours branch_operating_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_operating_hours
    ADD CONSTRAINT branch_operating_hours_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: caregiver_access_grants caregiver_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_access_grants
    ADD CONSTRAINT caregiver_access_grants_pkey PRIMARY KEY (id);


--
-- Name: cash_sessions cash_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_pkey PRIMARY KEY (id);


--
-- Name: clinic_subscriptions clinic_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_subscriptions
    ADD CONSTRAINT clinic_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: clinical_note_templates clinical_note_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_note_templates
    ADD CONSTRAINT clinical_note_templates_pkey PRIMARY KEY (id);


--
-- Name: commission_calculations commission_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_pkey PRIMARY KEY (id);


--
-- Name: commission_line_items commission_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_line_items
    ADD CONSTRAINT commission_line_items_pkey PRIMARY KEY (id);


--
-- Name: commission_rules commission_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: custom_roles custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_pkey PRIMARY KEY (id);


--
-- Name: dental_clinical_notes dental_clinical_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_clinical_notes
    ADD CONSTRAINT dental_clinical_notes_pkey PRIMARY KEY (id);


--
-- Name: dental_procedure_materials dental_procedure_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_procedure_materials
    ADD CONSTRAINT dental_procedure_materials_pkey PRIMARY KEY (id);


--
-- Name: dental_records dental_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT dental_records_pkey PRIMARY KEY (id);


--
-- Name: dental_tooth_conditions dental_tooth_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_tooth_conditions
    ADD CONSTRAINT dental_tooth_conditions_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: encounter_events encounter_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter_events
    ADD CONSTRAINT encounter_events_pkey PRIMARY KEY (id);


--
-- Name: encounters encounters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_pkey PRIMARY KEY (id);


--
-- Name: implant_records implant_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_records
    ADD CONSTRAINT implant_records_pkey PRIMARY KEY (id);


--
-- Name: inventory_batches inventory_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_batches
    ADD CONSTRAINT inventory_batches_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_consumption_logs inventory_consumption_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumption_logs
    ADD CONSTRAINT inventory_consumption_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_disposal_logs inventory_disposal_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_disposal_logs
    ADD CONSTRAINT inventory_disposal_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_count_lines inventory_stock_count_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_count_lines
    ADD CONSTRAINT inventory_stock_count_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_counts inventory_stock_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_counts
    ADD CONSTRAINT inventory_stock_counts_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_movements inventory_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_request_lines inventory_stock_request_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_request_lines
    ADD CONSTRAINT inventory_stock_request_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_requests inventory_stock_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_requests
    ADD CONSTRAINT inventory_stock_requests_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_transfer_lines inventory_stock_transfer_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_transfer_lines
    ADD CONSTRAINT inventory_stock_transfer_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_transfers inventory_stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_transfers
    ADD CONSTRAINT inventory_stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: inventory_suppliers inventory_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_pkey PRIMARY KEY (id);


--
-- Name: inventory_warehouse_stock inventory_warehouse_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouse_stock
    ADD CONSTRAINT inventory_warehouse_stock_pkey PRIMARY KEY (id);


--
-- Name: inventory_warehouses inventory_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: invoice_refunds invoice_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_refunds
    ADD CONSTRAINT invoice_refunds_pkey PRIMARY KEY (id);


--
-- Name: invoice_write_offs invoice_write_offs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_write_offs
    ADD CONSTRAINT invoice_write_offs_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: loyalty_accounts loyalty_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (id);


--
-- Name: loyalty_rewards loyalty_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: mfa_backup_codes mfa_backup_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_backup_codes
    ADD CONSTRAINT mfa_backup_codes_pkey PRIMARY KEY (id);


--
-- Name: notification_automation_rules notification_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_automation_rules
    ADD CONSTRAINT notification_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_saved_filters notification_saved_filters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_saved_filters
    ADD CONSTRAINT notification_saved_filters_pkey PRIMARY KEY (id);


--
-- Name: notification_template_versions notification_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_template_versions
    ADD CONSTRAINT notification_template_versions_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: operational_reports operational_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_reports
    ADD CONSTRAINT operational_reports_pkey PRIMARY KEY (id);


--
-- Name: orthodontic_cases orthodontic_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orthodontic_cases
    ADD CONSTRAINT orthodontic_cases_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: patient_addresses patient_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_pkey PRIMARY KEY (id);


--
-- Name: patient_problems patient_problems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_problems
    ADD CONSTRAINT patient_problems_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payment_plan_installments payment_plan_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plan_installments
    ADD CONSTRAINT payment_plan_installments_pkey PRIMARY KEY (id);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: payment_receipts payment_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_receipts
    ADD CONSTRAINT payment_receipts_pkey PRIMARY KEY (id);


--
-- Name: periodontal_exams periodontal_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodontal_exams
    ADD CONSTRAINT periodontal_exams_pkey PRIMARY KEY (id);


--
-- Name: platform_subscriptions platform_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_subscriptions
    ADD CONSTRAINT platform_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: platform_tenants platform_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenants
    ADD CONSTRAINT platform_tenants_pkey PRIMARY KEY (id);


--
-- Name: portal_accounts portal_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_accounts
    ADD CONSTRAINT portal_accounts_pkey PRIMARY KEY (id);


--
-- Name: privileged_access_grants privileged_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privileged_access_grants
    ADD CONSTRAINT privileged_access_grants_pkey PRIMARY KEY (id);


--
-- Name: provider_weekly_schedules provider_weekly_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_weekly_schedules
    ADD CONSTRAINT provider_weekly_schedules_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_lines purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: queue_ticket_events queue_ticket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_ticket_events
    ADD CONSTRAINT queue_ticket_events_pkey PRIMARY KEY (id);


--
-- Name: queue_tickets queue_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tickets
    ADD CONSTRAINT queue_tickets_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: report_custom_definitions report_custom_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_custom_definitions
    ADD CONSTRAINT report_custom_definitions_pkey PRIMARY KEY (id);


--
-- Name: report_filter_presets report_filter_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_filter_presets
    ADD CONSTRAINT report_filter_presets_pkey PRIMARY KEY (id);


--
-- Name: report_shares report_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_shares
    ADD CONSTRAINT report_shares_pkey PRIMARY KEY (id);


--
-- Name: scheduling_resources scheduling_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_resources
    ADD CONSTRAINT scheduling_resources_pkey PRIMARY KEY (id);


--
-- Name: service_prices service_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_prices
    ADD CONSTRAINT service_prices_pkey PRIMARY KEY (id);


--
-- Name: staff_invitations staff_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_pkey PRIMARY KEY (id);


--
-- Name: staff_weekly_schedules staff_weekly_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_weekly_schedules
    ADD CONSTRAINT staff_weekly_schedules_pkey PRIMARY KEY (id);


--
-- Name: tenant_billing_sequences tenant_billing_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_billing_sequences
    ADD CONSTRAINT tenant_billing_sequences_pkey PRIMARY KEY (id);


--
-- Name: tenant_channel_configs tenant_channel_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_channel_configs
    ADD CONSTRAINT tenant_channel_configs_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: treatment_phases treatment_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_phases
    ADD CONSTRAINT treatment_phases_pkey PRIMARY KEY (id);


--
-- Name: treatment_plan_items treatment_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plan_items
    ADD CONSTRAINT treatment_plan_items_pkey PRIMARY KEY (id);


--
-- Name: treatment_plans treatment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT treatment_plans_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: user_branch_access user_branch_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_pkey PRIMARY KEY (id);


--
-- Name: user_custom_roles user_custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_pkey PRIMARY KEY (id);


--
-- Name: user_dashboard_layouts user_dashboard_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_dashboard_layouts
    ADD CONSTRAINT user_dashboard_layouts_pkey PRIMARY KEY (id);


--
-- Name: user_device_tokens user_device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_device_tokens
    ADD CONSTRAINT user_device_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_region_access user_region_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_access
    ADD CONSTRAINT user_region_access_pkey PRIMARY KEY (id);


--
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_saved_filters user_saved_filters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_saved_filters
    ADD CONSTRAINT user_saved_filters_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workflow_approvals workflow_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT workflow_approvals_pkey PRIMARY KEY (id);


--
-- Name: workflow_automation_rules workflow_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_automation_rules
    ADD CONSTRAINT workflow_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: workflow_execution_logs workflow_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution_logs
    ADD CONSTRAINT workflow_execution_logs_pkey PRIMARY KEY (id);


--
-- Name: workflow_saved_filters workflow_saved_filters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_saved_filters
    ADD CONSTRAINT workflow_saved_filters_pkey PRIMARY KEY (id);


--
-- Name: workflow_tasks workflow_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations_tenantId_userId_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_conversations_tenantId_userId_updatedAt_idx" ON public.ai_conversations USING btree ("tenantId", "userId", "updatedAt");


--
-- Name: ai_messages_conversationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON public.ai_messages USING btree ("conversationId", "createdAt");


--
-- Name: ai_models_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_models_tenantId_idx" ON public.ai_models USING btree ("tenantId");


--
-- Name: ai_models_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_models_tenantId_status_idx" ON public.ai_models USING btree ("tenantId", status);


--
-- Name: ai_prompt_versions_promptId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_prompt_versions_promptId_idx" ON public.ai_prompt_versions USING btree ("promptId");


--
-- Name: ai_prompt_versions_promptId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ai_prompt_versions_promptId_version_key" ON public.ai_prompt_versions USING btree ("promptId", version);


--
-- Name: ai_prompts_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_prompts_tenantId_category_idx" ON public.ai_prompts USING btree ("tenantId", category);


--
-- Name: ai_prompts_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_prompts_tenantId_userId_idx" ON public.ai_prompts USING btree ("tenantId", "userId");


--
-- Name: ai_tenant_settings_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ai_tenant_settings_tenantId_key" ON public.ai_tenant_settings USING btree ("tenantId");


--
-- Name: ai_usage_daily_tenantId_userId_usageDate_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ai_usage_daily_tenantId_userId_usageDate_key" ON public.ai_usage_daily USING btree ("tenantId", "userId", "usageDate");


--
-- Name: ai_user_settings_tenantId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ai_user_settings_tenantId_userId_key" ON public.ai_user_settings USING btree ("tenantId", "userId");


--
-- Name: analytics_dashboards_tenantId_dashboardType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_dashboards_tenantId_dashboardType_idx" ON public.analytics_dashboards USING btree ("tenantId", "dashboardType");


--
-- Name: analytics_dashboards_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_dashboards_tenantId_idx" ON public.analytics_dashboards USING btree ("tenantId");


--
-- Name: analytics_filter_presets_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_filter_presets_tenantId_userId_idx" ON public.analytics_filter_presets USING btree ("tenantId", "userId");


--
-- Name: analytics_layouts_tenantId_userId_profile_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "analytics_layouts_tenantId_userId_profile_key" ON public.analytics_layouts USING btree ("tenantId", "userId", profile);


--
-- Name: analytics_metrics_tenantId_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_metrics_tenantId_branchId_idx" ON public.analytics_metrics USING btree ("tenantId", "branchId");


--
-- Name: analytics_metrics_tenantId_metricName_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_metrics_tenantId_metricName_recordedAt_idx" ON public.analytics_metrics USING btree ("tenantId", "metricName", "recordedAt");


--
-- Name: analytics_reports_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_reports_tenantId_createdAt_idx" ON public.analytics_reports USING btree ("tenantId", "createdAt");


--
-- Name: analytics_reports_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_reports_tenantId_idx" ON public.analytics_reports USING btree ("tenantId");


--
-- Name: analytics_reports_tenantId_isScheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_reports_tenantId_isScheduled_idx" ON public.analytics_reports USING btree ("tenantId", "isScheduled");


--
-- Name: analytics_reports_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "analytics_reports_tenantId_status_idx" ON public.analytics_reports USING btree ("tenantId", status);


--
-- Name: appointment_reminder_logs_appointmentId_reminderType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "appointment_reminder_logs_appointmentId_reminderType_key" ON public.appointment_reminder_logs USING btree ("appointmentId", "reminderType");


--
-- Name: appointment_reminder_logs_tenantId_appointmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointment_reminder_logs_tenantId_appointmentId_idx" ON public.appointment_reminder_logs USING btree ("tenantId", "appointmentId");


--
-- Name: appointment_templates_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointment_templates_tenantId_idx" ON public.appointment_templates USING btree ("tenantId");


--
-- Name: appointment_waitlist_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointment_waitlist_tenantId_patientId_idx" ON public.appointment_waitlist USING btree ("tenantId", "patientId");


--
-- Name: appointment_waitlist_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointment_waitlist_tenantId_status_idx" ON public.appointment_waitlist USING btree ("tenantId", status);


--
-- Name: appointments_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_deletedAt_idx" ON public.appointments USING btree ("tenantId", "deletedAt");


--
-- Name: appointments_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_idx" ON public.appointments USING btree ("tenantId");


--
-- Name: appointments_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_patientId_idx" ON public.appointments USING btree ("tenantId", "patientId");


--
-- Name: appointments_tenantId_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_providerId_idx" ON public.appointments USING btree ("tenantId", "providerId");


--
-- Name: appointments_tenantId_recurrenceSeriesId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_recurrenceSeriesId_idx" ON public.appointments USING btree ("tenantId", "recurrenceSeriesId");


--
-- Name: appointments_tenantId_resourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_resourceId_idx" ON public.appointments USING btree ("tenantId", "resourceId");


--
-- Name: appointments_tenantId_scheduledStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_scheduledStart_idx" ON public.appointments USING btree ("tenantId", "scheduledStart");


--
-- Name: appointments_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_status_idx" ON public.appointments USING btree ("tenantId", status);


--
-- Name: audit_entries_correlationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_entries_correlationId_idx" ON public.audit_entries USING btree ("correlationId");


--
-- Name: audit_entries_tenantId_actorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_entries_tenantId_actorId_idx" ON public.audit_entries USING btree ("tenantId", "actorId");


--
-- Name: audit_entries_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_entries_tenantId_createdAt_idx" ON public.audit_entries USING btree ("tenantId", "createdAt");


--
-- Name: audit_entries_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_entries_tenantId_idx" ON public.audit_entries USING btree ("tenantId");


--
-- Name: audit_entries_tenantId_resourceType_resourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_entries_tenantId_resourceType_resourceId_idx" ON public.audit_entries USING btree ("tenantId", "resourceType", "resourceId");


--
-- Name: beauty_annotations_beautyRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "beauty_annotations_beautyRecordId_idx" ON public.beauty_annotations USING btree ("beautyRecordId");


--
-- Name: beauty_annotations_tenantId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "beauty_annotations_tenantId_recordedAt_idx" ON public.beauty_annotations USING btree ("tenantId", "recordedAt");


--
-- Name: beauty_procedure_materials_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "beauty_procedure_materials_tenantId_idx" ON public.beauty_procedure_materials USING btree ("tenantId");


--
-- Name: beauty_procedure_materials_tenantId_procedureCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "beauty_procedure_materials_tenantId_procedureCode_idx" ON public.beauty_procedure_materials USING btree ("tenantId", "procedureCode");


--
-- Name: beauty_procedure_materials_tenantId_procedureCode_inventory_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "beauty_procedure_materials_tenantId_procedureCode_inventory_key" ON public.beauty_procedure_materials USING btree ("tenantId", "procedureCode", "inventoryItemId");


--
-- Name: beauty_records_patientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "beauty_records_patientId_key" ON public.beauty_records USING btree ("patientId");


--
-- Name: beauty_records_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "beauty_records_tenantId_idx" ON public.beauty_records USING btree ("tenantId");


--
-- Name: branch_operating_hours_branchId_dayOfWeek_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "branch_operating_hours_branchId_dayOfWeek_key" ON public.branch_operating_hours USING btree ("branchId", "dayOfWeek");


--
-- Name: branch_operating_hours_tenantId_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "branch_operating_hours_tenantId_branchId_idx" ON public.branch_operating_hours USING btree ("tenantId", "branchId");


--
-- Name: branches_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "branches_tenantId_idx" ON public.branches USING btree ("tenantId");


--
-- Name: branches_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "branches_tenantId_isActive_idx" ON public.branches USING btree ("tenantId", "isActive");


--
-- Name: caregiver_access_grants_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "caregiver_access_grants_expiresAt_idx" ON public.caregiver_access_grants USING btree ("expiresAt");


--
-- Name: caregiver_access_grants_portalAccountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "caregiver_access_grants_portalAccountId_idx" ON public.caregiver_access_grants USING btree ("portalAccountId");


--
-- Name: cash_sessions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cash_sessions_tenantId_idx" ON public.cash_sessions USING btree ("tenantId");


--
-- Name: cash_sessions_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cash_sessions_tenantId_status_idx" ON public.cash_sessions USING btree ("tenantId", status);


--
-- Name: clinic_subscriptions_tenantId_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "clinic_subscriptions_tenantId_customerId_idx" ON public.clinic_subscriptions USING btree ("tenantId", "customerId");


--
-- Name: clinic_subscriptions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "clinic_subscriptions_tenantId_idx" ON public.clinic_subscriptions USING btree ("tenantId");


--
-- Name: clinic_subscriptions_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "clinic_subscriptions_tenantId_status_idx" ON public.clinic_subscriptions USING btree ("tenantId", status);


--
-- Name: clinical_note_templates_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "clinical_note_templates_tenantId_isActive_idx" ON public.clinical_note_templates USING btree ("tenantId", "isActive");


--
-- Name: commission_calculations_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_calculations_tenantId_idx" ON public.commission_calculations USING btree ("tenantId");


--
-- Name: commission_calculations_tenantId_periodStart_periodEnd_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_calculations_tenantId_periodStart_periodEnd_idx" ON public.commission_calculations USING btree ("tenantId", "periodStart", "periodEnd");


--
-- Name: commission_calculations_tenantId_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_calculations_tenantId_providerId_idx" ON public.commission_calculations USING btree ("tenantId", "providerId");


--
-- Name: commission_calculations_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_calculations_tenantId_status_idx" ON public.commission_calculations USING btree ("tenantId", status);


--
-- Name: commission_line_items_commissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_line_items_commissionId_idx" ON public.commission_line_items USING btree ("commissionId");


--
-- Name: commission_line_items_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_line_items_tenantId_idx" ON public.commission_line_items USING btree ("tenantId");


--
-- Name: commission_rules_tenantId_effectiveDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_rules_tenantId_effectiveDate_idx" ON public.commission_rules USING btree ("tenantId", "effectiveDate");


--
-- Name: commission_rules_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_rules_tenantId_idx" ON public.commission_rules USING btree ("tenantId");


--
-- Name: commission_rules_tenantId_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "commission_rules_tenantId_providerId_idx" ON public.commission_rules USING btree ("tenantId", "providerId");


--
-- Name: credit_notes_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "credit_notes_invoiceId_idx" ON public.credit_notes USING btree ("invoiceId");


--
-- Name: credit_notes_tenantId_creditNoteNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "credit_notes_tenantId_creditNoteNumber_key" ON public.credit_notes USING btree ("tenantId", "creditNoteNumber");


--
-- Name: credit_notes_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "credit_notes_tenantId_idx" ON public.credit_notes USING btree ("tenantId");


--
-- Name: custom_roles_tenantId_isArchived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "custom_roles_tenantId_isArchived_idx" ON public.custom_roles USING btree ("tenantId", "isArchived");


--
-- Name: custom_roles_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "custom_roles_tenantId_name_key" ON public.custom_roles USING btree ("tenantId", name);


--
-- Name: dental_clinical_notes_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_clinical_notes_tenantId_createdAt_idx" ON public.dental_clinical_notes USING btree ("tenantId", "createdAt");


--
-- Name: dental_clinical_notes_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_clinical_notes_tenantId_patientId_idx" ON public.dental_clinical_notes USING btree ("tenantId", "patientId");


--
-- Name: dental_procedure_materials_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_procedure_materials_tenantId_idx" ON public.dental_procedure_materials USING btree ("tenantId");


--
-- Name: dental_procedure_materials_tenantId_procedureCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_procedure_materials_tenantId_procedureCode_idx" ON public.dental_procedure_materials USING btree ("tenantId", "procedureCode");


--
-- Name: dental_procedure_materials_tenantId_procedureCode_inventory_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "dental_procedure_materials_tenantId_procedureCode_inventory_key" ON public.dental_procedure_materials USING btree ("tenantId", "procedureCode", "inventoryItemId");


--
-- Name: dental_records_patientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "dental_records_patientId_key" ON public.dental_records USING btree ("patientId");


--
-- Name: dental_records_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_records_tenantId_idx" ON public.dental_records USING btree ("tenantId");


--
-- Name: dental_tooth_conditions_dentalRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_tooth_conditions_dentalRecordId_idx" ON public.dental_tooth_conditions USING btree ("dentalRecordId");


--
-- Name: dental_tooth_conditions_tenantId_conditionCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_tooth_conditions_tenantId_conditionCode_idx" ON public.dental_tooth_conditions USING btree ("tenantId", "conditionCode");


--
-- Name: dental_tooth_conditions_tenantId_toothId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dental_tooth_conditions_tenantId_toothId_idx" ON public.dental_tooth_conditions USING btree ("tenantId", "toothId");


--
-- Name: departments_tenantId_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "departments_tenantId_branchId_idx" ON public.departments USING btree ("tenantId", "branchId");


--
-- Name: departments_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "departments_tenantId_idx" ON public.departments USING btree ("tenantId");


--
-- Name: email_verification_tokens_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "email_verification_tokens_tenantId_idx" ON public.email_verification_tokens USING btree ("tenantId");


--
-- Name: email_verification_tokens_tokenHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "email_verification_tokens_tokenHash_idx" ON public.email_verification_tokens USING btree ("tokenHash");


--
-- Name: email_verification_tokens_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "email_verification_tokens_userId_idx" ON public.email_verification_tokens USING btree ("userId");


--
-- Name: encounter_events_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounter_events_tenantId_createdAt_idx" ON public.encounter_events USING btree ("tenantId", "createdAt");


--
-- Name: encounter_events_tenantId_encounterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounter_events_tenantId_encounterId_idx" ON public.encounter_events USING btree ("tenantId", "encounterId");


--
-- Name: encounters_tenantId_clinicianId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounters_tenantId_clinicianId_idx" ON public.encounters USING btree ("tenantId", "clinicianId");


--
-- Name: encounters_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounters_tenantId_createdAt_idx" ON public.encounters USING btree ("tenantId", "createdAt");


--
-- Name: encounters_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounters_tenantId_deletedAt_idx" ON public.encounters USING btree ("tenantId", "deletedAt");


--
-- Name: encounters_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounters_tenantId_idx" ON public.encounters USING btree ("tenantId");


--
-- Name: encounters_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounters_tenantId_patientId_idx" ON public.encounters USING btree ("tenantId", "patientId");


--
-- Name: encounters_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "encounters_tenantId_status_idx" ON public.encounters USING btree ("tenantId", status);


--
-- Name: implant_records_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "implant_records_tenantId_patientId_idx" ON public.implant_records USING btree ("tenantId", "patientId");


--
-- Name: implant_records_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "implant_records_tenantId_status_idx" ON public.implant_records USING btree ("tenantId", status);


--
-- Name: implant_records_tenantId_toothId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "implant_records_tenantId_toothId_idx" ON public.implant_records USING btree ("tenantId", "toothId");


--
-- Name: inventory_batches_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_batches_inventoryItemId_idx" ON public.inventory_batches USING btree ("inventoryItemId");


--
-- Name: inventory_batches_tenantId_expiryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_batches_tenantId_expiryDate_idx" ON public.inventory_batches USING btree ("tenantId", "expiryDate");


--
-- Name: inventory_batches_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_batches_tenantId_idx" ON public.inventory_batches USING btree ("tenantId");


--
-- Name: inventory_batches_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_batches_tenantId_status_idx" ON public.inventory_batches USING btree ("tenantId", status);


--
-- Name: inventory_categories_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_categories_tenantId_idx" ON public.inventory_categories USING btree ("tenantId");


--
-- Name: inventory_categories_tenantId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_categories_tenantId_key_key" ON public.inventory_categories USING btree ("tenantId", key);


--
-- Name: inventory_consumption_logs_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_consumption_logs_inventoryItemId_idx" ON public.inventory_consumption_logs USING btree ("inventoryItemId");


--
-- Name: inventory_consumption_logs_tenantId_consumedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_consumption_logs_tenantId_consumedAt_idx" ON public.inventory_consumption_logs USING btree ("tenantId", "consumedAt");


--
-- Name: inventory_consumption_logs_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_consumption_logs_tenantId_idx" ON public.inventory_consumption_logs USING btree ("tenantId");


--
-- Name: inventory_consumption_logs_tenantId_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_consumption_logs_tenantId_invoiceId_idx" ON public.inventory_consumption_logs USING btree ("tenantId", "invoiceId");


--
-- Name: inventory_consumption_logs_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_consumption_logs_tenantId_patientId_idx" ON public.inventory_consumption_logs USING btree ("tenantId", "patientId");


--
-- Name: inventory_disposal_logs_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_disposal_logs_batchId_idx" ON public.inventory_disposal_logs USING btree ("batchId");


--
-- Name: inventory_disposal_logs_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_disposal_logs_inventoryItemId_idx" ON public.inventory_disposal_logs USING btree ("inventoryItemId");


--
-- Name: inventory_disposal_logs_tenantId_disposedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_disposal_logs_tenantId_disposedAt_idx" ON public.inventory_disposal_logs USING btree ("tenantId", "disposedAt");


--
-- Name: inventory_disposal_logs_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_disposal_logs_tenantId_idx" ON public.inventory_disposal_logs USING btree ("tenantId");


--
-- Name: inventory_items_tenantId_barcode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_barcode_idx" ON public.inventory_items USING btree ("tenantId", barcode);


--
-- Name: inventory_items_tenantId_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_categoryId_idx" ON public.inventory_items USING btree ("tenantId", "categoryId");


--
-- Name: inventory_items_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_deletedAt_idx" ON public.inventory_items USING btree ("tenantId", "deletedAt");


--
-- Name: inventory_items_tenantId_deletedAt_nameEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_deletedAt_nameEn_idx" ON public.inventory_items USING btree ("tenantId", "deletedAt", "nameEn");


--
-- Name: inventory_items_tenantId_expiryDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_expiryDate_idx" ON public.inventory_items USING btree ("tenantId", "expiryDate");


--
-- Name: inventory_items_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_idx" ON public.inventory_items USING btree ("tenantId");


--
-- Name: inventory_items_tenantId_quantityOnHand_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_quantityOnHand_idx" ON public.inventory_items USING btree ("tenantId", "quantityOnHand");


--
-- Name: inventory_items_tenantId_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_items_tenantId_sku_key" ON public.inventory_items USING btree ("tenantId", sku);


--
-- Name: inventory_items_tenantId_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_items_tenantId_supplierId_idx" ON public.inventory_items USING btree ("tenantId", "supplierId");


--
-- Name: inventory_stock_count_lines_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_count_lines_inventoryItemId_idx" ON public.inventory_stock_count_lines USING btree ("inventoryItemId");


--
-- Name: inventory_stock_count_lines_stockCountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_count_lines_stockCountId_idx" ON public.inventory_stock_count_lines USING btree ("stockCountId");


--
-- Name: inventory_stock_count_lines_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_count_lines_tenantId_idx" ON public.inventory_stock_count_lines USING btree ("tenantId");


--
-- Name: inventory_stock_counts_tenantId_countNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_stock_counts_tenantId_countNumber_key" ON public.inventory_stock_counts USING btree ("tenantId", "countNumber");


--
-- Name: inventory_stock_counts_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_counts_tenantId_idx" ON public.inventory_stock_counts USING btree ("tenantId");


--
-- Name: inventory_stock_counts_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_counts_tenantId_status_idx" ON public.inventory_stock_counts USING btree ("tenantId", status);


--
-- Name: inventory_stock_counts_warehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_counts_warehouseId_idx" ON public.inventory_stock_counts USING btree ("warehouseId");


--
-- Name: inventory_stock_movements_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_movements_inventoryItemId_idx" ON public.inventory_stock_movements USING btree ("inventoryItemId");


--
-- Name: inventory_stock_movements_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_movements_tenantId_createdAt_idx" ON public.inventory_stock_movements USING btree ("tenantId", "createdAt");


--
-- Name: inventory_stock_movements_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_movements_tenantId_idx" ON public.inventory_stock_movements USING btree ("tenantId");


--
-- Name: inventory_stock_movements_tenantId_movementType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_movements_tenantId_movementType_idx" ON public.inventory_stock_movements USING btree ("tenantId", "movementType");


--
-- Name: inventory_stock_movements_tenantId_warehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_movements_tenantId_warehouseId_idx" ON public.inventory_stock_movements USING btree ("tenantId", "warehouseId");


--
-- Name: inventory_stock_request_lines_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_request_lines_inventoryItemId_idx" ON public.inventory_stock_request_lines USING btree ("inventoryItemId");


--
-- Name: inventory_stock_request_lines_stockRequestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_request_lines_stockRequestId_idx" ON public.inventory_stock_request_lines USING btree ("stockRequestId");


--
-- Name: inventory_stock_request_lines_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_request_lines_tenantId_idx" ON public.inventory_stock_request_lines USING btree ("tenantId");


--
-- Name: inventory_stock_requests_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_requests_tenantId_idx" ON public.inventory_stock_requests USING btree ("tenantId");


--
-- Name: inventory_stock_requests_tenantId_requestNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_stock_requests_tenantId_requestNumber_key" ON public.inventory_stock_requests USING btree ("tenantId", "requestNumber");


--
-- Name: inventory_stock_requests_tenantId_requestedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_requests_tenantId_requestedBy_idx" ON public.inventory_stock_requests USING btree ("tenantId", "requestedBy");


--
-- Name: inventory_stock_requests_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_requests_tenantId_status_idx" ON public.inventory_stock_requests USING btree ("tenantId", status);


--
-- Name: inventory_stock_transfer_lines_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_transfer_lines_inventoryItemId_idx" ON public.inventory_stock_transfer_lines USING btree ("inventoryItemId");


--
-- Name: inventory_stock_transfer_lines_stockTransferId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_transfer_lines_stockTransferId_idx" ON public.inventory_stock_transfer_lines USING btree ("stockTransferId");


--
-- Name: inventory_stock_transfer_lines_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_transfer_lines_tenantId_idx" ON public.inventory_stock_transfer_lines USING btree ("tenantId");


--
-- Name: inventory_stock_transfers_fromWarehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_transfers_fromWarehouseId_idx" ON public.inventory_stock_transfers USING btree ("fromWarehouseId");


--
-- Name: inventory_stock_transfers_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_transfers_tenantId_idx" ON public.inventory_stock_transfers USING btree ("tenantId");


--
-- Name: inventory_stock_transfers_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_transfers_tenantId_status_idx" ON public.inventory_stock_transfers USING btree ("tenantId", status);


--
-- Name: inventory_stock_transfers_tenantId_transferNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_stock_transfers_tenantId_transferNumber_key" ON public.inventory_stock_transfers USING btree ("tenantId", "transferNumber");


--
-- Name: inventory_stock_transfers_toWarehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_stock_transfers_toWarehouseId_idx" ON public.inventory_stock_transfers USING btree ("toWarehouseId");


--
-- Name: inventory_suppliers_tenantId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_suppliers_tenantId_code_key" ON public.inventory_suppliers USING btree ("tenantId", code);


--
-- Name: inventory_suppliers_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_suppliers_tenantId_deletedAt_idx" ON public.inventory_suppliers USING btree ("tenantId", "deletedAt");


--
-- Name: inventory_suppliers_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_suppliers_tenantId_idx" ON public.inventory_suppliers USING btree ("tenantId");


--
-- Name: inventory_warehouse_stock_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_warehouse_stock_inventoryItemId_idx" ON public.inventory_warehouse_stock USING btree ("inventoryItemId");


--
-- Name: inventory_warehouse_stock_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_warehouse_stock_tenantId_idx" ON public.inventory_warehouse_stock USING btree ("tenantId");


--
-- Name: inventory_warehouse_stock_tenantId_warehouseId_inventoryIte_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_warehouse_stock_tenantId_warehouseId_inventoryIte_key" ON public.inventory_warehouse_stock USING btree ("tenantId", "warehouseId", "inventoryItemId");


--
-- Name: inventory_warehouse_stock_warehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_warehouse_stock_warehouseId_idx" ON public.inventory_warehouse_stock USING btree ("warehouseId");


--
-- Name: inventory_warehouses_tenantId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "inventory_warehouses_tenantId_code_key" ON public.inventory_warehouses USING btree ("tenantId", code);


--
-- Name: inventory_warehouses_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_warehouses_tenantId_deletedAt_idx" ON public.inventory_warehouses USING btree ("tenantId", "deletedAt");


--
-- Name: inventory_warehouses_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_warehouses_tenantId_idx" ON public.inventory_warehouses USING btree ("tenantId");


--
-- Name: inventory_warehouses_tenantId_isDefault_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_warehouses_tenantId_isDefault_idx" ON public.inventory_warehouses USING btree ("tenantId", "isDefault");


--
-- Name: invoice_line_items_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_line_items_invoiceId_idx" ON public.invoice_line_items USING btree ("invoiceId");


--
-- Name: invoice_line_items_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_line_items_tenantId_idx" ON public.invoice_line_items USING btree ("tenantId");


--
-- Name: invoice_payments_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_payments_invoiceId_idx" ON public.invoice_payments USING btree ("invoiceId");


--
-- Name: invoice_payments_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_payments_tenantId_idx" ON public.invoice_payments USING btree ("tenantId");


--
-- Name: invoice_payments_tenantId_paymentDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_payments_tenantId_paymentDate_idx" ON public.invoice_payments USING btree ("tenantId", "paymentDate");


--
-- Name: invoice_refunds_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_refunds_invoiceId_idx" ON public.invoice_refunds USING btree ("invoiceId");


--
-- Name: invoice_refunds_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_refunds_tenantId_idx" ON public.invoice_refunds USING btree ("tenantId");


--
-- Name: invoice_write_offs_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_write_offs_invoiceId_idx" ON public.invoice_write_offs USING btree ("invoiceId");


--
-- Name: invoice_write_offs_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoice_write_offs_tenantId_idx" ON public.invoice_write_offs USING btree ("tenantId");


--
-- Name: invoices_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoices_tenantId_deletedAt_idx" ON public.invoices USING btree ("tenantId", "deletedAt");


--
-- Name: invoices_tenantId_dueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoices_tenantId_dueDate_idx" ON public.invoices USING btree ("tenantId", "dueDate");


--
-- Name: invoices_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoices_tenantId_idx" ON public.invoices USING btree ("tenantId");


--
-- Name: invoices_tenantId_invoiceDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoices_tenantId_invoiceDate_idx" ON public.invoices USING btree ("tenantId", "invoiceDate");


--
-- Name: invoices_tenantId_invoiceNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "invoices_tenantId_invoiceNumber_key" ON public.invoices USING btree ("tenantId", "invoiceNumber");


--
-- Name: invoices_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoices_tenantId_patientId_idx" ON public.invoices USING btree ("tenantId", "patientId");


--
-- Name: invoices_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invoices_tenantId_status_idx" ON public.invoices USING btree ("tenantId", status);


--
-- Name: lab_results_tenantId_encounterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lab_results_tenantId_encounterId_idx" ON public.lab_results USING btree ("tenantId", "encounterId");


--
-- Name: lab_results_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lab_results_tenantId_patientId_idx" ON public.lab_results USING btree ("tenantId", "patientId");


--
-- Name: login_attempts_email_attemptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "login_attempts_email_attemptedAt_idx" ON public.login_attempts USING btree (email, "attemptedAt");


--
-- Name: login_attempts_ipAddress_attemptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "login_attempts_ipAddress_attemptedAt_idx" ON public.login_attempts USING btree ("ipAddress", "attemptedAt");


--
-- Name: login_attempts_tenantId_attemptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "login_attempts_tenantId_attemptedAt_idx" ON public.login_attempts USING btree ("tenantId", "attemptedAt");


--
-- Name: loyalty_accounts_patientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "loyalty_accounts_patientId_key" ON public.loyalty_accounts USING btree ("patientId");


--
-- Name: loyalty_accounts_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_accounts_tenantId_idx" ON public.loyalty_accounts USING btree ("tenantId");


--
-- Name: loyalty_accounts_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_accounts_tenantId_isActive_idx" ON public.loyalty_accounts USING btree ("tenantId", "isActive");


--
-- Name: loyalty_accounts_tenantId_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_accounts_tenantId_tier_idx" ON public.loyalty_accounts USING btree ("tenantId", tier);


--
-- Name: loyalty_rewards_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_rewards_accountId_idx" ON public.loyalty_rewards USING btree ("accountId");


--
-- Name: loyalty_rewards_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_rewards_tenantId_deletedAt_idx" ON public.loyalty_rewards USING btree ("tenantId", "deletedAt");


--
-- Name: loyalty_rewards_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_rewards_tenantId_idx" ON public.loyalty_rewards USING btree ("tenantId");


--
-- Name: loyalty_rewards_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_rewards_tenantId_status_idx" ON public.loyalty_rewards USING btree ("tenantId", status);


--
-- Name: loyalty_transactions_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_transactions_accountId_idx" ON public.loyalty_transactions USING btree ("accountId");


--
-- Name: loyalty_transactions_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_transactions_tenantId_createdAt_idx" ON public.loyalty_transactions USING btree ("tenantId", "createdAt");


--
-- Name: loyalty_transactions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "loyalty_transactions_tenantId_idx" ON public.loyalty_transactions USING btree ("tenantId");


--
-- Name: media_assets_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "media_assets_deletedAt_idx" ON public.media_assets USING btree ("deletedAt");


--
-- Name: media_assets_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "media_assets_tenantId_category_idx" ON public.media_assets USING btree ("tenantId", category);


--
-- Name: media_assets_tenantId_comparisonGroupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "media_assets_tenantId_comparisonGroupId_idx" ON public.media_assets USING btree ("tenantId", "comparisonGroupId");


--
-- Name: media_assets_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "media_assets_tenantId_idx" ON public.media_assets USING btree ("tenantId");


--
-- Name: media_assets_tenantId_ownerType_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "media_assets_tenantId_ownerType_ownerId_idx" ON public.media_assets USING btree ("tenantId", "ownerType", "ownerId");


--
-- Name: media_assets_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "media_assets_tenantId_patientId_idx" ON public.media_assets USING btree ("tenantId", "patientId");


--
-- Name: media_assets_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "media_assets_tenantId_status_idx" ON public.media_assets USING btree ("tenantId", status);


--
-- Name: mfa_backup_codes_codeHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mfa_backup_codes_codeHash_idx" ON public.mfa_backup_codes USING btree ("codeHash");


--
-- Name: mfa_backup_codes_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mfa_backup_codes_tenantId_idx" ON public.mfa_backup_codes USING btree ("tenantId");


--
-- Name: mfa_backup_codes_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mfa_backup_codes_userId_idx" ON public.mfa_backup_codes USING btree ("userId");


--
-- Name: notification_automation_rules_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_automation_rules_tenantId_isActive_idx" ON public.notification_automation_rules USING btree ("tenantId", "isActive");


--
-- Name: notification_preferences_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_preferences_tenantId_idx" ON public.notification_preferences USING btree ("tenantId");


--
-- Name: notification_preferences_tenantId_patientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "notification_preferences_tenantId_patientId_key" ON public.notification_preferences USING btree ("tenantId", "patientId");


--
-- Name: notification_preferences_tenantId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "notification_preferences_tenantId_userId_key" ON public.notification_preferences USING btree ("tenantId", "userId");


--
-- Name: notification_saved_filters_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_saved_filters_tenantId_userId_idx" ON public.notification_saved_filters USING btree ("tenantId", "userId");


--
-- Name: notification_template_versions_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_template_versions_templateId_idx" ON public.notification_template_versions USING btree ("templateId");


--
-- Name: notification_templates_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_templates_tenantId_isActive_idx" ON public.notification_templates USING btree ("tenantId", "isActive");


--
-- Name: notification_templates_tenantId_key_channel_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "notification_templates_tenantId_key_channel_key" ON public.notification_templates USING btree ("tenantId", key, channel);


--
-- Name: notifications_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_category_idx" ON public.notifications USING btree ("tenantId", category);


--
-- Name: notifications_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_createdAt_idx" ON public.notifications USING btree ("tenantId", "createdAt");


--
-- Name: notifications_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_idx" ON public.notifications USING btree ("tenantId");


--
-- Name: notifications_tenantId_isArchived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_isArchived_idx" ON public.notifications USING btree ("tenantId", "isArchived");


--
-- Name: notifications_tenantId_recipientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_recipientId_idx" ON public.notifications USING btree ("tenantId", "recipientId");


--
-- Name: notifications_tenantId_recipientId_isArchived_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_recipientId_isArchived_createdAt_idx" ON public.notifications USING btree ("tenantId", "recipientId", "isArchived", "createdAt" DESC);


--
-- Name: notifications_tenantId_recipientId_readAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_recipientId_readAt_idx" ON public.notifications USING btree ("tenantId", "recipientId", "readAt");


--
-- Name: notifications_tenantId_scheduledAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_scheduledAt_idx" ON public.notifications USING btree ("tenantId", "scheduledAt");


--
-- Name: notifications_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_status_idx" ON public.notifications USING btree ("tenantId", status);


--
-- Name: operational_reports_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "operational_reports_tenantId_createdAt_idx" ON public.operational_reports USING btree ("tenantId", "createdAt");


--
-- Name: operational_reports_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "operational_reports_tenantId_idx" ON public.operational_reports USING btree ("tenantId");


--
-- Name: operational_reports_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "operational_reports_tenantId_status_idx" ON public.operational_reports USING btree ("tenantId", status);


--
-- Name: orthodontic_cases_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orthodontic_cases_tenantId_patientId_idx" ON public.orthodontic_cases USING btree ("tenantId", "patientId");


--
-- Name: orthodontic_cases_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orthodontic_cases_tenantId_status_idx" ON public.orthodontic_cases USING btree ("tenantId", status);


--
-- Name: outbox_events_aggregateType_aggregateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON public.outbox_events USING btree ("aggregateType", "aggregateId");


--
-- Name: outbox_events_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "outbox_events_status_createdAt_idx" ON public.outbox_events USING btree (status, "createdAt");


--
-- Name: outbox_events_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "outbox_events_tenantId_idx" ON public.outbox_events USING btree ("tenantId");


--
-- Name: password_reset_tokens_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "password_reset_tokens_tenantId_idx" ON public.password_reset_tokens USING btree ("tenantId");


--
-- Name: password_reset_tokens_tokenHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "password_reset_tokens_tokenHash_idx" ON public.password_reset_tokens USING btree ("tokenHash");


--
-- Name: password_reset_tokens_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "password_reset_tokens_userId_idx" ON public.password_reset_tokens USING btree ("userId");


--
-- Name: patient_addresses_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "patient_addresses_patientId_idx" ON public.patient_addresses USING btree ("patientId");


--
-- Name: patient_problems_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "patient_problems_tenantId_patientId_idx" ON public.patient_problems USING btree ("tenantId", "patientId");


--
-- Name: patient_problems_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "patient_problems_tenantId_status_idx" ON public.patient_problems USING btree ("tenantId", status);


--
-- Name: patients_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "patients_tenantId_deletedAt_idx" ON public.patients USING btree ("tenantId", "deletedAt");


--
-- Name: patients_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "patients_tenantId_idx" ON public.patients USING btree ("tenantId");


--
-- Name: patients_tenantId_nationalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "patients_tenantId_nationalId_idx" ON public.patients USING btree ("tenantId", "nationalId");


--
-- Name: patients_tenantId_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "patients_tenantId_phone_idx" ON public.patients USING btree ("tenantId", phone);


--
-- Name: payment_plan_installments_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_plan_installments_planId_idx" ON public.payment_plan_installments USING btree ("planId");


--
-- Name: payment_plan_installments_planId_sequence_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payment_plan_installments_planId_sequence_key" ON public.payment_plan_installments USING btree ("planId", sequence);


--
-- Name: payment_plan_installments_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_plan_installments_tenantId_idx" ON public.payment_plan_installments USING btree ("tenantId");


--
-- Name: payment_plans_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_plans_invoiceId_idx" ON public.payment_plans USING btree ("invoiceId");


--
-- Name: payment_plans_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_plans_tenantId_idx" ON public.payment_plans USING btree ("tenantId");


--
-- Name: payment_receipts_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_receipts_invoiceId_idx" ON public.payment_receipts USING btree ("invoiceId");


--
-- Name: payment_receipts_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_receipts_tenantId_idx" ON public.payment_receipts USING btree ("tenantId");


--
-- Name: payment_receipts_tenantId_receiptNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payment_receipts_tenantId_receiptNumber_key" ON public.payment_receipts USING btree ("tenantId", "receiptNumber");


--
-- Name: periodontal_exams_tenantId_patientId_examDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "periodontal_exams_tenantId_patientId_examDate_idx" ON public.periodontal_exams USING btree ("tenantId", "patientId", "examDate");


--
-- Name: periodontal_exams_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "periodontal_exams_tenantId_patientId_idx" ON public.periodontal_exams USING btree ("tenantId", "patientId");


--
-- Name: platform_subscriptions_endDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "platform_subscriptions_endDate_idx" ON public.platform_subscriptions USING btree ("endDate");


--
-- Name: platform_subscriptions_platformTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "platform_subscriptions_platformTenantId_idx" ON public.platform_subscriptions USING btree ("platformTenantId");


--
-- Name: platform_subscriptions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_subscriptions_status_idx ON public.platform_subscriptions USING btree (status);


--
-- Name: platform_tenants_contractEndDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "platform_tenants_contractEndDate_idx" ON public.platform_tenants USING btree ("contractEndDate");


--
-- Name: platform_tenants_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_tenants_plan_idx ON public.platform_tenants USING btree (plan);


--
-- Name: platform_tenants_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_tenants_status_idx ON public.platform_tenants USING btree (status);


--
-- Name: platform_tenants_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "platform_tenants_tenantId_key" ON public.platform_tenants USING btree ("tenantId");


--
-- Name: platform_tenants_trialEndsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "platform_tenants_trialEndsAt_idx" ON public.platform_tenants USING btree ("trialEndsAt");


--
-- Name: portal_accounts_patientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "portal_accounts_patientId_key" ON public.portal_accounts USING btree ("patientId");


--
-- Name: portal_accounts_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "portal_accounts_tenantId_idx" ON public.portal_accounts USING btree ("tenantId");


--
-- Name: portal_accounts_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "portal_accounts_tenantId_status_idx" ON public.portal_accounts USING btree ("tenantId", status);


--
-- Name: privileged_access_grants_adminId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "privileged_access_grants_adminId_idx" ON public.privileged_access_grants USING btree ("adminId");


--
-- Name: privileged_access_grants_platformTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "privileged_access_grants_platformTenantId_idx" ON public.privileged_access_grants USING btree ("platformTenantId");


--
-- Name: privileged_access_grants_status_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "privileged_access_grants_status_expiresAt_idx" ON public.privileged_access_grants USING btree (status, "expiresAt");


--
-- Name: provider_weekly_schedules_tenantId_providerId_dayOfWeek_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "provider_weekly_schedules_tenantId_providerId_dayOfWeek_key" ON public.provider_weekly_schedules USING btree ("tenantId", "providerId", "dayOfWeek");


--
-- Name: provider_weekly_schedules_tenantId_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "provider_weekly_schedules_tenantId_providerId_idx" ON public.provider_weekly_schedules USING btree ("tenantId", "providerId");


--
-- Name: purchase_order_lines_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchase_order_lines_inventoryItemId_idx" ON public.purchase_order_lines USING btree ("inventoryItemId");


--
-- Name: purchase_order_lines_purchaseOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchase_order_lines_purchaseOrderId_idx" ON public.purchase_order_lines USING btree ("purchaseOrderId");


--
-- Name: purchase_order_lines_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchase_order_lines_tenantId_idx" ON public.purchase_order_lines USING btree ("tenantId");


--
-- Name: purchase_orders_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchase_orders_tenantId_idx" ON public.purchase_orders USING btree ("tenantId");


--
-- Name: purchase_orders_tenantId_poNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "purchase_orders_tenantId_poNumber_key" ON public.purchase_orders USING btree ("tenantId", "poNumber");


--
-- Name: purchase_orders_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchase_orders_tenantId_status_idx" ON public.purchase_orders USING btree ("tenantId", status);


--
-- Name: purchase_orders_tenantId_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchase_orders_tenantId_supplierId_idx" ON public.purchase_orders USING btree ("tenantId", "supplierId");


--
-- Name: queue_ticket_events_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "queue_ticket_events_tenantId_createdAt_idx" ON public.queue_ticket_events USING btree ("tenantId", "createdAt");


--
-- Name: queue_ticket_events_tenantId_queueTicketId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "queue_ticket_events_tenantId_queueTicketId_idx" ON public.queue_ticket_events USING btree ("tenantId", "queueTicketId");


--
-- Name: queue_tickets_appointmentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "queue_tickets_appointmentId_key" ON public.queue_tickets USING btree ("appointmentId");


--
-- Name: queue_tickets_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "queue_tickets_tenantId_idx" ON public.queue_tickets USING btree ("tenantId");


--
-- Name: queue_tickets_tenantId_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "queue_tickets_tenantId_providerId_idx" ON public.queue_tickets USING btree ("tenantId", "providerId");


--
-- Name: queue_tickets_tenantId_scheduledStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "queue_tickets_tenantId_scheduledStart_idx" ON public.queue_tickets USING btree ("tenantId", "scheduledStart");


--
-- Name: queue_tickets_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "queue_tickets_tenantId_status_idx" ON public.queue_tickets USING btree ("tenantId", status);


--
-- Name: refresh_tokens_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_expiresAt_idx" ON public.refresh_tokens USING btree ("expiresAt");


--
-- Name: refresh_tokens_sessionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_sessionId_idx" ON public.refresh_tokens USING btree ("sessionId");


--
-- Name: refresh_tokens_sessionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "refresh_tokens_sessionId_key" ON public.refresh_tokens USING btree ("sessionId");


--
-- Name: refresh_tokens_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_tenantId_idx" ON public.refresh_tokens USING btree ("tenantId");


--
-- Name: refresh_tokens_tokenHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_tokenHash_idx" ON public.refresh_tokens USING btree ("tokenHash");


--
-- Name: refresh_tokens_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_userId_idx" ON public.refresh_tokens USING btree ("userId");


--
-- Name: regions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "regions_tenantId_idx" ON public.regions USING btree ("tenantId");


--
-- Name: regions_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "regions_tenantId_name_key" ON public.regions USING btree ("tenantId", name);


--
-- Name: report_custom_definitions_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "report_custom_definitions_tenantId_userId_idx" ON public.report_custom_definitions USING btree ("tenantId", "userId");


--
-- Name: report_filter_presets_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "report_filter_presets_tenantId_userId_idx" ON public.report_filter_presets USING btree ("tenantId", "userId");


--
-- Name: report_shares_tenantId_reportId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "report_shares_tenantId_reportId_idx" ON public.report_shares USING btree ("tenantId", "reportId");


--
-- Name: scheduling_resources_tenantId_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "scheduling_resources_tenantId_branchId_idx" ON public.scheduling_resources USING btree ("tenantId", "branchId");


--
-- Name: scheduling_resources_tenantId_resourceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "scheduling_resources_tenantId_resourceType_idx" ON public.scheduling_resources USING btree ("tenantId", "resourceType");


--
-- Name: service_prices_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "service_prices_tenantId_isActive_idx" ON public.service_prices USING btree ("tenantId", "isActive");


--
-- Name: service_prices_tenantId_serviceCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "service_prices_tenantId_serviceCode_key" ON public.service_prices USING btree ("tenantId", "serviceCode");


--
-- Name: staff_invitations_tenantId_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "staff_invitations_tenantId_email_idx" ON public.staff_invitations USING btree ("tenantId", email);


--
-- Name: staff_invitations_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "staff_invitations_tenantId_status_idx" ON public.staff_invitations USING btree ("tenantId", status);


--
-- Name: staff_weekly_schedules_tenantId_userId_dayOfWeek_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "staff_weekly_schedules_tenantId_userId_dayOfWeek_key" ON public.staff_weekly_schedules USING btree ("tenantId", "userId", "dayOfWeek");


--
-- Name: staff_weekly_schedules_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "staff_weekly_schedules_tenantId_userId_idx" ON public.staff_weekly_schedules USING btree ("tenantId", "userId");


--
-- Name: tenant_billing_sequences_tenantId_prefix_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "tenant_billing_sequences_tenantId_prefix_key" ON public.tenant_billing_sequences USING btree ("tenantId", prefix);


--
-- Name: tenant_channel_configs_tenantId_channel_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "tenant_channel_configs_tenantId_channel_key" ON public.tenant_channel_configs USING btree ("tenantId", channel);


--
-- Name: tenants_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tenants_deletedAt_idx" ON public.tenants USING btree ("deletedAt");


--
-- Name: tenants_lifecycleStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tenants_lifecycleStatus_idx" ON public.tenants USING btree ("lifecycleStatus");


--
-- Name: tenants_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_slug_idx ON public.tenants USING btree (slug);


--
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- Name: tenants_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_status_idx ON public.tenants USING btree (status);


--
-- Name: treatment_phases_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "treatment_phases_planId_idx" ON public.treatment_phases USING btree ("planId");


--
-- Name: treatment_plan_items_phaseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "treatment_plan_items_phaseId_idx" ON public.treatment_plan_items USING btree ("phaseId");


--
-- Name: treatment_plan_items_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "treatment_plan_items_tenantId_status_idx" ON public.treatment_plan_items USING btree ("tenantId", status);


--
-- Name: treatment_plans_tenantId_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "treatment_plans_tenantId_patientId_idx" ON public.treatment_plans USING btree ("tenantId", "patientId");


--
-- Name: treatment_plans_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "treatment_plans_tenantId_status_idx" ON public.treatment_plans USING btree ("tenantId", status);


--
-- Name: trusted_devices_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "trusted_devices_tenantId_idx" ON public.trusted_devices USING btree ("tenantId");


--
-- Name: trusted_devices_tokenHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "trusted_devices_tokenHash_idx" ON public.trusted_devices USING btree ("tokenHash");


--
-- Name: trusted_devices_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "trusted_devices_userId_idx" ON public.trusted_devices USING btree ("userId");


--
-- Name: user_branch_access_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_branch_access_tenantId_userId_idx" ON public.user_branch_access USING btree ("tenantId", "userId");


--
-- Name: user_branch_access_userId_branchId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_branch_access_userId_branchId_key" ON public.user_branch_access USING btree ("userId", "branchId");


--
-- Name: user_custom_roles_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_custom_roles_tenantId_userId_idx" ON public.user_custom_roles USING btree ("tenantId", "userId");


--
-- Name: user_custom_roles_userId_customRoleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_custom_roles_userId_customRoleId_key" ON public.user_custom_roles USING btree ("userId", "customRoleId");


--
-- Name: user_dashboard_layouts_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_dashboard_layouts_tenantId_userId_idx" ON public.user_dashboard_layouts USING btree ("tenantId", "userId");


--
-- Name: user_dashboard_layouts_tenantId_userId_profile_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_dashboard_layouts_tenantId_userId_profile_key" ON public.user_dashboard_layouts USING btree ("tenantId", "userId", profile);


--
-- Name: user_device_tokens_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_device_tokens_tenantId_userId_idx" ON public.user_device_tokens USING btree ("tenantId", "userId");


--
-- Name: user_device_tokens_tenantId_userId_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_device_tokens_tenantId_userId_token_key" ON public.user_device_tokens USING btree ("tenantId", "userId", token);


--
-- Name: user_region_access_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_region_access_tenantId_userId_idx" ON public.user_region_access USING btree ("tenantId", "userId");


--
-- Name: user_region_access_userId_regionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_region_access_userId_regionId_key" ON public.user_region_access USING btree ("userId", "regionId");


--
-- Name: user_role_assignments_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_role_assignments_userId_idx" ON public.user_role_assignments USING btree ("userId");


--
-- Name: user_role_assignments_userId_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_role_assignments_userId_role_key" ON public.user_role_assignments USING btree ("userId", role);


--
-- Name: user_saved_filters_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_saved_filters_tenantId_userId_idx" ON public.user_saved_filters USING btree ("tenantId", "userId");


--
-- Name: user_saved_filters_tenantId_userId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_saved_filters_tenantId_userId_name_key" ON public.user_saved_filters USING btree ("tenantId", "userId", name);


--
-- Name: users_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_tenantId_deletedAt_idx" ON public.users USING btree ("tenantId", "deletedAt");


--
-- Name: users_tenantId_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_tenantId_email_key" ON public.users USING btree ("tenantId", email);


--
-- Name: users_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_tenantId_idx" ON public.users USING btree ("tenantId");


--
-- Name: users_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_tenantId_isActive_idx" ON public.users USING btree ("tenantId", "isActive");


--
-- Name: workflow_approvals_tenantId_requestedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_approvals_tenantId_requestedBy_idx" ON public.workflow_approvals USING btree ("tenantId", "requestedBy");


--
-- Name: workflow_approvals_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_approvals_tenantId_status_idx" ON public.workflow_approvals USING btree ("tenantId", status);


--
-- Name: workflow_approvals_tenantId_workflowId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_approvals_tenantId_workflowId_idx" ON public.workflow_approvals USING btree ("tenantId", "workflowId");


--
-- Name: workflow_automation_rules_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_automation_rules_tenantId_isActive_idx" ON public.workflow_automation_rules USING btree ("tenantId", "isActive");


--
-- Name: workflow_execution_logs_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_execution_logs_tenantId_createdAt_idx" ON public.workflow_execution_logs USING btree ("tenantId", "createdAt");


--
-- Name: workflow_execution_logs_tenantId_workflowId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_execution_logs_tenantId_workflowId_idx" ON public.workflow_execution_logs USING btree ("tenantId", "workflowId");


--
-- Name: workflow_saved_filters_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_saved_filters_tenantId_userId_idx" ON public.workflow_saved_filters USING btree ("tenantId", "userId");


--
-- Name: workflow_tasks_tenantId_assigneeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_tasks_tenantId_assigneeId_idx" ON public.workflow_tasks USING btree ("tenantId", "assigneeId");


--
-- Name: workflow_tasks_tenantId_dueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_tasks_tenantId_dueAt_idx" ON public.workflow_tasks USING btree ("tenantId", "dueAt");


--
-- Name: workflow_tasks_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_tasks_tenantId_status_idx" ON public.workflow_tasks USING btree ("tenantId", status);


--
-- Name: workflow_tasks_tenantId_workflowId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_tasks_tenantId_workflowId_idx" ON public.workflow_tasks USING btree ("tenantId", "workflowId");


--
-- Name: workflow_templates_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_templates_tenantId_category_idx" ON public.workflow_templates USING btree ("tenantId", category);


--
-- Name: workflow_templates_tenantId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "workflow_templates_tenantId_key_key" ON public.workflow_templates USING btree ("tenantId", key);


--
-- Name: workflow_templates_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_templates_tenantId_status_idx" ON public.workflow_templates USING btree ("tenantId", status);


--
-- Name: workflows_tenantId_assigneeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_tenantId_assigneeId_idx" ON public.workflows USING btree ("tenantId", "assigneeId");


--
-- Name: workflows_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_tenantId_createdAt_idx" ON public.workflows USING btree ("tenantId", "createdAt");


--
-- Name: workflows_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_tenantId_idx" ON public.workflows USING btree ("tenantId");


--
-- Name: workflows_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_tenantId_status_idx" ON public.workflows USING btree ("tenantId", status);


--
-- Name: workflows_tenantId_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_tenantId_templateId_idx" ON public.workflows USING btree ("tenantId", "templateId");


--
-- Name: ai_conversations ai_conversations_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT "ai_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_messages ai_messages_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public.ai_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_models ai_models_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT "ai_models_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_prompt_versions ai_prompt_versions_promptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompt_versions
    ADD CONSTRAINT "ai_prompt_versions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES public.ai_prompts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_prompts ai_prompts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT "ai_prompts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_tenant_settings ai_tenant_settings_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tenant_settings
    ADD CONSTRAINT "ai_tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_usage_daily ai_usage_daily_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_daily
    ADD CONSTRAINT "ai_usage_daily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: analytics_dashboards analytics_dashboards_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_dashboards
    ADD CONSTRAINT "analytics_dashboards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: analytics_filter_presets analytics_filter_presets_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_filter_presets
    ADD CONSTRAINT "analytics_filter_presets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: analytics_layouts analytics_layouts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_layouts
    ADD CONSTRAINT "analytics_layouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: analytics_metrics analytics_metrics_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_metrics
    ADD CONSTRAINT "analytics_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: analytics_reports analytics_reports_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_reports
    ADD CONSTRAINT "analytics_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointment_templates appointment_templates_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_templates
    ADD CONSTRAINT "appointment_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointment_waitlist appointment_waitlist_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT "appointment_waitlist_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointment_waitlist appointment_waitlist_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT "appointment_waitlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointments appointments_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointments appointments_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_entries audit_entries_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_entries
    ADD CONSTRAINT "audit_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: beauty_annotations beauty_annotations_beautyRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beauty_annotations
    ADD CONSTRAINT "beauty_annotations_beautyRecordId_fkey" FOREIGN KEY ("beautyRecordId") REFERENCES public.beauty_records(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: beauty_procedure_materials beauty_procedure_materials_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beauty_procedure_materials
    ADD CONSTRAINT "beauty_procedure_materials_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: beauty_records beauty_records_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beauty_records
    ADD CONSTRAINT "beauty_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: branch_operating_hours branch_operating_hours_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_operating_hours
    ADD CONSTRAINT "branch_operating_hours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: branches branches_regionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT "branches_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES public.regions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: branches branches_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: caregiver_access_grants caregiver_access_grants_portalAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_access_grants
    ADD CONSTRAINT "caregiver_access_grants_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES public.portal_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cash_sessions cash_sessions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT "cash_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: clinic_subscriptions clinic_subscriptions_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_subscriptions
    ADD CONSTRAINT "clinic_subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: clinic_subscriptions clinic_subscriptions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_subscriptions
    ADD CONSTRAINT "clinic_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: clinical_note_templates clinical_note_templates_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_note_templates
    ADD CONSTRAINT "clinical_note_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: commission_calculations commission_calculations_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT "commission_calculations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_calculations commission_calculations_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT "commission_calculations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_line_items commission_line_items_commissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_line_items
    ADD CONSTRAINT "commission_line_items_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES public.commission_calculations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: commission_rules commission_rules_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT "commission_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: credit_notes credit_notes_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: credit_notes credit_notes_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT "credit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: custom_roles custom_roles_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT "custom_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dental_clinical_notes dental_clinical_notes_dentalRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_clinical_notes
    ADD CONSTRAINT "dental_clinical_notes_dentalRecordId_fkey" FOREIGN KEY ("dentalRecordId") REFERENCES public.dental_records(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: dental_clinical_notes dental_clinical_notes_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_clinical_notes
    ADD CONSTRAINT "dental_clinical_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dental_procedure_materials dental_procedure_materials_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_procedure_materials
    ADD CONSTRAINT "dental_procedure_materials_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dental_records dental_records_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT "dental_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dental_tooth_conditions dental_tooth_conditions_dentalRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_tooth_conditions
    ADD CONSTRAINT "dental_tooth_conditions_dentalRecordId_fkey" FOREIGN KEY ("dentalRecordId") REFERENCES public.dental_records(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: departments departments_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "departments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: departments departments_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: email_verification_tokens email_verification_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: encounter_events encounter_events_encounterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter_events
    ADD CONSTRAINT "encounter_events_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES public.encounters(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: encounters encounters_appointmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "encounters_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: encounters encounters_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: encounters encounters_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "encounters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: implant_records implant_records_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_records
    ADD CONSTRAINT "implant_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_batches inventory_batches_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_batches
    ADD CONSTRAINT "inventory_batches_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_consumption_logs inventory_consumption_logs_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumption_logs
    ADD CONSTRAINT "inventory_consumption_logs_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_consumption_logs inventory_consumption_logs_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumption_logs
    ADD CONSTRAINT "inventory_consumption_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_consumption_logs inventory_consumption_logs_invoiceLineItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumption_logs
    ADD CONSTRAINT "inventory_consumption_logs_invoiceLineItemId_fkey" FOREIGN KEY ("invoiceLineItemId") REFERENCES public.invoice_line_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_disposal_logs inventory_disposal_logs_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_disposal_logs
    ADD CONSTRAINT "inventory_disposal_logs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.inventory_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_disposal_logs inventory_disposal_logs_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_disposal_logs
    ADD CONSTRAINT "inventory_disposal_logs_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_items inventory_items_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.inventory_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT "inventory_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.inventory_suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT "inventory_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_count_lines inventory_stock_count_lines_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_count_lines
    ADD CONSTRAINT "inventory_stock_count_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_count_lines inventory_stock_count_lines_stockCountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_count_lines
    ADD CONSTRAINT "inventory_stock_count_lines_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES public.inventory_stock_counts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_stock_counts inventory_stock_counts_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_counts
    ADD CONSTRAINT "inventory_stock_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_movements inventory_stock_movements_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT "inventory_stock_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_request_lines inventory_stock_request_lines_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_request_lines
    ADD CONSTRAINT "inventory_stock_request_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_request_lines inventory_stock_request_lines_stockRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_request_lines
    ADD CONSTRAINT "inventory_stock_request_lines_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES public.inventory_stock_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_stock_requests inventory_stock_requests_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_requests
    ADD CONSTRAINT "inventory_stock_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_stock_transfer_lines inventory_stock_transfer_lines_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_transfer_lines
    ADD CONSTRAINT "inventory_stock_transfer_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_transfer_lines inventory_stock_transfer_lines_stockTransferId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_transfer_lines
    ADD CONSTRAINT "inventory_stock_transfer_lines_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES public.inventory_stock_transfers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_stock_transfers inventory_stock_transfers_fromWarehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_transfers
    ADD CONSTRAINT "inventory_stock_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_transfers inventory_stock_transfers_toWarehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_transfers
    ADD CONSTRAINT "inventory_stock_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_suppliers inventory_suppliers_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_suppliers
    ADD CONSTRAINT "inventory_suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_warehouse_stock inventory_warehouse_stock_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouse_stock
    ADD CONSTRAINT "inventory_warehouse_stock_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_warehouse_stock inventory_warehouse_stock_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouse_stock
    ADD CONSTRAINT "inventory_warehouse_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_warehouses inventory_warehouses_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT "inventory_warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoice_line_items invoice_line_items_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoice_payments invoice_payments_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoice_refunds invoice_refunds_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_refunds
    ADD CONSTRAINT "invoice_refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoice_refunds invoice_refunds_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_refunds
    ADD CONSTRAINT "invoice_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public.invoice_payments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invoice_refunds invoice_refunds_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_refunds
    ADD CONSTRAINT "invoice_refunds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoice_write_offs invoice_write_offs_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_write_offs
    ADD CONSTRAINT "invoice_write_offs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoice_write_offs invoice_write_offs_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_write_offs
    ADD CONSTRAINT "invoice_write_offs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lab_results lab_results_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT "lab_results_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loyalty_accounts loyalty_accounts_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT "loyalty_accounts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loyalty_accounts loyalty_accounts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT "loyalty_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loyalty_rewards loyalty_rewards_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT "loyalty_rewards_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.loyalty_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loyalty_rewards loyalty_rewards_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT "loyalty_rewards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loyalty_transactions loyalty_transactions_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT "loyalty_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.loyalty_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: media_assets media_assets_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT "media_assets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: media_assets media_assets_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT "media_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: mfa_backup_codes mfa_backup_codes_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_backup_codes
    ADD CONSTRAINT "mfa_backup_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notification_automation_rules notification_automation_rules_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_automation_rules
    ADD CONSTRAINT "notification_automation_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.notification_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notification_automation_rules notification_automation_rules_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_automation_rules
    ADD CONSTRAINT "notification_automation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification_preferences notification_preferences_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT "notification_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification_saved_filters notification_saved_filters_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_saved_filters
    ADD CONSTRAINT "notification_saved_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification_template_versions notification_template_versions_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_template_versions
    ADD CONSTRAINT "notification_template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.notification_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT "notification_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notifications notifications_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.notification_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: operational_reports operational_reports_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_reports
    ADD CONSTRAINT "operational_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orthodontic_cases orthodontic_cases_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orthodontic_cases
    ADD CONSTRAINT "orthodontic_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_addresses patient_addresses_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT "patient_addresses_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_problems patient_problems_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_problems
    ADD CONSTRAINT "patient_problems_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patients patients_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT "patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_plan_installments payment_plan_installments_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plan_installments
    ADD CONSTRAINT "payment_plan_installments_planId_fkey" FOREIGN KEY ("planId") REFERENCES public.payment_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_plans payment_plans_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT "payment_plans_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_plans payment_plans_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT "payment_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_receipts payment_receipts_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_receipts
    ADD CONSTRAINT "payment_receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_receipts payment_receipts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_receipts
    ADD CONSTRAINT "payment_receipts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: periodontal_exams periodontal_exams_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periodontal_exams
    ADD CONSTRAINT "periodontal_exams_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: platform_subscriptions platform_subscriptions_platformTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_subscriptions
    ADD CONSTRAINT "platform_subscriptions_platformTenantId_fkey" FOREIGN KEY ("platformTenantId") REFERENCES public.platform_tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: platform_tenants platform_tenants_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenants
    ADD CONSTRAINT "platform_tenants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: portal_accounts portal_accounts_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_accounts
    ADD CONSTRAINT "portal_accounts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: portal_accounts portal_accounts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_accounts
    ADD CONSTRAINT "portal_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: privileged_access_grants privileged_access_grants_platformTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privileged_access_grants
    ADD CONSTRAINT "privileged_access_grants_platformTenantId_fkey" FOREIGN KEY ("platformTenantId") REFERENCES public.platform_tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: provider_weekly_schedules provider_weekly_schedules_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_weekly_schedules
    ADD CONSTRAINT "provider_weekly_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_order_lines purchase_order_lines_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT "purchase_order_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_order_lines purchase_order_lines_purchaseOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES public.purchase_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.inventory_suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: queue_ticket_events queue_ticket_events_queueTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_ticket_events
    ADD CONSTRAINT "queue_ticket_events_queueTicketId_fkey" FOREIGN KEY ("queueTicketId") REFERENCES public.queue_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: queue_tickets queue_tickets_appointmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tickets
    ADD CONSTRAINT "queue_tickets_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: queue_tickets queue_tickets_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tickets
    ADD CONSTRAINT "queue_tickets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: queue_tickets queue_tickets_resourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tickets
    ADD CONSTRAINT "queue_tickets_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES public.scheduling_resources(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: queue_tickets queue_tickets_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tickets
    ADD CONSTRAINT "queue_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: regions regions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT "regions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: report_custom_definitions report_custom_definitions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_custom_definitions
    ADD CONSTRAINT "report_custom_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: report_filter_presets report_filter_presets_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_filter_presets
    ADD CONSTRAINT "report_filter_presets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: report_shares report_shares_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_shares
    ADD CONSTRAINT "report_shares_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scheduling_resources scheduling_resources_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_resources
    ADD CONSTRAINT "scheduling_resources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_prices service_prices_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_prices
    ADD CONSTRAINT "service_prices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_invitations staff_invitations_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT "staff_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_weekly_schedules staff_weekly_schedules_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_weekly_schedules
    ADD CONSTRAINT "staff_weekly_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_weekly_schedules staff_weekly_schedules_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_weekly_schedules
    ADD CONSTRAINT "staff_weekly_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_billing_sequences tenant_billing_sequences_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_billing_sequences
    ADD CONSTRAINT "tenant_billing_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_channel_configs tenant_channel_configs_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_channel_configs
    ADD CONSTRAINT "tenant_channel_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: treatment_phases treatment_phases_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_phases
    ADD CONSTRAINT "treatment_phases_planId_fkey" FOREIGN KEY ("planId") REFERENCES public.treatment_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: treatment_plan_items treatment_plan_items_dependsOnItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plan_items
    ADD CONSTRAINT "treatment_plan_items_dependsOnItemId_fkey" FOREIGN KEY ("dependsOnItemId") REFERENCES public.treatment_plan_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: treatment_plan_items treatment_plan_items_phaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plan_items
    ADD CONSTRAINT "treatment_plan_items_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES public.treatment_phases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: treatment_plans treatment_plans_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trusted_devices trusted_devices_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_branch_access user_branch_access_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT "user_branch_access_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_branch_access user_branch_access_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT "user_branch_access_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_branch_access user_branch_access_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT "user_branch_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_custom_roles user_custom_roles_customRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT "user_custom_roles_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES public.custom_roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_custom_roles user_custom_roles_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT "user_custom_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_custom_roles user_custom_roles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT "user_custom_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_dashboard_layouts user_dashboard_layouts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_dashboard_layouts
    ADD CONSTRAINT "user_dashboard_layouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_dashboard_layouts user_dashboard_layouts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_dashboard_layouts
    ADD CONSTRAINT "user_dashboard_layouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_region_access user_region_access_regionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_access
    ADD CONSTRAINT "user_region_access_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES public.regions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_region_access user_region_access_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_access
    ADD CONSTRAINT "user_region_access_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_region_access user_region_access_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_region_access
    ADD CONSTRAINT "user_region_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_saved_filters user_saved_filters_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_saved_filters
    ADD CONSTRAINT "user_saved_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_saved_filters user_saved_filters_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_saved_filters
    ADD CONSTRAINT "user_saved_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflow_approvals workflow_approvals_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT "workflow_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflow_approvals workflow_approvals_workflowId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_approvals
    ADD CONSTRAINT "workflow_approvals_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_automation_rules workflow_automation_rules_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_automation_rules
    ADD CONSTRAINT "workflow_automation_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.workflow_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_automation_rules workflow_automation_rules_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_automation_rules
    ADD CONSTRAINT "workflow_automation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflow_execution_logs workflow_execution_logs_workflowId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution_logs
    ADD CONSTRAINT "workflow_execution_logs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: workflow_saved_filters workflow_saved_filters_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_saved_filters
    ADD CONSTRAINT "workflow_saved_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflow_tasks workflow_tasks_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT "workflow_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflow_tasks workflow_tasks_workflowId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT "workflow_tasks_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_templates workflow_templates_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT "workflow_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflows workflows_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.workflow_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflows workflows_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompt_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_tenant_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_tenant_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_dashboards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_dashboards ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_filter_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_filter_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_reminder_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_reminder_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: beauty_annotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beauty_annotations ENABLE ROW LEVEL SECURITY;

--
-- Name: beauty_procedure_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beauty_procedure_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: beauty_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beauty_records ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_operating_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branch_operating_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_note_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_note_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_calculations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_calculations ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: dental_clinical_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dental_clinical_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: dental_procedure_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dental_procedure_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: dental_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dental_records ENABLE ROW LEVEL SECURITY;

--
-- Name: dental_tooth_conditions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dental_tooth_conditions ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: email_verification_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: encounter_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encounter_events ENABLE ROW LEVEL SECURITY;

--
-- Name: encounters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

--
-- Name: implant_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.implant_records ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_consumption_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_consumption_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_disposal_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_disposal_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_count_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_count_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_counts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_counts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_request_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_request_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_transfer_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_transfer_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_warehouse_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_warehouse_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_warehouses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_warehouses ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_refunds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_write_offs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_write_offs ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

--
-- Name: login_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: media_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_backup_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_saved_filters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_saved_filters ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_template_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_template_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: orthodontic_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orthodontic_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_problems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_problems ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_plan_installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: periodontal_exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.periodontal_exams ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_weekly_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_weekly_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: queue_ticket_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_ticket_events ENABLE ROW LEVEL SECURITY;

--
-- Name: queue_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

--
-- Name: report_custom_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_custom_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: report_filter_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_filter_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: report_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduling_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduling_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: service_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_weekly_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_weekly_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_billing_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_billing_sequences ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_channel_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_channel_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_conversations tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_conversations FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_messages tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_messages FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_models tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_models FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompt_versions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_prompt_versions FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.ai_prompts p
  WHERE ((p.id = ai_prompt_versions."promptId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_prompts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_tenant_settings tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_tenant_settings FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_usage_daily tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_usage_daily FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_user_settings tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.ai_user_settings FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_dashboards tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.analytics_dashboards FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_filter_presets tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.analytics_filter_presets FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_layouts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.analytics_layouts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_metrics tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.analytics_metrics FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_reports tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.analytics_reports FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_reminder_logs tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.appointment_reminder_logs FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_templates tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.appointment_templates FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_waitlist tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.appointment_waitlist FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointments tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.appointments FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: audit_entries tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.audit_entries FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_annotations tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.beauty_annotations FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_procedure_materials tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.beauty_procedure_materials FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_records tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.beauty_records FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branch_operating_hours tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.branch_operating_hours FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branches tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.branches FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: cash_sessions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.cash_sessions FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinic_subscriptions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.clinic_subscriptions FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinical_note_templates tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.clinical_note_templates FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_calculations tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.commission_calculations FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_line_items tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.commission_line_items FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_rules tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.commission_rules FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: credit_notes tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.credit_notes FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: custom_roles tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.custom_roles FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_clinical_notes tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.dental_clinical_notes FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_procedure_materials tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.dental_procedure_materials FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_records tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.dental_records FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_tooth_conditions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.dental_tooth_conditions FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: departments tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.departments FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: email_verification_tokens tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.email_verification_tokens FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounter_events tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.encounter_events FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounters tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.encounters FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: implant_records tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.implant_records FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_batches tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_batches FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_categories tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_categories FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_consumption_logs tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_consumption_logs FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_disposal_logs tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_disposal_logs FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_items tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_items FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_count_lines tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_stock_count_lines FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_counts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_stock_counts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_movements tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_stock_movements FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_request_lines tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_stock_request_lines FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_requests tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_stock_requests FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfer_lines tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_stock_transfer_lines FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfers tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_stock_transfers FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_suppliers tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_suppliers FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouse_stock tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_warehouse_stock FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouses tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.inventory_warehouses FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_line_items tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.invoice_line_items FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_payments tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.invoice_payments FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_refunds tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.invoice_refunds FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_write_offs tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.invoice_write_offs FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoices tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.invoices FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: lab_results tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.lab_results FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: login_attempts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.login_attempts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_accounts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.loyalty_accounts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_rewards tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.loyalty_rewards FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_transactions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.loyalty_transactions FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: media_assets tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.media_assets FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: mfa_backup_codes tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.mfa_backup_codes FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_automation_rules tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.notification_automation_rules FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_preferences tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.notification_preferences FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_saved_filters tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.notification_saved_filters FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_template_versions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.notification_template_versions FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.notification_templates p
  WHERE ((p.id = notification_template_versions."templateId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_templates tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.notification_templates FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notifications tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.notifications FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: operational_reports tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.operational_reports FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: orthodontic_cases tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.orthodontic_cases FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: outbox_events tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.outbox_events FOR DELETE USING ((("tenantId" IS NULL) OR ("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: password_reset_tokens tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.password_reset_tokens FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_addresses tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.patient_addresses FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_addresses."patientId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_problems tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.patient_problems FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patients tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.patients FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plan_installments tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.payment_plan_installments FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plans tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.payment_plans FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_receipts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.payment_receipts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: periodontal_exams tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.periodontal_exams FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: portal_accounts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.portal_accounts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: provider_weekly_schedules tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.provider_weekly_schedules FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_order_lines tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.purchase_order_lines FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_orders tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.purchase_orders FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_ticket_events tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.queue_ticket_events FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_tickets tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.queue_tickets FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: refresh_tokens tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.refresh_tokens FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: regions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.regions FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_custom_definitions tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.report_custom_definitions FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_filter_presets tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.report_filter_presets FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_shares tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.report_shares FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: scheduling_resources tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.scheduling_resources FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: service_prices tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.service_prices FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_invitations tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.staff_invitations FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_weekly_schedules tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.staff_weekly_schedules FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_billing_sequences tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.tenant_billing_sequences FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_channel_configs tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.tenant_channel_configs FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_phases tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.treatment_phases FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plan_items tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.treatment_plan_items FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plans tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.treatment_plans FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: trusted_devices tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.trusted_devices FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_branch_access tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.user_branch_access FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_custom_roles tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.user_custom_roles FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_dashboard_layouts tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.user_dashboard_layouts FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_device_tokens tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.user_device_tokens FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_region_access tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.user_region_access FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_role_assignments tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.user_role_assignments FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.users p
  WHERE ((p.id = user_role_assignments."userId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_saved_filters tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.user_saved_filters FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: users tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.users FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_approvals tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.workflow_approvals FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_automation_rules tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.workflow_automation_rules FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_execution_logs tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.workflow_execution_logs FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_saved_filters tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.workflow_saved_filters FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_tasks tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.workflow_tasks FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_templates tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.workflow_templates FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflows tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.workflows FOR DELETE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_conversations tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_conversations FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_messages tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_messages FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_models tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_models FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompt_versions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_prompt_versions FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.ai_prompts p
  WHERE ((p.id = ai_prompt_versions."promptId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_prompts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_tenant_settings tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_tenant_settings FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_usage_daily tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_usage_daily FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_user_settings tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.ai_user_settings FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_dashboards tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.analytics_dashboards FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_filter_presets tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.analytics_filter_presets FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_layouts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.analytics_layouts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_metrics tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.analytics_metrics FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_reports tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.analytics_reports FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_reminder_logs tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.appointment_reminder_logs FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_templates tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.appointment_templates FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_waitlist tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.appointment_waitlist FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointments tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.appointments FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: audit_entries tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.audit_entries FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_annotations tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.beauty_annotations FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_procedure_materials tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.beauty_procedure_materials FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_records tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.beauty_records FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branch_operating_hours tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.branch_operating_hours FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branches tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.branches FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: cash_sessions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.cash_sessions FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinic_subscriptions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.clinic_subscriptions FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinical_note_templates tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.clinical_note_templates FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_calculations tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.commission_calculations FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_line_items tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.commission_line_items FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_rules tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.commission_rules FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: credit_notes tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.credit_notes FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: custom_roles tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.custom_roles FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_clinical_notes tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.dental_clinical_notes FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_procedure_materials tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.dental_procedure_materials FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_records tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.dental_records FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_tooth_conditions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.dental_tooth_conditions FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: departments tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.departments FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: email_verification_tokens tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.email_verification_tokens FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounter_events tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.encounter_events FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounters tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.encounters FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: implant_records tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.implant_records FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_batches tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_batches FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_categories tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_categories FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_consumption_logs tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_consumption_logs FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_disposal_logs tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_disposal_logs FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_items tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_items FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_count_lines tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_stock_count_lines FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_counts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_stock_counts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_movements tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_stock_movements FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_request_lines tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_stock_request_lines FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_requests tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_stock_requests FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfer_lines tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_stock_transfer_lines FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfers tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_stock_transfers FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_suppliers tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_suppliers FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouse_stock tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_warehouse_stock FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouses tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.inventory_warehouses FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_line_items tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.invoice_line_items FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_payments tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.invoice_payments FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_refunds tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.invoice_refunds FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_write_offs tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.invoice_write_offs FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoices tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.invoices FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: lab_results tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.lab_results FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: login_attempts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.login_attempts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_accounts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.loyalty_accounts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_rewards tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.loyalty_rewards FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_transactions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.loyalty_transactions FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: media_assets tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.media_assets FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: mfa_backup_codes tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.mfa_backup_codes FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_automation_rules tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.notification_automation_rules FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_preferences tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.notification_preferences FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_saved_filters tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.notification_saved_filters FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_template_versions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.notification_template_versions FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.notification_templates p
  WHERE ((p.id = notification_template_versions."templateId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_templates tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.notification_templates FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notifications tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.notifications FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: operational_reports tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.operational_reports FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: orthodontic_cases tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.orthodontic_cases FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: outbox_events tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.outbox_events FOR INSERT WITH CHECK ((("tenantId" IS NULL) OR ("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: password_reset_tokens tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.password_reset_tokens FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_addresses tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.patient_addresses FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_addresses."patientId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_problems tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.patient_problems FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patients tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.patients FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plan_installments tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.payment_plan_installments FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plans tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.payment_plans FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_receipts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.payment_receipts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: periodontal_exams tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.periodontal_exams FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: portal_accounts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.portal_accounts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: provider_weekly_schedules tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.provider_weekly_schedules FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_order_lines tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.purchase_order_lines FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_orders tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.purchase_orders FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_ticket_events tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.queue_ticket_events FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_tickets tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.queue_tickets FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: refresh_tokens tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.refresh_tokens FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: regions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.regions FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_custom_definitions tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.report_custom_definitions FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_filter_presets tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.report_filter_presets FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_shares tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.report_shares FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: scheduling_resources tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.scheduling_resources FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: service_prices tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.service_prices FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_invitations tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.staff_invitations FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_weekly_schedules tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.staff_weekly_schedules FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_billing_sequences tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.tenant_billing_sequences FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_channel_configs tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.tenant_channel_configs FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_phases tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.treatment_phases FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plan_items tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.treatment_plan_items FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plans tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.treatment_plans FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: trusted_devices tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.trusted_devices FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_branch_access tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.user_branch_access FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_custom_roles tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.user_custom_roles FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_dashboard_layouts tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.user_dashboard_layouts FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_device_tokens tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.user_device_tokens FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_region_access tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.user_region_access FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_role_assignments tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.user_role_assignments FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.users p
  WHERE ((p.id = user_role_assignments."userId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_saved_filters tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.user_saved_filters FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: users tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.users FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_approvals tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.workflow_approvals FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_automation_rules tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.workflow_automation_rules FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_execution_logs tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.workflow_execution_logs FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_saved_filters tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.workflow_saved_filters FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_tasks tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.workflow_tasks FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_templates tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.workflow_templates FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflows tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.workflows FOR INSERT WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_conversations tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_conversations FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_messages tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_messages FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_models tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_models FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompt_versions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_prompt_versions FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.ai_prompts p
  WHERE ((p.id = ai_prompt_versions."promptId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_prompts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_tenant_settings tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_tenant_settings FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_usage_daily tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_usage_daily FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_user_settings tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.ai_user_settings FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_dashboards tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.analytics_dashboards FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_filter_presets tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.analytics_filter_presets FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_layouts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.analytics_layouts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_metrics tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.analytics_metrics FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_reports tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.analytics_reports FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_reminder_logs tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.appointment_reminder_logs FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_templates tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.appointment_templates FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_waitlist tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.appointment_waitlist FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointments tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.appointments FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: audit_entries tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.audit_entries FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_annotations tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.beauty_annotations FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_procedure_materials tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.beauty_procedure_materials FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_records tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.beauty_records FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branch_operating_hours tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.branch_operating_hours FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branches tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.branches FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: cash_sessions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.cash_sessions FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinic_subscriptions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.clinic_subscriptions FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinical_note_templates tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.clinical_note_templates FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_calculations tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.commission_calculations FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_line_items tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.commission_line_items FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_rules tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.commission_rules FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: credit_notes tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.credit_notes FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: custom_roles tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.custom_roles FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_clinical_notes tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.dental_clinical_notes FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_procedure_materials tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.dental_procedure_materials FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_records tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.dental_records FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_tooth_conditions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.dental_tooth_conditions FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: departments tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.departments FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: email_verification_tokens tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.email_verification_tokens FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounter_events tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.encounter_events FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounters tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.encounters FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: implant_records tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.implant_records FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_batches tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_batches FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_categories tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_categories FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_consumption_logs tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_consumption_logs FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_disposal_logs tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_disposal_logs FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_items tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_items FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_count_lines tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_stock_count_lines FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_counts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_stock_counts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_movements tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_stock_movements FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_request_lines tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_stock_request_lines FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_requests tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_stock_requests FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfer_lines tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_stock_transfer_lines FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfers tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_stock_transfers FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_suppliers tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_suppliers FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouse_stock tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_warehouse_stock FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouses tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.inventory_warehouses FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_line_items tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.invoice_line_items FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_payments tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.invoice_payments FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_refunds tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.invoice_refunds FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_write_offs tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.invoice_write_offs FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoices tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.invoices FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: lab_results tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.lab_results FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: login_attempts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.login_attempts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_accounts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.loyalty_accounts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_rewards tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.loyalty_rewards FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_transactions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.loyalty_transactions FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: media_assets tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.media_assets FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: mfa_backup_codes tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.mfa_backup_codes FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_automation_rules tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.notification_automation_rules FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_preferences tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.notification_preferences FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_saved_filters tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.notification_saved_filters FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_template_versions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.notification_template_versions FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.notification_templates p
  WHERE ((p.id = notification_template_versions."templateId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_templates tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.notification_templates FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notifications tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.notifications FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: operational_reports tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.operational_reports FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: orthodontic_cases tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.orthodontic_cases FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: outbox_events tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.outbox_events FOR SELECT USING ((("tenantId" IS NULL) OR ("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: password_reset_tokens tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.password_reset_tokens FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_addresses tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.patient_addresses FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_addresses."patientId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_problems tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.patient_problems FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patients tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.patients FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plan_installments tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.payment_plan_installments FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plans tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.payment_plans FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_receipts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.payment_receipts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: periodontal_exams tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.periodontal_exams FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: portal_accounts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.portal_accounts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: provider_weekly_schedules tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.provider_weekly_schedules FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_order_lines tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.purchase_order_lines FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_orders tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.purchase_orders FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_ticket_events tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.queue_ticket_events FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_tickets tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.queue_tickets FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: refresh_tokens tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.refresh_tokens FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: regions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.regions FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_custom_definitions tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.report_custom_definitions FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_filter_presets tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.report_filter_presets FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_shares tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.report_shares FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: scheduling_resources tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.scheduling_resources FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: service_prices tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.service_prices FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_invitations tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.staff_invitations FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_weekly_schedules tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.staff_weekly_schedules FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_billing_sequences tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.tenant_billing_sequences FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_channel_configs tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.tenant_channel_configs FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_phases tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.treatment_phases FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plan_items tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.treatment_plan_items FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plans tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.treatment_plans FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: trusted_devices tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.trusted_devices FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_branch_access tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.user_branch_access FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_custom_roles tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.user_custom_roles FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_dashboard_layouts tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.user_dashboard_layouts FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_device_tokens tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.user_device_tokens FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_region_access tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.user_region_access FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_role_assignments tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.user_role_assignments FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users p
  WHERE ((p.id = user_role_assignments."userId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_saved_filters tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.user_saved_filters FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: users tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.users FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_approvals tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.workflow_approvals FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_automation_rules tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.workflow_automation_rules FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_execution_logs tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.workflow_execution_logs FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_saved_filters tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.workflow_saved_filters FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_tasks tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.workflow_tasks FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_templates tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.workflow_templates FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflows tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.workflows FOR SELECT USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_conversations tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_conversations FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_messages tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_messages FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_models tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_models FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompt_versions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_prompt_versions FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.ai_prompts p
  WHERE ((p.id = ai_prompt_versions."promptId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.ai_prompts p
  WHERE ((p.id = ai_prompt_versions."promptId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_prompts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_prompts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_tenant_settings tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_tenant_settings FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_usage_daily tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_usage_daily FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: ai_user_settings tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.ai_user_settings FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_dashboards tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.analytics_dashboards FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_filter_presets tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.analytics_filter_presets FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_layouts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.analytics_layouts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_metrics tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.analytics_metrics FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: analytics_reports tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.analytics_reports FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_reminder_logs tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.appointment_reminder_logs FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_templates tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.appointment_templates FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointment_waitlist tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.appointment_waitlist FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: appointments tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.appointments FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: audit_entries tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.audit_entries FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_annotations tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.beauty_annotations FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_procedure_materials tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.beauty_procedure_materials FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: beauty_records tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.beauty_records FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branch_operating_hours tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.branch_operating_hours FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: branches tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.branches FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: cash_sessions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.cash_sessions FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinic_subscriptions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.clinic_subscriptions FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: clinical_note_templates tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.clinical_note_templates FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_calculations tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.commission_calculations FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_line_items tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.commission_line_items FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: commission_rules tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.commission_rules FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: credit_notes tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.credit_notes FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: custom_roles tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.custom_roles FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_clinical_notes tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.dental_clinical_notes FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_procedure_materials tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.dental_procedure_materials FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_records tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.dental_records FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: dental_tooth_conditions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.dental_tooth_conditions FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: departments tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.departments FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: email_verification_tokens tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.email_verification_tokens FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounter_events tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.encounter_events FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: encounters tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.encounters FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: implant_records tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.implant_records FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_batches tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_batches FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_categories tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_categories FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_consumption_logs tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_consumption_logs FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_disposal_logs tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_disposal_logs FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_items tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_items FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_count_lines tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_stock_count_lines FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_counts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_stock_counts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_movements tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_stock_movements FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_request_lines tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_stock_request_lines FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_requests tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_stock_requests FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfer_lines tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_stock_transfer_lines FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_stock_transfers tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_stock_transfers FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_suppliers tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_suppliers FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouse_stock tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_warehouse_stock FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: inventory_warehouses tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.inventory_warehouses FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_line_items tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.invoice_line_items FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_payments tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.invoice_payments FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_refunds tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.invoice_refunds FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoice_write_offs tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.invoice_write_offs FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: invoices tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.invoices FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: lab_results tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.lab_results FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: login_attempts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.login_attempts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_accounts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.loyalty_accounts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_rewards tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.loyalty_rewards FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: loyalty_transactions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.loyalty_transactions FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: media_assets tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.media_assets FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: mfa_backup_codes tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.mfa_backup_codes FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_automation_rules tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.notification_automation_rules FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_preferences tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.notification_preferences FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_saved_filters tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.notification_saved_filters FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_template_versions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.notification_template_versions FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.notification_templates p
  WHERE ((p.id = notification_template_versions."templateId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.notification_templates p
  WHERE ((p.id = notification_template_versions."templateId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notification_templates tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.notification_templates FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: notifications tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.notifications FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: operational_reports tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.operational_reports FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: orthodontic_cases tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.orthodontic_cases FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: outbox_events tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.outbox_events FOR UPDATE USING ((("tenantId" IS NULL) OR ("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" IS NULL) OR ("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: password_reset_tokens tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.password_reset_tokens FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_addresses tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.patient_addresses FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_addresses."patientId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = patient_addresses."patientId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patient_problems tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.patient_problems FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: patients tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.patients FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plan_installments tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.payment_plan_installments FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_plans tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.payment_plans FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: payment_receipts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.payment_receipts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: periodontal_exams tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.periodontal_exams FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: portal_accounts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.portal_accounts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: provider_weekly_schedules tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.provider_weekly_schedules FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_order_lines tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.purchase_order_lines FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: purchase_orders tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.purchase_orders FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_ticket_events tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.queue_ticket_events FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: queue_tickets tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.queue_tickets FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: refresh_tokens tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.refresh_tokens FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: regions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.regions FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_custom_definitions tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.report_custom_definitions FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_filter_presets tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.report_filter_presets FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: report_shares tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.report_shares FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: scheduling_resources tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.scheduling_resources FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: service_prices tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.service_prices FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_invitations tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.staff_invitations FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: staff_weekly_schedules tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.staff_weekly_schedules FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_billing_sequences tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.tenant_billing_sequences FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: tenant_channel_configs tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.tenant_channel_configs FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_phases tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.treatment_phases FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plan_items tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.treatment_plan_items FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_plans tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.treatment_plans FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: trusted_devices tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.trusted_devices FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_branch_access tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.user_branch_access FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_custom_roles tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.user_custom_roles FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_dashboard_layouts tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.user_dashboard_layouts FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_device_tokens tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.user_device_tokens FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_region_access tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.user_region_access FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_role_assignments tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.user_role_assignments FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.users p
  WHERE ((p.id = user_role_assignments."userId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.users p
  WHERE ((p.id = user_role_assignments."userId") AND (p."tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)))) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: user_saved_filters tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.user_saved_filters FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: users tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.users FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_approvals tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.workflow_approvals FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_automation_rules tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.workflow_automation_rules FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_execution_logs tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.workflow_execution_logs FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_saved_filters tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.workflow_saved_filters FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_tasks tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.workflow_tasks FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflow_templates tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.workflow_templates FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: workflows tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.workflows FOR UPDATE USING ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text))) WITH CHECK ((("tenantId" = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) OR (current_setting('app.platform_rls_bypass'::text, true) = 'true'::text)));


--
-- Name: treatment_phases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_phases ENABLE ROW LEVEL SECURITY;

--
-- Name: treatment_plan_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;

--
-- Name: treatment_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_branch_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_custom_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_dashboard_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: user_device_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_device_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: user_region_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_region_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_role_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_saved_filters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_saved_filters ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_execution_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_saved_filters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_saved_filters ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO booking_app;


--
-- Name: TABLE _prisma_migrations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public._prisma_migrations TO booking_app;


--
-- Name: TABLE ai_conversations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_conversations TO booking_app;


--
-- Name: TABLE ai_messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_messages TO booking_app;


--
-- Name: TABLE ai_models; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_models TO booking_app;


--
-- Name: TABLE ai_prompt_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_prompt_versions TO booking_app;


--
-- Name: TABLE ai_prompts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_prompts TO booking_app;


--
-- Name: TABLE ai_tenant_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_tenant_settings TO booking_app;


--
-- Name: TABLE ai_usage_daily; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_usage_daily TO booking_app;


--
-- Name: TABLE ai_user_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_user_settings TO booking_app;


--
-- Name: TABLE analytics_dashboards; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.analytics_dashboards TO booking_app;


--
-- Name: TABLE analytics_filter_presets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.analytics_filter_presets TO booking_app;


--
-- Name: TABLE analytics_layouts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.analytics_layouts TO booking_app;


--
-- Name: TABLE analytics_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.analytics_metrics TO booking_app;


--
-- Name: TABLE analytics_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.analytics_reports TO booking_app;


--
-- Name: TABLE appointment_reminder_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.appointment_reminder_logs TO booking_app;


--
-- Name: TABLE appointment_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.appointment_templates TO booking_app;


--
-- Name: TABLE appointment_waitlist; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.appointment_waitlist TO booking_app;


--
-- Name: TABLE appointments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.appointments TO booking_app;


--
-- Name: TABLE audit_entries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_entries TO booking_app;


--
-- Name: TABLE beauty_annotations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.beauty_annotations TO booking_app;


--
-- Name: TABLE beauty_procedure_materials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.beauty_procedure_materials TO booking_app;


--
-- Name: TABLE beauty_records; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.beauty_records TO booking_app;


--
-- Name: TABLE branch_operating_hours; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.branch_operating_hours TO booking_app;


--
-- Name: TABLE branches; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.branches TO booking_app;


--
-- Name: TABLE caregiver_access_grants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.caregiver_access_grants TO booking_app;


--
-- Name: TABLE cash_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cash_sessions TO booking_app;


--
-- Name: TABLE clinic_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clinic_subscriptions TO booking_app;


--
-- Name: TABLE clinical_note_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clinical_note_templates TO booking_app;


--
-- Name: TABLE commission_calculations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.commission_calculations TO booking_app;


--
-- Name: TABLE commission_line_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.commission_line_items TO booking_app;


--
-- Name: TABLE commission_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.commission_rules TO booking_app;


--
-- Name: TABLE credit_notes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.credit_notes TO booking_app;


--
-- Name: TABLE custom_roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.custom_roles TO booking_app;


--
-- Name: TABLE dental_clinical_notes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.dental_clinical_notes TO booking_app;


--
-- Name: TABLE dental_procedure_materials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.dental_procedure_materials TO booking_app;


--
-- Name: TABLE dental_records; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.dental_records TO booking_app;


--
-- Name: TABLE dental_tooth_conditions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.dental_tooth_conditions TO booking_app;


--
-- Name: TABLE departments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.departments TO booking_app;


--
-- Name: TABLE email_verification_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.email_verification_tokens TO booking_app;


--
-- Name: TABLE encounter_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.encounter_events TO booking_app;


--
-- Name: TABLE encounters; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.encounters TO booking_app;


--
-- Name: TABLE implant_records; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.implant_records TO booking_app;


--
-- Name: TABLE inventory_batches; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_batches TO booking_app;


--
-- Name: TABLE inventory_categories; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_categories TO booking_app;


--
-- Name: TABLE inventory_consumption_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_consumption_logs TO booking_app;


--
-- Name: TABLE inventory_disposal_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_disposal_logs TO booking_app;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_items TO booking_app;


--
-- Name: TABLE inventory_stock_count_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_count_lines TO booking_app;


--
-- Name: TABLE inventory_stock_counts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_counts TO booking_app;


--
-- Name: TABLE inventory_stock_movements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_movements TO booking_app;


--
-- Name: TABLE inventory_stock_request_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_request_lines TO booking_app;


--
-- Name: TABLE inventory_stock_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_requests TO booking_app;


--
-- Name: TABLE inventory_stock_transfer_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_transfer_lines TO booking_app;


--
-- Name: TABLE inventory_stock_transfers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_transfers TO booking_app;


--
-- Name: TABLE inventory_suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_suppliers TO booking_app;


--
-- Name: TABLE inventory_warehouse_stock; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_warehouse_stock TO booking_app;


--
-- Name: TABLE inventory_warehouses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_warehouses TO booking_app;


--
-- Name: TABLE invoice_line_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.invoice_line_items TO booking_app;


--
-- Name: TABLE invoice_payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.invoice_payments TO booking_app;


--
-- Name: TABLE invoice_refunds; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.invoice_refunds TO booking_app;


--
-- Name: TABLE invoice_write_offs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.invoice_write_offs TO booking_app;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.invoices TO booking_app;


--
-- Name: TABLE lab_results; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lab_results TO booking_app;


--
-- Name: TABLE login_attempts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.login_attempts TO booking_app;


--
-- Name: TABLE loyalty_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_accounts TO booking_app;


--
-- Name: TABLE loyalty_rewards; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_rewards TO booking_app;


--
-- Name: TABLE loyalty_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_transactions TO booking_app;


--
-- Name: TABLE media_assets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.media_assets TO booking_app;


--
-- Name: TABLE mfa_backup_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.mfa_backup_codes TO booking_app;


--
-- Name: TABLE notification_automation_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_automation_rules TO booking_app;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_preferences TO booking_app;


--
-- Name: TABLE notification_saved_filters; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_saved_filters TO booking_app;


--
-- Name: TABLE notification_template_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_template_versions TO booking_app;


--
-- Name: TABLE notification_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_templates TO booking_app;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notifications TO booking_app;


--
-- Name: TABLE operational_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.operational_reports TO booking_app;


--
-- Name: TABLE orthodontic_cases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orthodontic_cases TO booking_app;


--
-- Name: TABLE outbox_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.outbox_events TO booking_app;


--
-- Name: TABLE password_reset_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.password_reset_tokens TO booking_app;


--
-- Name: TABLE patient_addresses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.patient_addresses TO booking_app;


--
-- Name: TABLE patient_problems; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.patient_problems TO booking_app;


--
-- Name: TABLE patients; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.patients TO booking_app;


--
-- Name: TABLE payment_plan_installments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_plan_installments TO booking_app;


--
-- Name: TABLE payment_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_plans TO booking_app;


--
-- Name: TABLE payment_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_receipts TO booking_app;


--
-- Name: TABLE periodontal_exams; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.periodontal_exams TO booking_app;


--
-- Name: TABLE platform_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.platform_subscriptions TO booking_app;


--
-- Name: TABLE platform_tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.platform_tenants TO booking_app;


--
-- Name: TABLE portal_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.portal_accounts TO booking_app;


--
-- Name: TABLE privileged_access_grants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.privileged_access_grants TO booking_app;


--
-- Name: TABLE provider_weekly_schedules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.provider_weekly_schedules TO booking_app;


--
-- Name: TABLE purchase_order_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_order_lines TO booking_app;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_orders TO booking_app;


--
-- Name: TABLE queue_ticket_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.queue_ticket_events TO booking_app;


--
-- Name: TABLE queue_tickets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.queue_tickets TO booking_app;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.refresh_tokens TO booking_app;


--
-- Name: TABLE regions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.regions TO booking_app;


--
-- Name: TABLE report_custom_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.report_custom_definitions TO booking_app;


--
-- Name: TABLE report_filter_presets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.report_filter_presets TO booking_app;


--
-- Name: TABLE report_shares; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.report_shares TO booking_app;


--
-- Name: TABLE scheduling_resources; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.scheduling_resources TO booking_app;


--
-- Name: TABLE service_prices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.service_prices TO booking_app;


--
-- Name: TABLE staff_invitations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.staff_invitations TO booking_app;


--
-- Name: TABLE staff_weekly_schedules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.staff_weekly_schedules TO booking_app;


--
-- Name: TABLE tenant_billing_sequences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_billing_sequences TO booking_app;


--
-- Name: TABLE tenant_channel_configs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_channel_configs TO booking_app;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenants TO booking_app;


--
-- Name: TABLE treatment_phases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.treatment_phases TO booking_app;


--
-- Name: TABLE treatment_plan_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.treatment_plan_items TO booking_app;


--
-- Name: TABLE treatment_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.treatment_plans TO booking_app;


--
-- Name: TABLE trusted_devices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.trusted_devices TO booking_app;


--
-- Name: TABLE user_branch_access; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_branch_access TO booking_app;


--
-- Name: TABLE user_custom_roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_custom_roles TO booking_app;


--
-- Name: TABLE user_dashboard_layouts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_dashboard_layouts TO booking_app;


--
-- Name: TABLE user_device_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_device_tokens TO booking_app;


--
-- Name: TABLE user_region_access; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_region_access TO booking_app;


--
-- Name: TABLE user_role_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_role_assignments TO booking_app;


--
-- Name: TABLE user_saved_filters; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_saved_filters TO booking_app;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO booking_app;


--
-- Name: TABLE workflow_approvals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflow_approvals TO booking_app;


--
-- Name: TABLE workflow_automation_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflow_automation_rules TO booking_app;


--
-- Name: TABLE workflow_execution_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflow_execution_logs TO booking_app;


--
-- Name: TABLE workflow_saved_filters; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflow_saved_filters TO booking_app;


--
-- Name: TABLE workflow_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflow_tasks TO booking_app;


--
-- Name: TABLE workflow_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflow_templates TO booking_app;


--
-- Name: TABLE workflows; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workflows TO booking_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE booking IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO booking_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE booking IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO booking_app;


--
-- PostgreSQL database dump complete
--

\unrestrict k6rVQGQOvjJ0EeG8zM570SVEQfuPxZvYUPoFOTF9gLnfEKGxAF2vfKpsTBtbbsk

