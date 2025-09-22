-- Add new status for payment pending
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'status' AND e.enumlabel = 'payment_pending'
  ) THEN
    ALTER TYPE status ADD VALUE 'payment_pending';
  END IF;
END$$;

-- Payment configuration table (superadmin configurable)
CREATE TABLE IF NOT EXISTS payment_configs (
  id SERIAL PRIMARY KEY,
  base_price_first_200 INTEGER NOT NULL DEFAULT 5000,
  additional_price_per_20_chars INTEGER NOT NULL DEFAULT 500,
  large_font_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.20,
  visibility_2_weeks_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  visibility_3_weeks_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.50,
  visibility_4_weeks_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default payment configuration
INSERT INTO payment_configs (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Coupon codes table
CREATE TABLE IF NOT EXISTS coupon_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default 50% discount coupon
INSERT INTO coupon_codes (code, discount_percentage, usage_limit) 
VALUES ('WELCOME50', 50.00, 100) 
ON CONFLICT (code) DO NOTHING;

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id),
  razorpay_payment_link_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_payment_link_reference_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled', 'expired'
  coupon_code VARCHAR(50) REFERENCES coupon_codes(code),
  discount_amount INTEGER DEFAULT 0,
  final_amount INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add payment-related fields to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS payment_transaction_id INTEGER REFERENCES payment_transactions(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS base_amount INTEGER;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS final_amount INTEGER;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_post_id ON payment_transactions(post_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_razorpay_payment_link_id ON payment_transactions(razorpay_payment_link_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_is_active ON coupon_codes(is_active);
