-- Create enum for admin roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE admin_role AS ENUM ('superadmin', 'admin', 'data_entry');
  END IF;
END $$;

-- Add role column to admins with default 'admin'
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS role admin_role NOT NULL DEFAULT 'admin';

-- Backfill existing admins to 'admin' where NULL (safety if constraint deferred)
UPDATE admins SET role = 'admin' WHERE role IS NULL;

-- Note: Superadmin detection still uses SUPERADMIN_EMAIL at runtime; you may
-- later update the specific row's role to 'superadmin' via application code.

-- Add created_by_admin_id to posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS created_by_admin_id integer NULL REFERENCES admins(id);

-- Extend status enum with 'edited' if not exists
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'status' AND e.enumlabel = 'edited'
  ) THEN
    ALTER TYPE status ADD VALUE 'edited';
  END IF;
END$$;


