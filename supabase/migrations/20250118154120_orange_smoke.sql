/*
  # Fix screenshots and admin functionality

  1. Storage Policies
    - Add storage bucket policies for screenshots
    - Allow users to view their own screenshots
    - Allow managers to view team screenshots
    - Allow admins to view all screenshots

  2. Admin Policies
    - Simplify admin policies for better access
    - Fix infinite recursion issues
*/

-- Create storage bucket if not exists
INSERT INTO storage.buckets (id, name)
VALUES ('screenshots', 'screenshots')
ON CONFLICT (id) DO NOTHING;

-- Storage policies for screenshots bucket
CREATE POLICY "Users can upload their own screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'screenshots' AND
  (auth.uid() = SPLIT_PART(name, '/', 1)::uuid)
);

CREATE POLICY "Users can view their own screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'screenshots' AND
  (
    -- User's own screenshots
    auth.uid() = SPLIT_PART(name, '/', 1)::uuid
    OR
    -- Manager viewing team screenshots
    EXISTS (
      SELECT 1 FROM profiles manager
      WHERE manager.id = auth.uid()
      AND manager.role = 'manager'
      AND SPLIT_PART(name, '/', 1)::uuid IN (
        SELECT id FROM profiles WHERE manager_id = manager.id
      )
    )
    OR
    -- Admin can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Fix admin access to profiles
CREATE POLICY "Admin full access to profiles"
ON profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (true);

-- Fix admin access to time entries
CREATE POLICY "Admin full access to time entries"
ON time_entries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (true);

-- Fix admin access to screenshots table
CREATE POLICY "Admin full access to screenshots table"
ON screenshots
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (true);