import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    runtimeConfig?: {
      supabaseUrl: string;
      supabaseKey: string;
    };
  }
}

const runtimeConfig = window.runtimeConfig;
const supabaseUrl = runtimeConfig?.supabaseUrl || 'http://127.0.0.1:54321';
const supabaseKey = runtimeConfig?.supabaseKey || 'test-placeholder';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);