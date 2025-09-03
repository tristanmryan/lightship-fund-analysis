// Server-side Supabase client for API routes and scripts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON;

if (!url || !(serviceKey || anonKey)) {
  // eslint-disable-next-line no-console
  console.error('[supabaseServer] Missing env: SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY | SUPABASE_ANON_KEY');
}

export const supabaseServer = createClient(url, serviceKey || anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export function envInfo() {
  return {
    url: url ? new URL(url).hostname : 'n/a',
    usingServiceKey: Boolean(serviceKey)
  };
}

