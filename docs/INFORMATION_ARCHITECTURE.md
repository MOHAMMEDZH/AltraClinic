# Information Architecture — Enterprise Healthcare Saaas Platform

> **Navigation & shell spec:** [`DESIGN_SYSTEM_BLUEPRINT.md`](./DESIGN_SYSTEM_BLUEPRINT.md) §11 (aligned with permission matrix). This document provides **role-specific menu trees and IA critique**.

Last updated: 2026-06-13

Purpose
- Define the structural organization of the platform across all user roles and experiences.
- Detail navigation patterns, menu hierarchies, sidebar structures, and role-based access to features.
- Include competing-team critique and alternative IA designs.

---

## 1) Core Navigation Principles

### Principles
- **Arabic-first with RTL support**: Primary navigation labels in Arabic; English as fallback.
- **Role-aware**: Navigation surface area adapts to user role and organization size.
- **Contextual**: Navigation changes based on user's current workflow (e.g., during appointment, show quick actions).
- **Mobile-first**: Navigation works equally well on phone, tablet, desktop.
- **Minimal cognitive load**: Maximum 3-4 levels deep; quick search available at all levels.
- **Persistent discovery**: Frequently-used features pinned; less-used features in secondary menu.

---

## 2) Global Menu Structure

### Header (Always Visible)

```
[Logo/Clinic Name] | [Search Box] | [Notifications] | [User Menu] | [Settings]
```

**Search Box**: Global search across patients, appointments, providers, knowledge base, help docs.

**Notifications**: Badge showing unread count; dropdown showing:
- Appointment reminders (1h, 24h before)
- Order/result updates
- Messages from colleagues
- System alerts (low inventory, pending approvals)
- Clear all / Settings link

**User Menu**:
- Profile (edit name, language, timezone)
- Preferences (notifications, display)
- Help & Documentation
- Logout

**Settings**: Organization-level (admin only), Personal preferences (all users)

### Competing-team Critique
- Weakness: Header crowded on mobile; too many icons compete for attention.
- Alternative: Hamburger menu for secondary items; search and notifications only in header.
- Weakness: Global search mixes patients, appointments, docs; unclear results.
- Alternative: Scoped search filters at entry; show "Recent" and "Suggested" to guide.
- Weakness: Notifications delay load if backend slow; users frustrated.
- Alternative: Async notification loading; show placeholder badge count immediately.

---

## 3) Sidebar (Primary Navigation)

### Default Layout (Desktop)

```
┌─────────────────┐
│  [Logo]         │ (Collapsible to icon-only)
├─────────────────┤
│ 🏠 Dashboard    │
│ 📅 Appointments │
│ 👥 Patients     │
│ 📋 Encounters   │
│ 💊 Prescriptions│
│ 🏥 Orders       │
│ 💳 Billing      │
│ 📊 Reports      │
│ ⚙️  Settings    │
│ ❓ Help        │
└─────────────────┘
```

### Responsive Behavior
- **Desktop (> 1024px)**: Sidebar always visible; collapsible to icon-only
- **Tablet (768–1023px)**: Sidebar collapses by default; hamburger to expand
- **Mobile (< 768px)**: Sidebar hidden; hamburger menu in header; bottom tab bar for quick access (Dashboard, Appointments, Patients, Me)

### Competing-team Critique
- Weakness: Static sidebar doesn't show contextual actions; users need multiple clicks to find features.
- Alternative: Contextual sidebar that changes based on current view (e.g., in Appointments, show filters and quick actions).
- Weakness: Icons only when collapsed; unclear what each icon means without hover.
- Alternative: Icon + label always; use compact layout to fit.
- Weakness: Bottom tab bar on mobile misses important features (Reports, Settings).
- Alternative: Prioritize tabs based on role; add "More" tab with drawer menu.

---

## 4) Breadcrumb Navigation

```
Dashboard > Patients > [Patient Name] > Encounters > Encounter [Date]
```

- Always shown below header
- Clickable at each level to jump back
- Current page (last item) not clickable, bold
- Show count or status when relevant: "Patients (1,243)"

