# Healthcare ERP — Product Overview for Clinic Staff & Business Stakeholders

**Audience:** Clinic owners, managers, sales teams, trainers, investors, and customers  
**Last updated:** 2026-07-11  
**Technical audit:** See [`CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md`](./CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md)

---

## What This System Is

This is a **cloud-based clinic management platform** — an all-in-one system for running a healthcare business. It helps clinics manage patients, appointments, clinical records, billing, inventory, staff, and reporting from one place.

Think of it as the **digital backbone of your clinic**: reception books appointments, doctors document visits, accountants issue invoices, managers view performance, and owners control settings and subscriptions.

The platform is designed for:

- **Medical clinics** (general practice, specialists)
- **Dental clinics** (odontogram, treatment plans, imaging)
- **Beauty and aesthetic centers** (consultations, treatment sessions, before/after photos)
- **Multi-specialty centers** that combine several of the above

Each clinic is a separate **tenant** — your data is isolated from other clinics on the platform.

---

## How a Clinic Uses It Every Day

### Morning — Opening the clinic

1. **Reception** logs in and opens **Scheduling** to see today’s appointments.
2. They use **Queue** to check patients in as they arrive.
3. The waiting room display (Queue Display) shows who is being served.

### During the day — Clinical work

4. **Doctors / dentists / beauty specialists** open their patient list or queue.
5. They document the visit in **EMR (Encounters)** or the **Dental** / **Beauty** workspace.
6. Prescriptions, diagnoses, photos, and treatment notes are saved to the patient record.
7. Materials used during treatment can be linked to **Inventory**.

### Front desk & finance

8. **Reception** collects payments through **Billing** (invoices, cashbox, point-of-sale).
9. **Accountants** review outstanding invoices and run financial reports.

### Management

10. **Owners and managers** open the **Dashboard** and **Analytics** for KPIs.
11. They review **Reports**, manage **Users**, and adjust **Settings** (branches, branding, policies).

### Automation

12. **Notifications** send reminders and alerts (when messaging providers are configured).
13. **Workflows** can automate approvals (e.g., stock requests, internal tasks).
14. The **AI Assistant** helps staff with questions about patients or clinic data (within permission limits).

---

## What Each Module Provides

| Module | What it does for your clinic |
|--------|------------------------------|
| **Dashboard** | Today’s overview — appointments, revenue signals, alerts, quick actions |
| **Patients** | Register patients, store contact and medical history, search records |
| **Scheduling** | Book, reschedule, and cancel appointments; manage provider calendars |
| **Queue** | Waiting room management, check-in, call-next-patient flow |
| **EMR (Encounters)** | Document medical visits — complaints, exam, diagnosis, prescriptions |
| **Dental** | Tooth chart (odontogram), treatment plans, dental notes and imaging |
| **Beauty** | Aesthetic consultations, face/body mapping, sessions, before/after media |
| **Inventory** | Stock levels, suppliers, purchase orders, warehouses, expiry tracking |
| **Billing** | Invoices, payments, cashbox, pricing, commissions |
| **Reports** | Operational and financial reports, export to PDF/Excel |
| **Analytics** | Charts and KPIs for finance, patients, operations, clinical activity |
| **Notifications** | Message inbox, templates, delivery tracking, automation rules |
| **Workflow** | Custom approval flows and task tracking |
| **AI Assistant** | Chat-based help using clinic context (with usage limits by plan) |
| **Subscription** | View your plan, features, usage, and billing |
| **Settings** | Clinic profile, branches, branding, security rules, integrations |
| **User Management** | Add staff, assign roles, send invitations |

---

## How Medical, Dental, and Beauty Centers Differ

### Medical clinic

Uses **Patients**, **Scheduling**, **Queue**, **EMR**, **Billing**, and **Inventory** (for consumables). Doctors spend most time in Encounters documenting visits.

### Dental clinic

Adds the **Dental** module: visual tooth chart, treatment planning, periodontal notes, and dental imaging. Billing often ties to planned procedures.

### Beauty / aesthetic center

Uses the **Beauty** module: consultation records, treatment plans, session tracking, and before/after photos. Often integrates with inventory for products used in treatments.

### Multi-specialty center

Uses **several modules together**. The same patient record can flow from a medical visit to a dental or beauty appointment. **Subscriptions** control which modules are enabled for your clinic.

---

## Subscriptions and Modules

Your **subscription plan** determines:

- Which modules you can use (e.g., Workflow, Advanced Analytics, API access)
- Limits on users, branches, and AI usage
- Branding and integration options on higher plans

In the app, locked features show an upgrade message. **Important for buyers:** some limits are enforced strongly in billing and AI; other modules may still be accessible until backend enforcement is fully completed. See the technical audit for details.

Typical plan progression:

| Plan level | Typical access |
|------------|----------------|
| **Starter / Lite** | Core patients, scheduling, EMR, basic billing |
| **Business / Pro** | Inventory, workflows, analytics, notifications automation |
| **Enterprise** | Multi-branch, custom branding, API keys, advanced reporting, platform integrations |

---

## Branches and Users

### Branches

