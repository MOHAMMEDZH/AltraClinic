-- Migration: create loyalty domain tables
-- Note: adapt to your migration tool (Prisma/TypeORM/etc.)

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  account_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  points_balance NUMERIC NOT NULL DEFAULT 0,
  current_tier VARCHAR(50) NOT NULL DEFAULT 'Bronze',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  enrollment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_accounts_tenant_patient ON loyalty_accounts(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tenant_active ON loyalty_accounts(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  transaction_id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES loyalty_accounts(account_id),
  tenant_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust')),
  points_amount NUMERIC NOT NULL,
  reference_id VARCHAR(255),
  description TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(account_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(type, transaction_date);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  reward_id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES loyalty_accounts(account_id),
  tenant_id UUID NOT NULL,
  points_required NUMERIC NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  expiry_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'expired', 'redeemed')),
  redeemed_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_account ON loyalty_rewards(account_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_status ON loyalty_rewards(status, expiry_date);