### Competing-team Critique
- Weakness: Breadcrumbs take vertical space on mobile; often removed in responsive designs.
- Alternative: Sticky header with breadcrumb in collapsed form (hamburger + current page).
- Weakness: Breadcrumbs don't help if user navigated via search or direct link.
- Alternative: Show "Back to [context]" button instead; infer context from referrer.

---

## 5) Footer (Optional, Desktop Only)

```
© 2026 [Clinic Name] | Privacy | Terms | Support | Version X.Y.Z | Status
```

- Links to legal docs, support, and platform status/changelog
- Minimal and unobtrusive

---

## 6) Role-Based Navigation

Each role sees a customized sidebar. Below are the primary structures.

### 6.1) Doctor / Clinician

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • My Schedule
  • Queue
  • Metrics
  
👥 Patients
  • My Patients
  • Search
  • Recent
  
📋 Encounters
  • New Encounter
  • My Notes
  • Pending Review
  
💊 Orders & Results
  • Create Order
  • Pending Results
  • Past Results
  
📞 Messages
  • Inbox
  • Sent
  • Consultations (referring out)
  
📊 Insights
  • My Performance
  • Guideline Compliance
  • Quality Metrics
  
📚 Resources
  • Clinical Guidelines
  • Drug Interactions
  • Protocols
  
⚙️  Settings
  • My Profile
  • Notification Preferences
  • Signature / Credentials
```

**Competing-team Critique**
- Weakness: Too many top-level items (8); cognitive overload.
- Alternative: Collapse less-used items under "More". Prioritize: Dashboard, Patients, Encounters, Orders, Messages.
- Weakness: "Resources" seems separate from clinical workflow; should be integrated into Encounters/Orders.
- Alternative: Add "Help" button inline in each workflow screen (context-sensitive docs).
- Weakness: Doctor may see appointments in two places (Dashboard > My Schedule, and main Appointments menu).
- Alternative: Single source of truth; Appointments in sidebar only, linked from Dashboard.

### 6.2) Dentist

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • Today's Schedule
  • Waiting Room Queue
  • Treatment Plans (pending approval)
  
👥 Patients
  • My Patients
  • Search
  • Follow-ups Due
  
🦷 Treatment Plans
  • New Plan
  • Active Plans
  • Completed Plans
  • Recalled Patients
  
📸 Imaging
  • Recent Images
  • DICOM Viewer
  • Treatment Comparisons (before/after)
  
💊 Prescriptions & Orders
  • New Prescription
  • Pending Approvals
  • Lab Orders
  
⚙️  Settings
  • My Profile
  • Notification Preferences
  • Signature
```

**Competing-team Critique**
- Weakness: "Imaging" and "Treatment Plans" are separate; should be integrated.
- Alternative: Single "Treatment" section with sub-tabs: Plans, Imaging, Procedures.
- Weakness: Odontogram UI heavy; separate section might hint at complexity.
- Alternative: Quick-access "Odontogram Editor" from Dashboard or Patients view.

### 6.3) Beauty Specialist

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • Today's Schedule
  • Waiting Clients
  • Treatment Consultations (pending)
  
👥 Clients
  • My Clients
  • Search
  • VIP / High-Value
  
✨ Treatments
  • New Consultation
  • Active Treatment Plans
  • Completed Procedures
  • Follow-up Reminders
  
📸 Gallery & Before/After
  • Treatment Photos
  • Consent Forms
  • Client Approvals (for sharing)
  
💄 Products & Inventory
  • Product Usage Log
  • Inventory Status
  • Orders
  
💳 Sales & Commissions
  • Today's Revenue
  • Commission Status
  • Product Upsells
  
⚙️  Settings
  • Profile & Credentials
  • Notification Preferences
  • Commission Preferences
```

**Competing-team Critique**
- Weakness: "Sales & Commissions" business-focused; may feel transactional to specialist.
- Alternative: Rename to "Performance & Earnings"; frame as motivational.
- Weakness: "Gallery & Before/After" separate from Treatments; but closely tied.
- Alternative: Integrate as sub-section of Treatments; show gallery inline in treatment record.

### 6.4) Nurse

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • Today's Triage Queue
  • Pending Tasks
  • Vital Signs Alerts
  
📋 Triage & Tasks
  • New Triage
  • Assigned Tasks
  • Urgent/Follow-ups
  • Medication Admin Log
  
👥 Patients
  • Assigned Patients
  • Recent
  • Search
  
💉 Procedures & Vitals
  • Vital Signs Entry
  • Procedure Prep
  • Post-Op Care Logs
  
📞 Messages & Handoffs
  • Messages from Clinicians
  • Shift Handoffs
  • Care Plans
  
⚙️  Settings
  • Profile
  • Notification Preferences
  • Shift Schedule
```

**Competing-team Critique**
- Weakness: Tasks scattered across "Triage & Tasks" and "Assigned Tasks"; unclear hierarchy.
- Alternative: Single "Tasks" section with views: Triage, Vital Signs, Procedures, Medication.
- Weakness: "Messages & Handoffs" lumps together; should be separate.
- Alternative: Keep separate: "Messages" in global notifications; "Handoffs" in dedicated section.

### 6.5) Receptionist

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • Today's Appointments
  • Waiting Patients
  • Check-in Status
  
📅 Appointments
  • Schedule View
  • New Appointment
  • Reschedule / Cancel
  • No-show List
  
👥 Patients
  • Search
  • New Patient Registration
  • Patient Info Update
  
💳 Check-In & Payments
  • Check-in Workflow
  • Process Payment
  • View Receipts
  • Refunds
  
📞 Messages & Calls
  • Messages from Patients
  • Reminder Queue
  
⚙️  Settings
  • Profile
  • Notification Preferences
```

**Competing-team Critique**
- Weakness: "Check-in & Payments" conflates two different processes; should be separate.
- Alternative: Separate "Check-In" and "Billing" sections for clarity.
- Weakness: Receptionist may not need "Messages from Patients"; feedback arrives via Tickets/Support.
- Alternative: Route patient messages to a "Support Tickets" section instead.

### 6.6) Admin / General Manager

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • KPIs & Metrics (revenue, utilization, no-shows)
  • Staffing Overview
  • Alerts (low inventory, pending approvals)
  
👥 Staff Management
  • Team Directory
  • Schedules & Shifts
  • Permissions & Roles
  • Performance Reviews
  
🏥 Clinic Operations
  • Appointments (overview)
  • Patients (bulk actions)
  • Referrals & Transfers
  
💰 Financials
  • Revenue Dashboard
  • Invoicing & AR
  • Expense Management
  • Payroll & Commissions
  
📊 Inventory & Supplies
  • Stock Levels
  • Purchase Orders
  • Vendors & Suppliers
  • Expiry Tracking
  
📈 Reports & Analytics
  • Pre-built Reports (revenue, patient flow, quality)
  • Custom Report Builder
  • Export / Scheduling
  
⚙️  Settings
  • Organization Profile
  • Billing & Subscription
  • Integration Settings
  • Compliance & Audit Logs
  • User Management
```

**Competing-team Critique**
- Weakness: Too many top-level sections (7–8); admin overwhelmed.
- Alternative: Group into 3–4 major domains: Operations, Financials, Analytics, Settings.
- Weakness: "Clinic Operations" vague; mixes different concerns.
- Alternative: Split into "Scheduling", "Patient Management", "Referrals".

### 6.7) Accountant / Finance

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • Financial Summary (revenue, expenses, profit)
  • Aging Receivables
  • Cash Flow
  
💳 Billing & Invoicing
  • Create Invoice
  • Invoice Queue
  • Aged Receivables (0–30, 30–60, 60+)
  • Payment Tracking
  
🏥 Claims Management
  • Insurance Claims Queue
  • Claim Status
  • Rejections & Appeals
  • Claim Reports
  
