-- ============================================================================
-- Storage bucket for incident media (photos / videos)
--
-- Bucket name: signal-media
-- Purpose: Users upload photo/video attachments when creating or updating
--          signals. Files are linked to signals via a new media_files table.
--
-- Policies:
--   INSERT: Authenticated users can upload to their own folder
--   SELECT: Anyone can view media linked to any signal (public safety data)
--   UPDATE: Only the uploader can update their own files
--   DELETE: Only the uploader can delete their own files
-- ============================================================================

-- ============================================================================
-- 1. Create the storage bucket
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signal-media',
  'signal-media',
  true,                                 -- public bucket (media needs to be viewable by everyone)
  10485760,                             -- 10 MB max per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Create a media_files table to link uploads to signals
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.media_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id   uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,           -- path inside the bucket, e.g. "user_id/filename.jpg"
  mime_type   text NOT NULL,
  file_size   integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by signal
CREATE INDEX IF NOT EXISTS idx_media_files_signal_id ON public.media_files (signal_id);
-- Index for user's own files
CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON public.media_files (user_id);

-- Enable Row Level Security
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

-- Everyone can view media files (part of incident data)
CREATE POLICY "media_files_select_public"
  ON public.media_files
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own files
CREATE POLICY "media_files_insert_own"
  ON public.media_files
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "media_files_delete_own"
  ON public.media_files
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant access
GRANT SELECT ON public.media_files TO anon, authenticated;
GRANT INSERT, DELETE ON public.media_files TO authenticated;

-- ============================================================================
-- 3. Row Level Security for storage.objects
-- ============================================================================

-- Allow authenticated users to upload files to signal-media
CREATE POLICY "signal_media_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'signal-media'
    AND (storage.foldername(name))[1] = auth.uid()::text  -- own folder only
  );

-- Allow the owner to update their own files
CREATE POLICY "signal_media_update_owner"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'signal-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'signal-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow the owner to delete their own files
CREATE POLICY "signal_media_delete_owner"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'signal-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow everyone (including anonymous) to view/download files
CREATE POLICY "signal_media_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'signal-media');

-- ============================================================================
-- 4. Helper function: increment media count on signals
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_signal_media_count()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.signals
  SET media = (
    SELECT COUNT(*) FROM public.media_files WHERE signal_id = NEW.signal_id
  )
  WHERE id = NEW.signal_id;
  RETURN NEW;
END;
$$;

-- Trigger: update signal media count when a file is inserted
CREATE TRIGGER trg_media_files_after_insert
  AFTER INSERT ON public.media_files
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_signal_media_count();

-- Trigger: update signal media count when a file is deleted
CREATE TRIGGER trg_media_files_after_delete
  AFTER DELETE ON public.media_files
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_signal_media_count();