// src/services/metricsService.js
import { supabase } from './supabase.js';

export async function getRpcP95(name, since = '7 days') {
  if (!name) return { name, p95_ms: null, n: 0 };
  const { data, error } = await supabase.rpc('get_rpc_p95', { p_name: name, p_since: since });
  if (error) return { name, p95_ms: null, n: 0 };
  const row = (data || [])[0];
  return row || { name, p95_ms: null, n: 0 };
}

export default { getRpcP95 };

