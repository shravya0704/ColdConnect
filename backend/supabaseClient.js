import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY is missing in environment variables');
  console.warn('[Supabase] Analytics features will be disabled');
}

let supabase = null;

// Only create client if both URL and key are available
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch },
    auth: { persistSession: false },
  });
} else {
  // Create a mock client for graceful degradation
  supabase = {
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      select: () => Promise.resolve({ data: [], error: { message: 'Supabase not configured' } })
    })
  };
}

export default supabase;
