import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://sxqimjzghdvysajvsthr.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_-dk0QesRLV2LUJlNRJpJ8A_dNy3DS7i';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
