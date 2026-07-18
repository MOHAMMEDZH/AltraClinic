# Personas — Enterprise Healthcare Saaas Platform

> **Role dashboard & nav matrix:** [`DESIGN_SYSTEM_BLUEPRINT.md`](./DESIGN_SYSTEM_BLUEPRINT.md) §9, §11, §12.

Last updated: 2026-06-13

Purpose
- Define primary system personas, their goals, responsibilities, pain points, required permissions, KPIs, reports, and screens.
- For each persona include a critical "competing-team" review: weaknesses, trade-offs, and better alternatives.

Format for each persona
- Goals
- Responsibilities
- Pain Points
- Permissions (recommended minimum and restrictions)
- KPIs
- Required Reports
- Required Screens
- Competing-team critique and alternative recommendations

1) Owner
- Goals: Maximize clinic profitability, ensure regulatory compliance, scale multi-branch operations, minimize operational risk.
- Responsibilities: Strategic decisions, budgets, partnerships, SLA approvals, high-level vendor selection.
- Pain Points: Lack of consolidated financial visibility, unpredictable costs, legal/regulatory exposure, slow ROI from digitization.
- Permissions: Read-only access to consolidated dashboards; approve high-risk actions; receive security & compliance reports; billing and subscription management.
- KPIs: ARR per branch, EBITDA margin, average revenue per visit, patient retention, net promoter score (NPS).
- Required Reports: Consolidated P&L, branch performance, compliance audit summary, contract/SLA status.
- Required Screens: Executive dashboard (multi-branch), billing & subscriptions, compliance & audit center, partner marketplace.
- Critique & alternatives: Owners often need more control than read-only. Offer role-scoped delegated approvals and financial drilldowns while preserving separation of duties. Consider an "Owner Advisor" workflow that simulates pricing and ROI scenarios before committing.

2) CEO
- Goals: Strategic growth, brand reputation, market expansion, investor reporting.
- Responsibilities: Market strategy, partnerships, fundraising oversight, executive reporting.
- Pain Points: Lack of timely adoption metrics, difficulty linking product improvements to business outcomes.
- Permissions: Executive dashboards, high-level operational KPIs, access to audit & risk summaries.
- KPIs: Growth rate, customer acquisition cost (CAC), lifetime value (LTV), churn, partner channel revenue.
- Required Reports: Investor-grade monthly results, GTM funnels, churn analysis, security posture summary.
- Required Screens: Executive KPIs, GTM analytics, churn & retention analytics, partner performance.
- Critique & alternatives: CEOs need both macro and timely micro-level signals. Provide configurable alerting and executive scorecards. Offer an "insights assistant" that translates operational metrics into business impact narratives.

3) General Manager
- Goals: Operational efficiency across branches, staffing optimization, service quality.
- Responsibilities: Daily operations, resource allocation, staff scheduling, escalation handling.
- Pain Points: Scheduling conflicts, no-shows, inventory shortages across branches, fragmented reporting.
- Permissions: Multi-branch operational controls, manage schedules, view financial & clinical KPIs, approve local discounts.
- KPIs: Utilization rate, average appointment lead time, no-show rate, staff productivity, revenue per clinician.
- Required Reports: Branch operational summary, staff schedules, daily cash reconciliation, appointment forecasts.
- Required Screens: Multi-branch calendar, staff roster & time tracking, operational alerts, inventory snapshot.
- Critique & alternatives: Operational managers need predictive recommendations. Add capacity planning AI and proactive supply alerts. Consider delegated automation rules for recurring actions to free manager time.

4) Doctor
- Goals: Provide safe, effective clinical care; maintain accurate records efficiently; minimize administrative burden.
- Responsibilities: Clinical assessments, documentation, ordering tests, prescribing, follow-up care.
- Pain Points: Time-consuming documentation, poor UX on low-bandwidth devices, lost context when offline sync conflicts occur.
- Permissions: Read/write access to assigned patient records, order creation, view lab/imaging results, sign-off authority for clinical notes.
- KPIs: Clinical throughput, documentation time per encounter, guideline adherence, patient outcomes, follow-up completion rate.
- Required Reports: Patient panel health summary, overdue follow-ups, prescribing patterns, quality metrics.
- Required Screens: Encounter view with problem list, templates, orders & results, inbox, offline workspace.
- Critique & alternatives: Doctors reject heavy templates. Offer micro-interactions and predictive suggestions; prioritize voice-to-text and structured capture that minimizes clicks. For safety, implement immutable audit trails and an easy revert/annotate mechanism for merges.

5) Dentist
- Goals: Deliver efficient dental care, manage treatment plans, handle imaging and procedure scheduling.
- Responsibilities: Dental charting, treatment plans, imaging review, procedure authorizations.
- Pain Points: Complex odontograms on small screens, offline image handling, high data size for imaging, billing code mismatches.
- Permissions: Full access to dental charts for assigned patients, image annotation tools, treatment approval, chair-side quick-capture.
- KPIs: Procedure completion rate, average treatment plan acceptance, imaging turnaround time, chair utilization.
- Required Reports: Treatment plan backlog, imaging utilization, revenue by procedure, recall lists.
- Required Screens: Odontogram editor, imaging viewer, treatment plan builder, chair-side quick-entry.
- Critique & alternatives: Odontogram UX must be optimized for touch and offline; consider vector-based lightweight formats and edge caching. Provide integration adapters for local imaging centers and background image compression with resumable uploads.

6) Beauty Specialist
- Goals: Deliver cosmetic procedures safely, manage consultations and product inventories, ensure client satisfaction.
- Responsibilities: Consultations, treatment planning, tracking procedures and product usage, pre/post-care instructions.
- Pain Points: Scheduling complex multi-session treatments, product stockouts, compliance with treatment consent forms.
- Permissions: Access to assigned client records, treatment plans, consent capture, product usage logs.
- KPIs: Treatment conversion rate, client satisfaction, repeat bookings, product consumption per treatment.
- Required Reports: Treatment calendar, consent logs, inventory consumption per specialist, revenue per treatment.
- Required Screens: Consultation template, treatment progress tracker, consent form capture, before/after galleries.
- Critique & alternatives: Beauty workflows often require rich media; implement efficient image delta storage and consent capture that binds media to records. Consider templated clinical photography workflows to standardize before/after documentation.

7) Nurse
- Goals: Support clinicians, ensure patient safety, manage triage and follow-ups.
- Responsibilities: Triage, vitals collection, preparation for procedures, patient education, medication administration logs.
- Pain Points: Interrupt-driven work, repetitive documentation, needing quick offline access to care plans.
- Permissions: Read/write to assigned patient tasks, vitals entry, medication administration records, scheduled task lists.
- KPIs: Time-to-triage, medication error rate, task completion rate, patient education completion.
- Required Reports: Task lists, overdue tasks, medication logs, daily patient handovers.
- Required Screens: Triage dashboard, task queue, vitals capture with offline fallback, handover summaries.
- Critique & alternatives: Nurses need ultra-fast entry UIs and task batching. Provide voice shortcuts, configurable quick-forms, and mobile-optimized task workflows. Consider automating routine tasks from device integrations (BP cuffs, glucometers).

8) Assistant
- Goals: Streamline clinician workflows, facilitate documentation, maintain clinic flow.
- Responsibilities: Prepare patients, enter data, handle minor admin tasks, manage supplies.
- Pain Points: Cluttered UIs, unclear task priorities, conflicts with clinician schedules.
- Permissions: Create preliminary records, schedule appointments, update inventory counts, limited editing of clinical documents with audit.
- KPIs: Turnaround time for prep tasks, scheduling accuracy, inventory reconciliation accuracy.
- Required Reports: Daily task completion, prep time per clinician, inventory adjustment logs.
- Required Screens: Prep queue, checklists, quick patient lookup, supply requests.
- Critique & alternatives: Assistants often need clear task prioritization. Implement visual priority queues tied to clinician status and SLA-driven alerts. Allow temporary task delegation with audit.

9) Receptionist
- Goals: Efficient patient intake, scheduling, payments, and first-line support.
- Responsibilities: Bookings, check-ins, payments, patient orientation, consent collection.
- Pain Points: Overbooking, slow device performance on low bandwidth, payment reconciliation errors.
- Permissions: Appointment booking, check-in/out, patient demographic edits, payments (cash/terminal), view limited clinical context for routing.
- KPIs: Check-in time, scheduling utilization, payment reconciliation accuracy, call-to-book conversion.
- Required Reports: Daily schedule, no-show list, payments summary, patient demographics changes.
- Required Screens: Appointment book, check-in kiosk workflow, payment & receipts, quick patient search.
- Critique & alternatives: Receptionists need offline resilience for check-in and payments; offer a lightweight kiosk mode and pre-authorization capture to reduce onsite friction. Integrate local payment gateway fallbacks.