💰 Payments & Reconciliation
  • Received Payments
  • Reconcile to Bank
  • Manual Adjustments
  • Write-offs
  
📊 Financial Reports
  • P&L Statement
  • Balance Sheet
  • Cash Flow Report
  • Tax Reports (configurable per locale)
  • Aging Analysis
  
👥 Provider Commissions
  • Commission Statements
  • Payment History
  • Dispute Resolution
  
⚙️  Settings
  • Chart of Accounts
  • Billing Rules & Rates
  • Tax Configuration
  • Export Settings (for accounting software)
  • Audit Logs
```

**Competing-team Critique**
- Weakness: "Claims Management" may be clinic-specific (US); not relevant in Syria.
- Alternative: Make configurable; hide for non-US regions.
- Weakness: "Reconciliation" is critical but buried; should be more prominent.
- Alternative: Top-level section: "Reconciliation & Validation" before other billing tasks.

### 6.8) Inventory Manager

**Primary Sidebar (Desktop)**

```
🏠 Dashboard
  • Stock Summary (low stock alerts, near-expiry)
  • Recent Transactions
  • Top Consumed Items
  
📦 Inventory Management
  • Stock Levels (with filter by location)
  • Receive Goods
  • Count & Audit
  • Waste & Disposal Log
  
🛒 Procurement
  • Create PO
  • PO History
  • Vendor Management
  • Delivery Tracking
  
📋 Stock Forecasting
  • Consumption Trends
  • Recommended Stock Levels
  • Auto-reorder Rules
  
📊 Reports
  • Stock Movement Report
  • Variance Analysis
  • Expiry Report
  • Supplier Performance
  
⚙️  Settings
  • Vendor Catalog
  • Barcode / SKU Settings
  • Stock Thresholds
  • Locations (branches/departments)
```

**Competing-team Critique**
- Weakness: Multi-branch inventory management complex; no clear view of cross-branch stock.
- Alternative: Map view or hierarchical tree showing inventory by location; drag-to-transfer.
- Weakness: "Forecasting" may be overkill for small clinics.
- Alternative: Hide by default; enable for clinics with > 5 high-cost items.

### 6.9) Super Admin / Platform Admin

**Primary Sidebar (Desktop)**

```
🏠 Platform Dashboard
  • System Health (uptime, errors, SLA)
  • Customer KPIs (signups, active, churn)
  • Support Queue
  • Incidents & Alerts
  
🏢 Tenant Management
  • Tenant Directory (search, filter)
  • Tenant Detail (plan, usage, billing)
  • Provision / Deprovision Tenant
  • Tenant Settings Override
  
👥 User Management (Global)
  • All Users (search, filter)
  • Role Assignments
  • Permissions Review
  • Account Lockouts / Resets
  
📊 Monitoring & Logs
  • System Logs (error, debug)
  • Audit Logs (all tenants, all actions)
  • Performance Metrics (CPU, DB, API latency)
  • Alert Configuration
  
🔐 Security & Compliance
  • Security Incidents
  • Vulnerability Management
  • Penetration Test Reports
  • Compliance Dashboard (HIPAA, GDPR, SOC 2)
  • Backup & DR Status
  
💰 Billing & Revenue
  • Subscription Revenue
  • Payment Processor Integration
  • Invoice & Refund Management
  • Usage-Based Billing Details
  
📈 Analytics & Reporting
  • Customer Analytics
  • Product Usage Analytics
  • Custom Report Builder
  • Data Export (for BI tools)
  
⚙️  Settings
  • System Configuration
  • Feature Flags
  • Integration Management
  • Email Templates
  • Support Settings
  • Platform Notifications
```

**Competing-team Critique**
- Weakness: Massive feature set; Super Admin is a catch-all role with too much power.
- Alternative: Split into specialized roles: TenantAdmin, SecurityAdmin, BillingAdmin, SREAdmin.
- Weakness: No time-based access control; SuperAdmin can do anything anytime.
- Alternative: Implement Just-In-Time (JIT) approval for high-risk actions; require peer approval for sensitive operations.
- Weakness: Audit logs may grow unbounded; searching slow.
- Alternative: Stream logs to ELK or Splunk; add indexed search, dashboards, alerts.

---

## 7) Patient Portal Experience

### Patient Portal Sidebar (Mobile-First)

```
🏠 Home
  • Next Appointment
  • Recent Visits
  • Active Prescriptions
  • Pending Payments
  
