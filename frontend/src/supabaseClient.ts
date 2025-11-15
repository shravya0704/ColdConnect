import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dskhkwhqiadaxbobhkid.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza2hrd2hxaWFkYXhib2Joa2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MjYyOTMsImV4cCI6MjA3ODUwMjI5M30.muRD822dIlxEoZld4P5NhAg1aWCEjO-GkmooFqXd-t4';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export default supabase;