10) Accountant
- Goals: Accurate financial records, timely invoicing, regulatory tax compliance, reconciled ledgers.
- Responsibilities: Billing, insurance claims mapping, tax reporting, payroll support.
- Pain Points: Complex insurance/claims mapping, multi-currency handling, late payment reconciliation, lack of packaged reports for local tax rules.
- Permissions: Billing module full access, exportable ledgers, journal entries, financial report generation; restricted access to PHI unless necessary.
- KPIs: Days Sales Outstanding (DSO), billing error rate, claim acceptance rate, revenue reconciliation accuracy.
- Required Reports: Ledger exports, aged receivables, claim status, tax reports, reconciliation statements.
- Required Screens: Billing dashboard, claims queue, invoice generator, reconciliation tools.
- Critique & alternatives: Accountants need auditable, immutable transaction trails. Offer configurable billing engines and templates for local tax rules. Provide reconciliation automation and smart-matching algorithms for payments.

11) Inventory Manager
- Goals: Minimize stockouts and overstock, ensure traceability for regulated items, control costs.
- Responsibilities: Procurement, stock audits, consumable forecasting, vendor management.
- Pain Points: Fragmented inventory across branches, expired/near-expiry items, manual counts, lack of integration with billing.
- Permissions: Inventory CRUD, purchase orders, stock adjustments, reporting, vendor catalogs; restricted write on clinical records.
- KPIs: Stockout rate, inventory turnover, wastage/expiry rate, procurement lead time.
- Required Reports: Stock levels, near-expiry items, consumption trends, purchase history.
- Required Screens: Stock dashboard, PO creation, receiving workflows, audit & cycle counts.
- Critique & alternatives: For multi-branch setups, recommend hierarchical inventory with auto-transfer suggestions and inter-branch requisition. Integrate barcode/QR workflows and optional IoT sensors for fridges and secure cabinets.

12) Patient
- Goals: Access care, view records, manage appointments, receive clear instructions and bills in Arabic.
- Responsibilities: Keep personal info up to date, attend appointments, consent to treatments, follow care plans.
- Pain Points: Complex clinical language, unreliable internet for portal access, privacy concerns, fragmented billing info.
- Permissions: View own records, appointment booking, messaging clinicians, pay bills, provide consents.
- KPIs: Appointment attendance, patient satisfaction (NPS), time-to-message response, portal engagement.
- Required Reports: Visit summary, billing statements, upcoming appointment reminders, care plan checklist.
- Required Screens: Patient portal (Arabic-first), appointment manager, messaging center, bills & receipts.
- Critique & alternatives: Patients need low-friction authentication and privacy-preserving channels. Provide SMS/WhatsApp integration for low-bandwidth users, progressive profile completion, and ephemeral access tokens for shared caregivers.

13) Super Admin
- Goals: Maintain platform integrity, onboarding/offs boarding tenants, enforce security, manage global settings.
- Responsibilities: Tenant provisioning, compliance oversight, platform monitoring, emergency access, system-wide configuration, backups and DR orchestration.
- Pain Points: Balancing tenant autonomy with platform security, responding to cross-tenant incidents, data residency requirements.
- Permissions: Full system-level access, tenant-level overrides, audit log access, ability to run migrations and emergency data exports.
- KPIs: Mean time to provision, incident response SLAs, number of cross-tenant incidents, audit closure rate.
- Required Reports: Platform health, security incidents, tenant compliance posture, resource utilization.
- Required Screens: Global admin console, tenant manager, audit & incident center, backup & DR controls.
- Critique & alternatives: Super Admin power must be tightly controlled. Enforce JIT access, approval workflows for destructive operations, and multi-party authorization for sensitive actions. Provide clear segregation of duties and change logs.

Cross-persona observations (competing-team synthesis)
- Weakness: Permission granularity is often coarse; propose RBAC with attribute-based controls (ABAC) for context-aware permissions (time, location, device).
- Weakness: Offline behavior and sync merging policies are risk areas for clinical safety; prioritize narrow clinical contracts for first offline iterations and formal reconciliation UIs.
- Weakness: Reporting needs vary by persona and locale — include customizable report builders and scheduled exports with templates per local regulation.
- Weakness: Media-heavy workflows (imaging, photos) are expensive on bandwidth; recommend adaptive compression, progressive loading, and edge caching.
- Alternative governance: Introduce a Federated Governance model where local partners hold certain compliance/hosting responsibilities while platform enforces global controls.

Recommendations & next steps
- Validate personas with in-country user research (interviews, shadowing) and prioritize UI/UX prototypes per role.
- Define ABAC/RBAC permission matrix and map to screens and APIs.
- Create a prioritized backlog: offline-sync pilot (narrow scope), RBAC/ABAC design, executive dashboards, inventory inter-branch flows.
- Produce role-specific acceptance criteria and test scenarios for QA and clinical validation.
