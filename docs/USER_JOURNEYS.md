# User Journeys — Enterprise Healthcare Saaas Platform

Last updated: 2026-06-13

Purpose
- Map critical user journeys across clinical, operational, and business workflows.
- Include detailed workflow diagrams, decision points, error paths, and offline behavior.
- For each journey, include competing-team critique, weaknesses, and alternative designs.

---

## 1) Patient Registration

### Primary Flow

```
START
  ↓
[User lands on portal or clinic directs]
  ↓
[Collect demographics: name, phone, DOB, address, language preference]
  ↓
[Collect contact preferences: SMS, WhatsApp, Email]
  ↓
[Consent capture: privacy, telehealth, comms]
  ↓
[Generate unique patient ID]
  ↓
[Option: Schedule initial appointment]
  ↓
[Confirmation message (SMS/Email in preferred language)]
  ↓
END

```

### Key Screens
- Registration form (Arabic-first, RTL)
- Consent checklist with toggles
- Confirmation page with patient ID and next steps
- Optional: quick appointment picker

### Offline Behavior
- Form draft saved locally with sync flag
- Auto-sync on connection restored; if conflict (duplicate ID detected), prompt user to link to existing record

### Offline Alternative
- Queue registration for later if no connection; generate temporary local ID that syncs on reconnect

### Competing-team Critique & Alternatives
- Weakness: Collecting all data upfront creates friction; many patients abandon halfway.
- Alternative: Progressive profiling — collect essential fields (name, phone) immediately, ask for detailed info at first appointment.
- Weakness: Single language preference misses multilingual households.
- Alternative: Allow multiple language preferences per household contact; dynamically route notifications.
- Weakness: No validation that phone/email are reachable; leads to bounced confirmations.
- Alternative: Require SMS/WhatsApp confirmation (one-time code) before registration completes; offer email as secondary.

### Approval Workflows
- None for patient self-registration; auto-approved.
- Admin may flag suspicious registrations (e.g., multiple registrations same phone within 24h) for manual review.

---

## 2) Appointment Booking

### Primary Flow

```
START
  ↓
[Patient/Clinic staff open appointment book]
  ↓
[Select clinic/branch and provider]
  ↓
[Filter by appointment type: consultation, procedure, follow-up]
  ↓
[Display available slots (respects provider schedule, buffer time, break rules)]
  ↓
[Patient selects time slot]
  ↓
[Confirm appointment details (date, time, provider, reason)]
  ↓
[Collect chief complaint / reason for visit (optional)]
  ↓
[Confirmation SMS/WhatsApp/Email sent to patient]
  ↓
[Calendar entry created; provider notified]
  ↓
[Patient receives reminder 24h and 1h before appointment]
  ↓
END

```

### Offline Behavior (Receptionist/Clinic Staff)
- Locally cache provider schedules and availability
- Allow booking offline; sync when online
- If conflict detected (slot was booked by another user), prompt to pick alternative

### Offline Alternative
- Show cached "last known availability"; mark as tentative until sync confirms

### Key Screens
- Calendar view with provider availability (multi-branch support)
- Slot picker with reason/type dropdown
- Confirmation modal
- Reminders dashboard (patient view)

### Competing-team Critique & Alternatives
- Weakness: Clinic may not show real-time availability if network is poor; patients book slots that are actually full.
- Alternative: Show "last updated X minutes ago" badge; allow predictive slot recommendation based on no-show patterns.
- Weakness: No buffer time logic between appointments; back-to-back bookings cause provider burnout.
- Alternative: Enforce configurable buffer/transition time rules per provider and appointment type; show "recommended next available" after buffer.
- Weakness: Patients don't know expected wait time or procedure duration; leads to dissatisfaction.
- Alternative: Show estimated wait time, procedure duration, and prep requirements upfront.
- Weakness: Appointments booked but not confirmed by clinic; unclear if slot is truly reserved.
- Alternative: Add appointment status: pending clinic confirmation → confirmed → checked-in. Notify clinic of pending confirmations.

