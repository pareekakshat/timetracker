/*
  # Time Tracker Initial Schema

  1. New Tables
    - `profiles`
      - Extends auth.users with additional user information
      - Stores role and manager information
    - `time_entries`
      - Stores time tracking data
      - Links to user profiles
    - `screenshots`
      - Stores screenshot metadata
      - Links to time entries
    
  2. Security
    - Enable RLS on all tables
    - Policies for different role-based access
    - Secure file storage for screenshots

  3. Enums
    - `user_role`: Define user role types
*/

-- Create role enum
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  manager_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create time entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create screenshots table
CREATE TABLE IF NOT EXISTS screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE CASCADE NOT NULL,
  storage_path text NOT NULL,
  taken_at timestamptz DEFAULT now(),
  type text NOT NULL, -- 'screen' or 'webcam'
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Managers can view their team's profiles"
  ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS viewer 
      WHERE viewer.id = auth.uid() 
      AND (
        viewer.role = 'manager' 
        AND profiles.manager_id = viewer.id
      )
    )
  );

CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Time entries policies
CREATE POLICY "Users can CRUD their own time entries"
  ON time_entries
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view their team's time entries"
  ON time_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS viewer 
      WHERE viewer.id = auth.uid() 
      AND viewer.role = 'manager'
      AND time_entries.user_id IN (
        SELECT id FROM profiles 
        WHERE manager_id = viewer.id
      )
    )
  );

CREATE POLICY "Admins can view all time entries"
  ON time_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Screenshots policies
CREATE POLICY "Users can view their own screenshots"
  ON screenshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM time_entries
      WHERE time_entries.id = screenshots.time_entry_id
      AND time_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view their team's screenshots"
  ON screenshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM time_entries
      JOIN profiles ON time_entries.user_id = profiles.id
      JOIN profiles manager ON profiles.manager_id = manager.id
      WHERE time_entries.id = screenshots.time_entry_id
      AND manager.id = auth.uid()
      AND manager.role = 'manager'
    )
  );

CREATE POLICY "Admins can view all screenshots"
  ON screenshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create function to handle updating timestamps
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_timestamp_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER set_timestamp_time_entries
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE PROCEDURE handle_updated_at();