📅 Appointments
  • Upcoming
  • Past
  • Reschedule / Cancel
  
📋 Medical Records
  • Recent Visits
  • Lab Results
  • Imaging (downloadable)
  • Discharge Summaries
  
💊 Prescriptions & Medications
  • Current Medications
  • Request Refill
  • Prescription History
  
💳 Billing & Payments
  • Recent Invoices
  • View Balance
  • Make Payment
  • Download Receipts
  
📞 Messages
  • Messages from Clinic
  • Request Prescription
  • General Inquiry
  
❤️ Health Tracking (Optional)
  • Vital Signs (if patient enters)
  • Health Goals
  
⚙️  Settings
  • Profile & Contact Info
  • Notification Preferences
  • Language (Arabic / English)
  • Privacy Settings
```

### Competing-team Critique
- Weakness: Patient portal features minimal; limited patient engagement.
- Alternative: Add "Health Insights" dashboard (exercise, diet, medication adherence reminders).
- Weakness: No family member / caregiver access; common in multi-generational households.
- Alternative: Allow patient to grant read-only access to family members or caregivers.
- Weakness: Medical records download is raw data; patients don't understand.
- Alternative: Provide "Patient Summary" view with translations and explanations.

### Patient Portal Account & Access — Implemented (Bounded Context)

The first slice of the Patient Portal is implemented as a dedicated DDD bounded
context at `apps/api/src/modules/patient-portal`. It owns the **portal account**
— a patient's enrollment in self-service — independently of clinical/identity
data, and delivers the caregiver-access capability called out in the critique
above.

- **Aggregate:** `PortalAccount` (root) governs the access lifecycle
  `invited → active → suspended → deactivated` (deactivation is terminal),
  the patient's locale (`ar`/`en`) and notification channel preferences, and a
  bounded set of **caregiver access grants** (read-only, consent-based
  delegations to family members). Caregiver grants are entities local to the
  aggregate — the aggregate is their only consistency boundary.
- **Caregiver access (the IA alternative, now built):** a patient may grant a
  caregiver **read-only** access scoped to any of
  `appointments | medical_records | prescriptions | billing | messages`, with an
  optional future expiry. A defence-in-depth cap (`MAX_ACTIVE_CAREGIVER_GRANTS`)
  bounds simultaneous delegations; deactivating the account cascades revocation
  to all active grants. A pure `CaregiverAccessDomainService` answers "may this
  caregiver read this scope right now?" for downstream consumers.
- **Consent is personal (ABAC):** preferences and caregiver grant/revoke are
  restricted to the **owning patient** (actor === account owner), enforced
  consistently via an ownership guard — RBAC alone cannot express this. Staff
  roles handle enrollment (invite/activate) and governance
  (suspend/reactivate/deactivate) per tiered policy; receptionists are
  deliberately excluded from the governance tier (a security action).
  Caregiver contact details are PII: the read projection **redacts caregiver
  contact/name for staff (non-owner) viewers** (data minimization), exposing only
  grant existence, scopes and status; the owning patient sees full details.
- **Multi-tenancy & audit:** every read is tenant-scoped; one portal account per
  patient per tenant. All security-sensitive actions (invite, activate,
  suspend, reactivate, deactivate, caregiver grant/revoke) are written to the
  central audit trail via a port→adapter bridge, and emit past-tense domain
  events (`PortalAccountInvited`, `…Activated`, `…Suspended`, `…Reactivated`,
  `…Deactivated`, `PortalPreferencesUpdated`, `CaregiverAccessGranted`,
  `CaregiverAccessRevoked`).
- **API:** `patient-portal/accounts` (invite, activate, suspend, reactivate,
  deactivate, preferences, caregiver grant/revoke, get, list) — controllers
  carry no business logic; domain invariant violations map to `409`/`422` at the
  boundary.

The detailed competing-team critique, refactors, intended persistence
schema/indexes, and production-hardening backlog are recorded in
`docs/CTO_REVIEW.md` under "Patient Portal Domain — Implementation & Critical
Review".

---

## 8) Super Admin Portal Experience

### Super Admin Dashboard Layout

```
┌─────────────────────────────────────────────┐
│ [Search Tenant] [Alerts Banner] [User Menu] │
├─────────────────────────────────────────────┤
│ [Left Sidebar]        │ [Main Content Area] │
│ • Dashboard           │ Tenant Overview     │
│ • Tenants             │ • Usage Metrics     │
│ • Users               │ • SLA Status        │
│ • Monitoring          │ • Recent Incidents  │
│ • Security            │                     │
│ • Billing             │                     │
│ • Reports             │                     │
│ • Settings            │                     │
└─────────────────────────────────────────────┘
```

### Competing-team Critique
- Weakness: No quick actions; everything requires deep navigation.
- Alternative: Floating action button or command palette (Cmd/Ctrl+K) for emergency actions.
- Weakness: Tenant search returns large result sets; slow to find.
- Alternative: Add filters (status, plan, region, last login) and saved views.

### Implemented Super Admin Platform

- **Controller/API:** `platform/tenants` exposes tenant provisioning, lifecycle transitions, plan changes, and privileged-access management.
- **Scope:** cross-tenant platform control for `provisioning → active → suspended → archived`, including plan/region management and just-in-time elevated access for System Administrators.
- **Dashboard fit:** the implemented API backs the IA layout with tenant search, platform overview, alerts, and emergency control actions.
- **Security posture:** only platform-level System Administrators can reach the surface; privileged access is time-boxed, audited, and separated by a two-person review rule unless break-glass is used.
- **Localization:** audit descriptions are prepared in Arabic and English so the platform control plane stays bilingual.
- **Critical review:** quick actions still belong in the UI layer; the backend now provides the control primitives needed for command-palette or emergency-action workflows.

---

## 9) Specialty-Specific Information Architectures

### 9.1) Dental Clinic Experience

**Unique Elements**
- Odontogram viewer and editor (charts tooth status)
- Treatment plan builder (multi-step, multi-session procedures)
- Imaging integration (X-rays, intraoral photos, CBCT)
- Recall system (e.g., cleanings every 6 months)
- Multi-provider coordination (hygienist, dentist, specialist)

**Sidebar Customization**
- Patients section shows "Recall Due" filter
- Encounters has "Odontogram" quick-access button
- Dashboard shows "Chart Utilization" and "Treatment Plan Status"

**Competing-team Critique**
- Weakness: Odontogram is specialized; new users intimidated.
- Alternative: Guided onboarding or tooltips; allow simple checkbox mode for small clinics.
- Weakness: Imaging management separate from treatment; should be integrated.
- Alternative: In treatment plan, embedded image viewer; annotate and compare before/after.

### 9.2) Beauty Clinic Experience

**Unique Elements**
- Client profiles (not "patients"; focus on aesthetics, preferences, skin type)
- Before/after photo gallery with consent management
- Product usage tracking (for upsell and inventory)
- Consultation templates (e.g., "skin analysis", "treatment options")
- Loyalty program integration (points, packages, referrals)

**Sidebar Customization**
- "Clients" instead of "Patients"
- "Gallery & Consent" section
- Dashboard shows "VIP Status" and "Sales Performance"
- "Treatments" includes "Package Sales" and "Promotions"

**Competing-team Critique**
- Weakness: "Product Upsell" section feels sales-y; may alienate clinicians.
- Alternative: Frame as "Recommended Products" based on treatment; client-driven, not pushy.
- Weakness: Before/after photos are sensitive; privacy controls unclear.
- Alternative: Require explicit consent per photo; show consent status in gallery; one-click revoke.

### 9.3) Medical Clinic Experience

**Unique Elements**
- Chronic disease management (e.g., diabetes, hypertension panels)
- Lab integration (auto-import results)
- Drug interaction checking
- Clinical decision support (e.g., screening guidelines)
- Referral management (internal or external)

**Sidebar Customization**
- "Patients" shows chronic disease filters (e.g., "Diabetic patients overdue for A1C")
- "Orders & Results" is prominent (core workflow)
- Dashboard shows "Quality Metrics" (e.g., % of hypertensive patients at goal BP)
- "Resources" includes clinical guidelines and protocols

**Competing-team Critique**
- Weakness: Clinical decision support may interfere with provider judgment.
- Alternative: Frame as "suggestions" or "prompts", not mandatory overrides.
- Weakness: Lab result import may fail silently; provider unaware of missing data.
- Alternative: Status indicator in Encounters; show "Pending Results" with retry option.

### 9.4) Multi-Specialty Hospital Experience

**Unique Elements**
- Department/Specialty routing
- Inter-departmental referrals
- Bed management and admission/discharge
- OR scheduling
- Case conferencing
- Discharge planning

**Sidebar Customization**
- "Departments" section (switchable context)
- "Referrals" section (incoming/outgoing)
- "Admissions" or "Inpatient" section (if applicable)
- "Case Management" section
- Department-specific views (e.g., Surgery shows "OR Schedule", Radiology shows "Worklist")

**Competing-team Critique**
- Weakness: Multi-department complexity; users get lost switching contexts.
- Alternative: Persistent "Department" selector in header; sidebar updates dynamically.
- Weakness: Referrals not standardized; leads to miscommunication.
- Alternative: Structured referral form; auto-route based on specialty; track time-to-response.

---

## 10) Navigation Patterns (Interaction Design, IA-level)

### 10.1) Hierarchical Navigation
Used for deep features (e.g., Patient > Encounters > Encounter Detail > Orders > Order Detail).

```
Level 1: Sidebar → Main section
Level 2: Tabs or sub-menu
Level 3: List or details view
Level 4: Inline editing or drilldown
```

**Competing-team Critique**
- Weakness: Deep nesting feels slow; users want quick access to common tasks.
- Alternative: Breadcrumbs + quick-jump search; allow shortcut from any level.

### 10.2) Tab-Based Navigation
Used for related views of same entity (e.g., Patient tab: Overview, Encounters, Orders, Billing).

```
[Tab: Overview] [Tab: Encounters] [Tab: Orders] [Tab: Billing]
```

**Competing-team Critique**
- Weakness: Too many tabs (>6) make it hard to find content.
- Alternative: Use "More" dropdown or pagination.

### 10.3) Filter & View Navigation
Used for lists (e.g., Appointments with filters: provider, status, date range).

```
[Filters: Provider ▼, Status ▼, Date ▼] [Search] [View: List / Calendar / Kanban]
```

**Competing-team Critique**
- Weakness: Filters are stateless; if user leaves page and returns, filters reset.
- Alternative: Save filter presets; auto-restore last used filters.

### 10.4) Contextual Actions (Quick Actions)
Short-cut buttons contextually shown based on user role and current view.

```
In Appointments view for Receptionist:
Quick Actions: [+ New Appointment] [📞 Call Patient] [✓ Check-in] [💳 Process Payment]
```

**Competing-team Critique**
- Weakness: Too many quick actions clutter UI.
- Alternative: Show top 3; rest in "More" menu; prioritize by role and frequency.

### 10.5) Search & Command Palette
Global search (Cmd+K or Ctrl+K) to jump to any feature or entity.

```
Cmd+K
> "patient:ahmed"  → Jump to patient Ahmed
> "appointment:today"  → Show today's appointments
> "prescription"  → Search prescriptions
> "settings"  → Jump to settings
```

**Competing-team Critique**
- Weakness: Command palette not discoverable; users don't know it exists.
- Alternative: Tooltip on first login; keyboard shortcut hint in help.
- Weakness: Search results ranked poorly; wrong item at top.
- Alternative: Personalize ranking based on user's recent history.

---

## 11) Multi-Tenancy & Organization Structure (IA Level)

### Single Clinic (Small Organization)
- Simple flat structure
- One "branch" or "location"
- Sidebar shows features directly (no "Organization" layer)

### Multi-Branch Organization
- Hierarchy: Organization > Branch > Department
- Sidebar includes "Branch Selector" (dropdown or switcher)
- Dashboard shows org-wide KPIs with branch filter

```
[Organization: Main Clinic Network]
├── Branch: Downtown Clinic
├── Branch: Suburb Clinic
└── Branch: Mall Clinic
```

### Competing-team Critique
- Weakness: Branch switching requires reload or full context switch; disorienting.
- Alternative: Sticky "Branch" selector in header; sidebar stays consistent.
- Weakness: Data from different branches not easily compared.
- Alternative: Add "Cross-branch" view in Dashboard; multi-branch analytics.

---

## 12) Accessibility in Information Architecture

### Keyboard Navigation
- All sidebar items accessible via Tab
- Arrow keys to navigate menu items
- Enter to select
- Esc to close menus

### Screen Reader Support
- Semantic HTML (nav, section, article tags)
- ARIA labels on icon buttons ("Dashboard", not just 🏠)
- Status messages announced (e.g., "3 new messages")

### Color & Contrast
- Active menu item uses high-contrast highlight, not color alone
- Icons paired with text; no icon-only nav

### Competing-team Critique
- Weakness: RTL and accessibility often conflict in implementation.
- Alternative: Test with Arabic-speaking screen reader users; use native RTL support libraries.

---

## 13) Performance & Loading State in Navigation

### Lazy Loading
- Don't load all sidebar items upfront; load dynamically as needed
- Reduce initial page load; show skeleton loaders

### Caching
- Cache sidebar structure (role + org) for 1 hour or until role changes
- Cache patient/appointment lists for quick access

### Offline Navigation
- Cache last-viewed pages; allow offline navigation within cached content
- Show "offline" badge on navigation; highlight sync-pending items

---

## 14) Onboarding & Progressive Disclosure

### New User Onboarding
- First login shows simplified sidebar (core features only)
- Gradually unlock advanced features based on usage patterns
- Tooltips and guided tours for key workflows

### Role-Based Progressive Disclosure
- Doctor sees only clinical features; don't overwhelm with billing
- Admin sees everything but with clear grouping

### Competing-team Critique
- Weakness: Progressive disclosure hides features; users feel constrained.
- Alternative: Show all features; highlight recommended ones for role via icons or badges.

---

## 15) Next Steps & IA Rollout

### Phase 1: MVP Navigation
- Focus on core roles: Doctor, Receptionist, Patient, Admin
- Simple sidebar, minimal nesting
- Dashboard with quick actions

### Phase 2: Enhanced Navigation
- Add specialty-specific sidebars (Dental, Beauty, Multi-Specialty)
- Implement command palette
- Add contextual actions

### Phase 3: Advanced Features
- Progressive disclosure and onboarding
- Multi-branch navigation
- Advanced filtering and saved views

### Testing & Validation
- Conduct IA testing with target users (clinicians, receptionists, patients) in Syria
- Test on slow networks and low-end devices
- Validate RTL and Arabic label clarity
- Measure task completion time for critical workflows

---

## Design Principles Checklist

- [ ] RTL fully supported; Arabic text flows naturally
- [ ] Role-based access enforced; users don't see features they can't access
- [ ] Mobile-first; navigation works on 2G connection
- [ ] 3 clicks max to critical features (Dashboard, Patients, Appointments)
- [ ] All navigation accessible to keyboard and screen readers
- [ ] Search available globally (Cmd/Ctrl+K)
- [ ] Offline navigation works for cached content
- [ ] Confirmation required for destructive actions (delete, deprovision)
- [ ] Status/state clear throughout (online, syncing, offline, errors)
- [ ] Performance: navigation renders in < 100ms

