-- Add missing updated_at column if it doesn't exist
-- Run this in your Supabase SQL editor if you get column errors

ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'emails' AND table_schema = 'public'
ORDER BY ordinal_position;