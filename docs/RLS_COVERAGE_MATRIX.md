# RLS Coverage Matrix

Generated: 2026-07-11T20:38:22.932Z

| Prisma model | PostgreSQL table | Ownership | RLS | Force | Select | Insert | Update | Delete | Test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Tenant | tenants | global | no | no | - | - | - | - | integration |  |
| Branch | branches | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Region | regions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserRegionAccess | user_region_access | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Department | departments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserBranchAccess | user_branch_access | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CustomRole | custom_roles | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserCustomRole | user_custom_roles | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserSavedFilter | user_saved_filters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| StaffWeeklySchedule | staff_weekly_schedules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| User | users | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserRoleAssignment | user_role_assignments | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| StaffInvitation | staff_invitations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserDashboardLayout | user_dashboard_layouts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| RefreshToken | refresh_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoginAttempt | login_attempts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PasswordResetToken | password_reset_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| EmailVerificationToken | email_verification_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| MfaBackupCode | mfa_backup_codes | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TrustedDevice | trusted_devices | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Patient | patients | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PatientAddress | patient_addresses | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| Appointment | appointments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentWaitlist | appointment_waitlist | direct | yes | yes | yes | yes | yes | yes | integration |  |
| SchedulingResource | scheduling_resources | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentTemplate | appointment_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BranchOperatingHours | branch_operating_hours | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ProviderWeeklySchedule | provider_weekly_schedules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentReminderLog | appointment_reminder_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Encounter | encounters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PatientProblem | patient_problems | direct | yes | yes | yes | yes | yes | yes | integration |  |
| EncounterEvent | encounter_events | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ClinicalNoteTemplate | clinical_note_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LabResult | lab_results | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalRecord | dental_records | direct | yes | yes | yes | yes | yes | yes | integration |  |
| OrthodonticCase | orthodontic_cases | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ImplantRecord | implant_records | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalClinicalNote | dental_clinical_notes | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalToothCondition | dental_tooth_conditions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalProcedureMaterial | dental_procedure_materials | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BeautyProcedureMaterial | beauty_procedure_materials | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TreatmentPlan | treatment_plans | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TreatmentPhase | treatment_phases | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TreatmentPlanItem | treatment_plan_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PeriodontalExam | periodontal_exams | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BeautyRecord | beauty_records | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BeautyAnnotation | beauty_annotations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryCategory | inventory_categories | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventorySupplier | inventory_suppliers | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryItem | inventory_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryConsumptionLog | inventory_consumption_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockMovement | inventory_stock_movements | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryBatch | inventory_batches | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryDisposalLog | inventory_disposal_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PurchaseOrder | purchase_orders | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PurchaseOrderLine | purchase_order_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryWarehouse | inventory_warehouses | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryWarehouseStock | inventory_warehouse_stock | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockTransfer | inventory_stock_transfers | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockTransferLine | inventory_stock_transfer_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockCount | inventory_stock_counts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockCountLine | inventory_stock_count_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockRequest | inventory_stock_requests | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockRequestLine | inventory_stock_request_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| QueueTicket | queue_tickets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| QueueTicketEvent | queue_ticket_events | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Invoice | invoices | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoiceLineItem | invoice_line_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoicePayment | invoice_payments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TenantBillingSequence | tenant_billing_sequences | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoiceRefund | invoice_refunds | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CreditNote | credit_notes | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoiceWriteOff | invoice_write_offs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CashSession | cash_sessions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PaymentPlan | payment_plans | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PaymentPlanInstallment | payment_plan_installments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ServicePrice | service_prices | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PaymentReceipt | payment_receipts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CommissionRule | commission_rules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CommissionCalculation | commission_calculations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CommissionLineItem | commission_line_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoyaltyAccount | loyalty_accounts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoyaltyTransaction | loyalty_transactions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoyaltyReward | loyalty_rewards | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ClinicSubscription | clinic_subscriptions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformTenant | platform_tenants | direct | no | no | - | - | - | - | integration | Platform control plane — no tenant RLS |
| PrivilegedAccessGrant | privileged_access_grants | global | no | no | - | - | - | - | integration | Platform control plane — no tenant RLS |
| PlatformSubscription | platform_subscriptions | global | no | no | - | - | - | - | integration | Platform control plane — no tenant RLS |
| PortalAccount | portal_accounts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CaregiverAccessGrant | caregiver_access_grants | unscoped | no | no | - | - | - | - | integration | Review manually |
| AnalyticsReportRecord | analytics_reports | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsMetricRecord | analytics_metrics | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsFilterPresetRecord | analytics_filter_presets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsLayoutRecord | analytics_layouts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsDashboardRecord | analytics_dashboards | direct | yes | yes | yes | yes | yes | yes | integration |  |
| OperationalReportRecord | operational_reports | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ReportShareRecord | report_shares | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ReportFilterPresetRecord | report_filter_presets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ReportCustomDefinitionRecord | report_custom_definitions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Notification | notifications | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserDeviceToken | user_device_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationTemplate | notification_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationTemplateVersion | notification_template_versions | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationPreference | notification_preferences | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationAutomationRule | notification_automation_rules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TenantChannelConfig | tenant_channel_configs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationSavedFilter | notification_saved_filters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AuditEntry | audit_entries | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Workflow | workflows | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowTemplate | workflow_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowTask | workflow_tasks | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowApproval | workflow_approvals | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowAutomationRule | workflow_automation_rules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowExecutionLog | workflow_execution_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowSavedFilter | workflow_saved_filters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiModel | ai_models | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiConversation | ai_conversations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiMessage | ai_messages | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiPrompt | ai_prompts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiPromptVersion | ai_prompt_versions | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| AiUsageDaily | ai_usage_daily | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiUserSettings | ai_user_settings | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiTenantSettings | ai_tenant_settings | direct | yes | yes | yes | yes | yes | yes | integration |  |
| MediaAsset | media_assets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| OutboxEvent | outbox_events | outbox | yes | yes | yes | yes | yes | yes | integration |  |

## Deployment order

1. `npm run db:migrate:deploy`
2. `npm run db:triggers:apply`
3. `npm run db:rls:apply`
4. `npm run db:seed` (non-production only)
