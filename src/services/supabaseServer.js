// src/services/supabaseServer.js
// Node/server-side Supabase client for serverless functions (service role key)
import { createClient } from '@supabase/supabase-js';

function getHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || '';
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  // eslint-disable-next-line no-console
  console.error('[supabaseServer] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseServer = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'X-Lightship-Server': 'true' } }
});

export function envInfo() {
  return {
    host: getHost(supabaseUrl),
    hasServiceKey: !!serviceKey
  };
}

export default supabaseServer;

