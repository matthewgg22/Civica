-- Phase 2 Lane F: ebt_receipts storage bucket + RLS
--
-- Creates the Supabase Storage bucket used for uploaded receipt images.
-- Images are never public; access is gated by RLS policies below.
--
-- Receipt rows are already defined in 20260572_ebt_phase1.sql as part
-- of the ebt_receipts table in the snap_enrollment schema.
-- This migration adds the Storage layer on top.

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ebt-receipts',
  'ebt-receipts',
  false,                          -- private; access via signed URLs only
  10485760,                       -- 10 MB limit per receipt image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated recipients can INSERT (upload) their own receipts.
-- Path convention: {user_id}/{receipt_id}.jpg
CREATE POLICY "ebt_receipts_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ebt-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: authenticated recipients can SELECT (read) their own receipt objects.
CREATE POLICY "ebt_receipts_storage_select_owner"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ebt-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: navigators can SELECT receipt objects for applicants they are
-- actively linked to (buddy or explicit navigator relationship).
-- We join through the snap_enrollment.buddy_relationships table to avoid
-- exposing arbitrary cross-user access.
CREATE POLICY "ebt_receipts_storage_select_navigator"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ebt-receipts'
    AND EXISTS (
      SELECT 1
      FROM snap_enrollment.buddy_relationships br
      WHERE br.buddy_user_id = auth.uid()
        AND br.applicant_user_id::text = (storage.foldername(name))[1]
        AND br.status = 'active'
    )
  );
