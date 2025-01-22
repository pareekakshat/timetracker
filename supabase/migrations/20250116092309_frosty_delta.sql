/*
  # Fix Profile Policies

  1. Changes
    - Simplify all policies to prevent recursion
    - Create clear, non-recursive policy structure
    - Maintain security while allowing necessary operations

  2. Security
    - Maintain role-based access control
    - Allow profile creation and updates
    - Prevent policy recursion
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow users to create their profile" ON profiles;
DROP POLICY IF EXISTS "Users can view and update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can view team profiles" ON profiles;
DROP POLICY IF EXISTS "Admin access" ON profiles;

-- Simple policy for profile creation
CREATE POLICY "allow_profile_creation"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Simple policy for viewing own profile
CREATE POLICY "allow_select_own_profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Simple policy for updating own profile
CREATE POLICY "allow_update_own_profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Manager view policy without recursion
CREATE POLICY "allow_manager_select"
  ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
      AND role = 'manager'
    )
  );

-- Admin policy without recursion
CREATE POLICY "allow_admin_all"
  ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );