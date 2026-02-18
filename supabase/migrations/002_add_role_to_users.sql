-- Add role column to users table
-- This makes users table the single source of truth for permissions

-- Add role column with default 'user'
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Add constraint to ensure only valid roles
ALTER TABLE users ADD CONSTRAINT valid_user_role
  CHECK (role IN ('user', 'moderator', 'admin', 'super_admin'));

-- Create index for faster role-based queries (optional, for future use)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Sync existing roles from mod_plus table to users table
-- This ensures existing moderator/admin users keep their roles
UPDATE users
SET role = mod_plus.role
FROM mod_plus
WHERE users.user_id = mod_plus.user_id
  AND users.client_type = mod_plus.client_type;

-- Function to sync role changes from mod_plus to users (optional)
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- When mod_plus role changes, update users table
  UPDATE users
  SET role = NEW.role
  WHERE user_id = NEW.user_id
    AND client_type = NEW.client_type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-sync roles when mod_plus is updated/inserted
DROP TRIGGER IF EXISTS sync_role_from_mod_plus ON mod_plus;
CREATE TRIGGER sync_role_from_mod_plus
  AFTER INSERT OR UPDATE ON mod_plus
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role();
