-- SQL script to create the emails table in Supabase
-- Run this in the Supabase SQL editor

CREATE TABLE public.emails (
  id BIGSERIAL PRIMARY KEY,
  email_body TEXT NOT NULL,
  company VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  purpose VARCHAR(100) NOT NULL,
  tone VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_emails_status ON public.emails(status);
CREATE INDEX idx_emails_created_at ON public.emails(created_at);
CREATE INDEX idx_emails_company ON public.emails(company);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (adjust based on your needs)
CREATE POLICY "Allow all operations on emails" ON public.emails
  FOR ALL USING (true);

-- Add a trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_emails_updated_at
    BEFORE UPDATE ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();