---

## 3) Check-In

### Primary Flow

```
START
  ↓
[Patient arrives at clinic; approaches reception or kiosk]
  ↓
[Receptionist / Kiosk: search patient by phone, name, or QR code]
  ↓
[Verify patient identity and appointment]
  ↓
[Collect co-payment (if applicable)]
  ↓
[Review and confirm current contact/address info]
  ↓
[Collect any outstanding consent forms / updates]
  ↓
[Mark appointment as "checked-in"]
  ↓
[Notification sent to provider + clinical staff]
  ↓
[Estimated wait time displayed to patient]
  ↓
END

```

### Offline Behavior
- Kiosk/reception app syncs patient list periodically; works fully offline
- Check-in marked locally, synced when online
- If patient record not found locally, offer manual entry + flag for later sync

### Key Screens
- Patient search (quick lookup by phone, smart search)
- Check-in confirmation with demographics review
- Payment UI (cash, card, terminal)
- Queue status display

### Competing-team Critique & Alternatives
- Weakness: Manual patient search is slow and error-prone, especially with common names.
- Alternative: QR code on appointment reminder SMS / patient card; one-tap check-in.
- Weakness: Asking for payment at check-in delays queue; patients frustrated.
- Alternative: Pre-authorize payment during appointment booking; check-in only verifies. Offer payment link sent via SMS before arrival.
- Weakness: No visibility into queue; patient doesn't know how long wait will be.
- Alternative: Real-time queue dashboard showing appointment status and estimated wait; notify patient via SMS/push when called.

---

## 4) Consultation

### Primary Flow

```
START
  ↓
[Provider opens patient chart from queue/check-in list]
  ↓
[Review: chief complaint, history, allergies, current meds]
  ↓
[Provider performs physical exam / assessment]
  ↓
[Document encounter: vitals, findings, assessment using templates or free-text]
  ↓
[Decision: order labs/imaging, prescribe, refer, or follow-up]
  ↓
[Update problem list and active issues]
  ↓
[Sign and close encounter note]
  ↓
[System auto-generates summary for patient in Arabic]
  ↓
[Appointment marked as "completed"]
  ↓
END

```

### Offline Behavior
- Provider charts offline; sync when online
- If sync conflict detected (chart modified elsewhere), show diff and let provider merge/revert
- Large images (if attached) synced in background

### Key Screens
- Patient summary (demographics, past visits, problem list, medications)
- Encounter template (vital signs, chief complaint, assessment)
- Order/prescription entry
- Chart note editor with voice-to-text
- Patient summary printable/sendable

### Competing-team Critique & Alternatives
- Weakness: Heavy templates slow down providers; free-text entry is time-consuming on slow devices.
- Alternative: Voice-to-text with smart snippets + structured shortcuts (e.g., "BP high" → vitals capture dialog).
- Weakness: Encounter notes in English only; patients receive unclear summaries.
- Alternative: Auto-translate encounter summary to Arabic; allow provider to review/edit before patient views.
- Weakness: Merge conflicts in offline mode are scary; providers may lose data.
- Alternative: Implement detailed conflict resolution UI showing what changed; allow selective merge. Provide "revert to last synced" option.
- Weakness: No clinical decision support; providers miss guideline opportunities.
- Alternative: Background AI analysis of diagnoses against guidelines; show alerts for contraindications, drug interactions, or missing workup.

---

## 5) Treatment

### Primary Flow (Dental/Beauty Procedures)

