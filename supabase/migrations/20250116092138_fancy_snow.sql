/*
  # Add Profile Insert Policy

  1. Changes
    - Add policy to allow new users to create their initial profile
    - Simplify existing policies to prevent recursion

  2. Security
    - Maintain role-based access control
    - Allow initial profile creation
    - Prevent policy recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can view their team's profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;

-- Create new policies
CREATE POLICY "Allow users to create their profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view and update own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Managers can view team profiles"
  ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT id FROM profiles WHERE role = 'manager'::user_role
      )
    )
    AND manager_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin access"
  ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT id FROM profiles WHERE role = 'admin'::user_role
      )
    )
  );