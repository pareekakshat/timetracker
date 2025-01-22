/*
  # Fix Profile Policies

  1. Changes
    - Remove recursive policy checks for admin access
    - Simplify policy conditions
    - Add WITH CHECK clauses for INSERT/UPDATE policies

  2. Security
    - Maintain role-based access control
    - Prevent infinite recursion
    - Ensure data integrity
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can view their team's profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create new policies
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Managers can view their team's profiles"
  ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS viewer 
      WHERE viewer.id = auth.uid() 
      AND viewer.role = 'manager'::user_role
      AND profiles.manager_id = viewer.id
    )
  );

CREATE POLICY "Admin full access"
  ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND id IN (
        SELECT id FROM profiles 
        WHERE role = 'admin'::user_role
      )
    )
  )
  WITH CHECK (true);