```
START
  ↓
[Provider/Specialist reviews treatment plan from chart]
  ↓
[Confirm patient consent for procedure]
  ↓
[Prepare treatment room: inventory, equipment]
  ↓
[Log start time and staff involved]
  ↓
[Record procedure details: steps, materials used, outcomes]
  ↓
[Capture before/after images (encrypted, stored locally if offline)]
  ↓
[Document any complications or deviations from plan]
  ↓
[Log treatment completion time]
  ↓
[Deduct materials from inventory]
  ↓
[Update treatment plan: mark step complete, schedule next session if needed]
  ↓
[Patient receives post-care instructions (Arabic, video if available)]
  ↓
[Schedule follow-up/review appointment]
  ↓
END

```

### Offline Behavior
- Treatment notes and images saved locally
- Inventory updates queued for sync
- Images synced in background once online (resumable)

### Key Screens
- Treatment procedure template with before/after image capture
- Material/consumable logging
- Complication notes
- Follow-up scheduling modal
- Post-care instructions player (video + text)

### Competing-team Critique & Alternatives
- Weakness: Image handling on low bandwidth is painful; uploads hang or fail.
- Alternative: Capture at lower resolution locally; queue for full-res upload background; allow manual trigger.
- Weakness: Material usage not tracked in real-time; inventory audit is manual and error-prone.
- Alternative: Integrate barcode/QR scans for materials at start and end of procedure; auto-deduct from inventory.
- Weakness: Patients don't follow post-care instructions; leads to complications.
- Alternative: Send reminders at key milestones (e.g., 24h, 48h post-procedure); track compliance.
- Weakness: Before/after photos stored with PHI; privacy risk if device is lost.
- Alternative: Store images in encrypted vault with patient consent audit; allow patient to download/delete.

---

## 6) Prescription

### Primary Flow

```
START
  ↓
[Provider selects "New Prescription" from encounter or quick-entry]
  ↓
[Search medication by name (Arabic/English) or auto-complete from clinic formulary]
  ↓
[Select strength, form (tablet, liquid, injection), and quantity]
  ↓
[Set dosage, frequency, duration, special instructions]
  ↓
[Check for contraindications vs. patient allergies/active meds]
  ↓
[Provider reviews; signs prescription]
  ↓
[Prescription printed and handed to patient OR sent to patient portal]
  ↓
[Patient can send prescription to local pharmacy or upload to pharmacy system]
  ↓
[Reminder sent to patient: pick-up date, refill options]
  ↓
END

```

### Offline Behavior
- Prescription drafted offline; synced when online
- Formulary cached locally

### Key Screens
- Medication search with local formulary
- Dosage/frequency picker
- Drug interaction checker result
- Prescription printable view
- Patient prescription portal view

### Competing-team Critique & Alternatives
- Weakness: Drug interaction checking only works online; dangerous if offline prescription given without check.
- Alternative: Pre-download known interactions; show warnings for offline prescriptions pending online verification.
- Weakness: Patient receives prescription but doesn't know how to take it; language barriers.
- Alternative: Generate visual instruction cards (icons + Arabic text) showing dosage, frequency, and side effects.
- Weakness: No tracking if patient actually fills prescription; lost follow-up.
- Alternative: Send refill reminder via SMS; allow patient to confirm/skip. Log refill intent in chart.
- Weakness: Interactions checked only at prescription time; new prescriptions from other clinics not caught.
- Alternative: Periodic background sync of patient's full medication list from regional pharmacy system (if available).

---

## 7) Payment

### Primary Flow

```
START
  ↓
[Appointment completed or service rendered]
  ↓
[System generates invoice (itemized by service/procedure/consumables)]
  ↓
[Receptionist reviews with patient and presents total due]
  ↓
[Payment method offered: cash, card (local terminal), bank transfer, installment plan]
  ↓
[Payment processed (online or offline local cache)]
  ↓
[Receipt generated (Arabic/English) and printed/SMS'd to patient]
  ↓
[Invoice marked as "paid"]
  ↓
[Revenue entry synced to accounting system]
  ↓
[Patient receives thank-you + loyalty points credit (if enrolled)]
  ↓
END

```

### Offline Behavior
- Payment method selected; amount cached locally
- If terminal offline: record cash or promise of card payment; mark for later settlement
- Auto-reconcile when online

### Key Screens
- Invoice detail (service breakdown, taxes if applicable)
- Payment method selector
- Card/terminal UI or cash confirmation
- Receipt view/print

### Competing-team Critique & Alternatives
- Weakness: Large invoices shock patients; no payment plan info upfront.
- Alternative: Show itemized cost estimate during booking; offer payment plans clearly.
- Weakness: Payment failures (network, terminal) create confusion; unclear if paid.
- Alternative: Dual confirmation: patient sees "payment pending" status; admin confirms when synced. SMS acknowledgment to patient.
- Weakness: No integration with local Syrian payment gateways.
- Alternative: Partner with local processors; support multiple currencies and offline settlement.
- Weakness: Receipts not trackable for tax audit; manual reconciliation error-prone.
- Alternative: All receipts cryptographically signed and immutable; monthly export for accountant review.

---

## 8) Inventory Consumption

### Primary Flow

```
START
  ↓
[During treatment/procedure, staff logs material usage]
  ↓
[Scan material barcode or manually select from dropdown]
  ↓
[Confirm quantity used (units, vials, syringes, etc.)]
  ↓
[Optional: log waste/spoilage separately]
  ↓
[Inventory count decremented]
  ↓
[If stock falls below threshold → auto-alert to inventory manager]
  ↓
[At period end, inventory manager reconciles counts vs. usage logs]
  ↓
[Variance flagged if discrepancy > tolerance]
  ↓
[Purchase order auto-triggered if low stock]
  ↓
END

```

### Offline Behavior
- Material logging cached locally; synced on reconnect
- Stock level shown as "last known" with sync pending badge

### Key Screens
- Material quick-entry (barcode scan or search)
- Quantity entry
- Inventory dashboard (current stock levels, near-expiry items, low-stock alerts)
- Waste/spoilage log
- Purchase order creation

### Competing-team Critique & Alternatives
- Weakness: Manual logging is slow; staff skip entries during busy procedures.
- Alternative: Auto-track via IoT sensors on storage (fridge, cabinet) and equipment (used items); supplement with manual entry.
- Weakness: Inventory dashboard shows old data if sync is pending; overstocking or stockouts.
- Alternative: Real-time sync priority for inventory updates; push alerts to manager immediately.
- Weakness: Multi-branch inventory management is complex; no visibility into inter-branch stock.
- Alternative: Centralized view with auto-transfer suggestions; allow requisition between branches.
- Weakness: Expired items not tracked; waste and compliance risk.
- Alternative: Barcode includes expiry; flag items approaching expiry in dashboard; require disposal confirmation.

---

## 9) Subscription Renewal

### Primary Flow

```
START
  ↓
[Clinic subscription approaching renewal date (30 days prior notification)]
  ↓
[Owner/Admin receives email + in-app notification]
  ↓
[Admin opens subscription management page]
  ↓
[Review current tier, usage metrics, and renewal pricing]
  ↓
[Option: upgrade tier, add modules, or continue current plan]
  ↓
[Update payment method (if expired)]
  ↓
[Admin confirms renewal]
  ↓
[Payment processed automatically]
  ↓
[Confirmation email sent; subscription extended]
  ↓
[Platform features remain active; no downtime]
  ↓
[Usage report generated for owner]
  ↓
END

```

### Offline Behavior
- N/A (billing is server-side only)

### Key Screens
- Subscription dashboard (current tier, renewal date, usage metrics)
- Renewal dialog with pricing and tier comparison
- Payment method management
- Renewal history and invoices

