import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const supabaseUrl = __VITE_SUPABASE_URL__;
// @ts-ignore
const supabaseAnonKey = __VITE_SUPABASE_ANON_KEY__;

console.log('Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables:
    URL: ${supabaseUrl ? 'Set' : 'Missing'}
    ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Missing'}
  `);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
