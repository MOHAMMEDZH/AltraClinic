export const DEMO_TENANT_ID = 'a1000000-0000-4000-8000-000000000001';

export const DEMO_OWNER = {
  email: 'owner@demo.clinic',
  password: 'Owner123!',
} as const;

export const DEMO_INVENTORY_MANAGER = {
  email: 'inventory@demo.clinic',
  password: 'Inventory123!',
} as const;

export const DEMO_DOCTOR = {
  email: 'doctor@demo.clinic',
  password: 'Doctor123!',
} as const;

export const DEMO_RECEPTIONIST = {
  email: 'reception@demo.clinic',
  password: 'Reception123!',
} as const;

export const DEMO_ACCOUNTANT = {
  email: 'accountant@demo.clinic',
  password: 'Accountant123!',
} as const;

export const DEMO_GENERAL_MANAGER = {
  email: 'gm@demo.clinic',
  password: 'Manager123!',
} as const;

export const DEMO_NURSE = {
  email: 'nurse@demo.clinic',
  password: 'Nurse123!',
} as const;

export const DEMO_DENTIST = {
  email: 'dentist@demo.clinic',
  password: 'Dentist123!',
} as const;

export const DEMO_BRANCH_MANAGER = {
  email: 'branch@demo.clinic',
  password: 'Branch123!',
} as const;

export const DEMO_SPECIALIST = {
  email: 'specialist@demo.clinic',
  password: 'Specialist123!',
} as const;

export const DEMO_PATIENT_USER = {
  email: 'patient@demo.clinic',
  password: 'Patient123!',
} as const;

/** Seeded in apps/api/prisma/seed.mjs for barcode / receive-by-scan flows. */
export const DEMO_INVENTORY_BARCODE = '8901234567890';
export const DEMO_INVENTORY_SKU = 'GLV-M-100';
export const DEMO_INVENTORY_MASK_SKU = 'MASK-3PLY';

/** Seeded purchase orders and stock requests for procurement E2E. */
export const DEMO_PO_PENDING_NUMBER = 'PO-DEMO-001';
export const DEMO_PO_APPROVED_NUMBER = 'PO-DEMO-002';
export const DEMO_STOCK_REQUEST_NUMBER = 'SR-DEMO-001';
export const DEMO_STOCK_REQUEST_APPROVED_NUMBER = 'SR-DEMO-002';
export const DEMO_TRANSFER_NUMBER = 'TR-DEMO-001';
export const DEMO_STOCK_COUNT_NUMBER = 'CNT-DEMO-001';
export const DEMO_WAREHOUSE_MAIN_CODE = 'MAIN';
export const DEMO_WAREHOUSE_PROC_CODE = 'PROC';
export const DEMO_BATCH_LOT = 'LOT-MASK-2026';