### Competing-team Critique & Alternatives
- Weakness: Auto-renewal can surprise customers with unexpected charges; negative sentiment.
- Alternative: Manual confirmation required 7 days before renewal; allow easy downgrade/cancel.
- Weakness: No insight into why a clinic should upgrade; sales opportunity missed.
- Alternative: Usage dashboard shows recommendations (e.g., "You're at 80% of current tier limits; upgrade to Professional recommended").
- Weakness: Renewal failure (bad card) causes service interruption; poor UX.
- Alternative: Retry payment multiple times; notify admin early; offer grace period with reduced functionality.
- Weakness: No upsell logic; missed revenue.
- Alternative: Show addon bundles (e.g., "Analytics +10%", "Priority support +25%") with discount for renewal.

---

## 10) Patient Self-Booking

### Primary Flow

```
START
  ↓
[Patient receives SMS/WhatsApp with link to clinic portal or direct booking URL]
  ↓
[Patient opens link on mobile; auto-logs in (one-time token from SMS)]
  ↓
[Patient views available appointment slots (filtered by clinic preference)]
  ↓
[Patient selects slot and confirms]
  ↓
[Confirmation SMS sent immediately]
  ↓
[Calendar entry created; provider notified]
  ↓
[Patient receives 24h and 1h reminders]
  ↓
[Patient can reschedule or cancel (if policy allows) from SMS link]
  ↓
END

```

### Offline Behavior
- Patient portal cached locally; allows browsing but booking queued

### Key Screens
- Quick-book landing page (minimal friction)
- Calendar picker with available slots
- Confirmation page
- SMS chat-based rescheduling (optional)

### Competing-team Critique & Alternatives
- Weakness: One-time token expires; patient loses access if they don't use immediately.
- Alternative: Token valid for 24h; resend link if patient navigates away.
- Weakness: Patient doesn't know which provider is best for their issue.
- Alternative: Ask brief triage questions; recommend provider + appointment type.
- Weakness: No show-up rate tracking; many self-booked appointments are no-shows.
- Alternative: Send reminder with "confirm attendance" button; no-show penalty or deposit.
- Weakness: Limited appointment slots visible; patient frustration.
- Alternative: Show next 14 days; offer "notify me when slot opens" if full.

---

## 11) Loyalty Redemption

### Primary Flow

```
START
  ↓
[Patient enrolled in loyalty program; points accrued per visit/service]
  ↓
[Patient receives SMS/email: "You have 500 points available"]
  ↓
[Patient opens app or portal; views loyalty rewards catalog]
  ↓
[Patient selects reward (e.g., $10 discount, free service, product)]
  ↓
[Patient confirms redemption]
  ↓
[Points deducted; reward generated and sent to patient (code or voucher)]
  ↓
[Patient uses code at checkout; discount applied]
  ↓
[Loyalty transaction logged]
  ↓
END

```

### Offline Behavior
- Loyalty balance cached; redemption queued locally and synced

### Key Screens
- Loyalty dashboard (points balance, tier status, expiry info)
- Rewards catalog with point costs
- Redemption confirmation

### Competing-team Critique & Alternatives
- Weakness: Point expiry not communicated; patients lose points unexpectedly.
- Alternative: Show countdown to expiry on every interaction; send warning 30 days before expiry.
- Weakness: Limited rewards catalog; patients uninterested.
- Alternative: Partner with local businesses for broader reward options (pharmacy, restaurants); allow points transfer.
- Weakness: Tiered loyalty tiers confusing; unclear how to reach next tier.
- Alternative: Gamify with clear progress bars, milestones, and badges.
- Weakness: No referral bonus; missed acquisition lever.
- Alternative: Allow patients to earn bonus points for referring friends who book.

---

## 12) Branch Transfer

### Primary Flow (Patient/Records Transfer)

```
START
  ↓
[Patient requests transfer to different clinic branch]
  ↓
[Admin/Clinician initiates transfer workflow]
  ↓
[Select destination branch and transfer date]
  ↓
[Review records to transfer (EHR, images, consent forms)]
  ↓
[Confirm with patient (verbal or digital consent)]
  ↓
[Records copied/moved to destination tenant/branch]
  ↓
[Notification sent to destination clinic]
  ↓
[Patient receives confirmation with new clinic contact info]
  ↓
[Follow-up appointment auto-scheduled at destination if applicable]
  ↓
END

```

