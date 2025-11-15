-- Fix for Row Level Security issue
-- Run this in your Supabase SQL editor

-- Option 1: Disable RLS completely (simplest approach)
ALTER TABLE public.emails DISABLE ROW LEVEL SECURITY;

-- OR 

-- Option 2: Update RLS policy to allow anonymous access
-- DROP POLICY IF EXISTS "Allow all operations on emails" ON public.emails;
-- CREATE POLICY "Allow anonymous access to emails" ON public.emails
--   FOR ALL USING (true);

-- Verify the fix by checking if RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'emails' AND schemaname = 'public';