If you operate more than one location, **Settings → Branches** lets you define each branch, hours, and status. Some reports and dashboards can be scoped by branch (especially for owners and accountants).

### Users and roles

Each staff member has a **role** that controls what they see and do:

| Role | Typical responsibilities |
|------|-------------------------|
| **Owner** | Full access, subscription, settings, all reports |
| **General / Branch Manager** | Operations oversight, approvals, reports |
| **Doctor / Dentist / Beauty Specialist** | Clinical documentation for their specialty |
| **Nurse** | Assists with encounters and queue |
| **Receptionist** | Scheduling, check-in, basic billing |
| **Accountant** | Invoices, payments, financial reports |
| **Inventory Manager** | Stock, purchasing, suppliers |

User management is under **Settings → Users** (invitations, role assignment, deactivation).

---

## Patient Data Protection

The platform is built with healthcare privacy in mind:

- **Login required** for all staff areas
- **Role-based access** — reception cannot see everything a doctor sees
- **Tenant isolation** — your clinic’s data is separated from other clinics
- **Audit trails** for important actions (coverage expanding over time)
- **Security settings** — password rules, lockout, optional MFA, session management
- **Maintenance mode** — admins can block access during upgrades

**What to ask your vendor before go-live:**

- Where is data hosted?
- Is encryption used in transit and at rest?
- What is the backup and recovery process?
- Which messaging providers are used for SMS/WhatsApp reminders?

---

## Reports and Analytics for Management

**Reports** give you downloadable snapshots — revenue, appointments, inventory, compliance-style exports.

**Analytics** gives interactive charts — trends over time, comparisons, branch views.

Together they help owners answer:

- How busy are we this month?
- Which services generate the most revenue?
- Are we running low on critical supplies?
- How are individual providers performing?

---

## How AI Assists Staff

The **AI Assistant** is a chat tool inside the dashboard. It can:

- Answer questions about clinic operations
- Help draft or summarize clinical/administrative text (within permissions)
- Use context from the page you are on (e.g., patient or module)

AI usage is **metered by subscription** — higher plans include more requests. Sensitive patient data sent to AI should follow your clinic’s privacy policy and vendor agreements.

---

## Workflows — Automating Operations

**Workflows** reduce manual follow-up:

- Stock request → manager approval → purchase order
- Internal task assignment with due dates
- Multi-step approvals with notifications

Workflows are most valuable on **Business/Enterprise** plans where the workflow module is enabled.

---

## Patient Portal (Current State)

Patients expect to book online and view their appointments. The platform has **backend support** for patient portal accounts, but the **dedicated patient-facing app is not yet built**. Today, staff use the main dashboard; patients typically interact through the clinic directly until the portal is launched.

---

## What Is Ready vs. What Is Still Growing

### Works well today (good for demos and pilot clinics)

- Staff login, roles, and navigation
- Patient records and search
- Appointment scheduling and queue
- Clinical documentation (EMR, dental, beauty)
- Inventory and billing operations
- Notifications, workflows, and settings centers
- AI assistant (with external AI provider configured)

### Still maturing (ask before production commitment)

- **Offline / demo behavior:** If the server is unreachable, some screens may show sample data instead of an error — this must be disabled before live clinical use
- **Patient portal and super-admin apps** — not yet available as standalone products
- **External integrations** — lab, pharmacy, insurance, WhatsApp Business API
- **Automatic backups and enterprise monitoring**
- **Full subscription enforcement on every module**

The technical audit document gives exact percentages and evidence.

---

## Demo Environment

For training and evaluation, a **demo clinic** is seeded with sample users:

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@demo.clinic | Owner123! |
| Doctor | doctor@demo.clinic | Doctor123! |
| Reception | reception@demo.clinic | Reception123! |
| Dentist | dentist@demo.clinic | Dentist123! |
| Accountant | accountant@demo.clinic | Accountant123! |

*(Additional roles exist in seed data — see technical onboarding in the audit doc.)*

---

## Glossary

| Term | Meaning |
|------|---------|
| **Tenant** | Your clinic’s isolated account on the platform |
| **EMR** | Electronic medical record — digital visit documentation |
| **Odontogram** | Dental chart showing tooth conditions |
| **POS** | Point of sale — quick payment at reception |
| **MFA** | Multi-factor authentication — extra login security |
| **Workflow** | Automated steps with approvals and notifications |
| **RBAC** | Role-based access control — permissions by job role |

---

## Summary for Decision Makers

**Strengths:** Broad feature surface, modern staff UI, strong inventory/billing/notifications/settings modules, real PostgreSQL persistence for core clinical and financial data, multi-tenant architecture, AI and workflow capabilities.

**Before production:** Remove demo-data fallbacks, complete security hardening (database isolation, subscription enforcement), messaging integrations, backups, and patient portal.

**Honest overall readiness:** Suitable for **controlled pilots and demos**; **not yet** a complete replacement for a production hospital information system without the gaps listed above.

For engineering detail, module scores, security findings, and implementation order, read [`CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md`](./CURRENT_SYSTEM_AUDIT_AND_EXPLANATION.md).