### Offline Behavior
- Transfer initiated offline; synced when online
- Records queued for sync; large files (images) synced in background

### Key Screens
- Transfer request form (destination branch, reason)
- Records review checklist
- Confirmation page

### Competing-team Critique & Alternatives
- Weakness: Large images slow down transfer; can fail mid-sync.
- Alternative: Stream records in chunks; allow resumable transfer. Patient can access records at both branches meanwhile.
- Weakness: No audit trail of who transferred what; compliance risk.
- Alternative: All transfers logged immutably; require approval from destination admin.
- Weakness: Multi-branch tenancy complicates access control; transferred records may not sync correctly.
- Alternative: Design for inter-branch record federation from the start; records stay in original branch, other branches have read-only access.

---

## 13) Commission Calculation

### Primary Flow

```
START
  ↓
[Billing system generates daily/weekly transactions for each provider]
  ↓
[Commission engine runs periodically (end of month)]
  ↓
[Group transactions by provider and service category]
  ↓
[Apply commission rules (flat %, tiered based on volume, bonus thresholds)]
  ↓
[Deduct any chargebacks, write-offs, or adjustments]
  ↓
[Calculate net commission owed]
  ↓
[Generate commission statement (itemized) for provider review]
  ↓
[Provider approves or disputes line items]
  ↓
[If disputes, escalate to admin for manual review]
  ↓
[Approved commissions transferred to payroll system]
  ↓
[Provider receives payment (bank transfer or check)]
  ↓
[Commission statement archived for audit]
  ↓
END

```

### Offline Behavior
- N/A (batch process, server-side only)

### Key Screens
- Commission dashboard (current month YTD, prior periods)
- Commission statement (itemized by service, rate, amount)
- Dispute/adjustment form
- Payment history

### Competing-team Critique & Alternatives
- Weakness: Manual commission rules in spreadsheets; error-prone and not scalable.
- Alternative: Define commission rules in system UI; version-control changes; auto-apply.
- Weakness: Disputes require back-and-forth emails; slow resolution.
- Alternative: In-app dispute form with evidence upload; auto-audit against rules.
- Weakness: Delayed payment (end-of-month batching) demotivates providers.
- Alternative: Real-time commission dashboard showing estimated payout; weekly small payments + monthly final settlement.
- Weakness: No transparency for providers; trust issues.
- Alternative: Detailed transaction-level breakdown; providers can drill into any line item to see service details.

---

## 14) Approval Workflows

### Generic Approval Flow Pattern

```
START
  ↓
[Action triggered: high-value order, treatment plan, discount, expense]
  ↓
[System evaluates approval rules (amount threshold, user role, department)]
  ↓
[If auto-approved: proceed to END]
  ↓
[If manual approval needed: create approval task]
  ↓
[Task routed to designated approver(s) based on rules]
  ↓
[Approver receives notification (SMS/Email/In-app) with details]
  ↓
[Approver reviews and selects: approve, deny, or request changes]
  ↓
[If denied: action blocked, requester notified with reason]
  ↓
[If requested changes: requester notified; must resubmit]
  ↓
[If approved: action proceeds; audit trail recorded]
  ↓
[Notifier sent to all stakeholders (requester, initiator, downstream users)]
  ↓
END

```

### Examples
- High-value procedure approval (> $1000): Manager approval required
- Prescription for controlled substance: Doctor approval required before dispensing
- Discount > 20%: Manager approval required
- Off-label medication use: Clinical advisor approval required
- Large inventory purchase: Finance approval required

### Offline Behavior
- Approval requests queued; notified when approver comes online
- Approvals cached locally if offline; confirmed when synced

### Key Screens
- Approval task inbox (priority, deadline)
- Approval detail with full context (amount, reason, evidence)
- Approve/Deny/Request Changes buttons
- Approval history and audit trail

### Competing-team Critique & Alternatives
- Weakness: Approvers overwhelmed; tasks pile up; delays slow operations.
- Alternative: Auto-approve common, low-risk actions (e.g., <$50 discount). Use risk scoring to prioritize.
- Weakness: No escalation if approver doesn't respond; blocking action.
- Alternative: Set SLA per approval type (e.g., 2h for urgent); auto-escalate to manager if SLA breached.
- Weakness: No visibility into why approval was denied; requester frustrated.
- Alternative: Require approver to select from pre-defined decline reasons or provide comment.
- Weakness: Serial approvals (multi-level) are too slow.
- Alternative: Parallel approvals for independent reviewers; use AND/OR logic to combine results.

---

## Cross-Journey Observations & Competing-Team Synthesis

### Major Weaknesses Found
1. **Offline-first complexity**: Many journeys assume online but claim offline support. Sync conflicts and stale data are risk areas.
2. **Language/localization gaps**: Arabic support is promised but not deeply integrated; many workflows default to English.
3. **Performance on slow networks**: Large payloads (images, PDFs) and sync operations are not optimized for 2G/3G.
4. **Approval bottlenecks**: Serial approvals and human intervention slow down journeys; insufficient automation.
5. **No real-time notifications**: Async tasks (sync, batch processes) don't notify users; users don't know status.
6. **Audit trails underspecified**: Many workflows don't clearly log who did what, when, and why.

### Alternative Architectures Proposed
- **Event-driven architecture**: All state changes emit events; downstream systems react asynchronously. Enables offline operations and resilience.
- **Progressive enhancement**: Build minimal offline core (patient registration, check-in, basic charting). Gradually add features that require connectivity.
- **Federated permissions**: Use attribute-based access control (ABAC) instead of role-based; context matters (time, location, device, approval status).
- **Async notifications**: Use background queues for all notifications; never block user actions on delivery.
- **Conflict-free replicated data types (CRDTs)**: For offline-first workflows, consider CRDTs to eliminate merge conflicts.

### Recommended Prioritization (MVP to Scaling)
1. **Phase 1 (MVP)**: Patient Registration, Appointment Booking, Check-In, Consultation, Payment (online-only)
2. **Phase 2**: Add offline support to core journeys; Prescription, Simple Approval Workflows
3. **Phase 3**: Inventory Consumption, Treatment with imaging, Loyalty, Branch Transfer
4. **Phase 4**: Commission Calculation, Advanced Approval Workflows, Subscription Renewal, Self-Booking

### Test Scenarios for Each Journey
- Happy path: user completes action successfully, all systems sync
- Offline path: user completes action offline, verifies sync succeeds
- Error path: user encounters validation error, network error, or conflict
- Concurrent path: multiple users perform same action simultaneously; verify no race conditions
- Timeout path: action takes longer than timeout; verify graceful degradation

---

## Integration Points (External Systems)

Each journey may integrate with:
- **Lab system**: Result reconciliation (Consultation → Orders → Results)
- **Imaging center**: DICOM studies, scheduling (Treatment, Consultation)
- **Pharmacy**: Prescription fill status, refill requests (Prescription)
- **Payment gateway**: Card processing, settlement (Payment)
- **SMS/WhatsApp gateway**: Notifications and reminders
- **Inventory vendor**: Stock levels, auto-reorder (Inventory Consumption)
- **Payroll system**: Commission payout (Commission Calculation)

---

## Next Steps

1. Create detailed state machines for each journey (separate technical spec).
2. Design error recovery paths and user guidance for each failure scenario.
3. Build UI wireframes per persona for each journey's key screens.
4. Implement journey telemetry: track time in each step, drop-off rates, error frequency.
5. Conduct in-country user testing (Syria) with representative users to validate flow and identify cultural gaps.
