// Serverless endpoint to trigger monthly alerts refresh (for Vercel cron)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Refresh-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tokenHeader = req.headers['x-refresh-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const tokenQuery = req.query?.token || req.query?.t;
  const expected = process.env.APP_ALERTS_CRON_TOKEN || '';
  const allowPublic = process.env.APP_ALERTS_CRON_PUBLIC === '1';
  if (!allowPublic) {
    if (!expected || (tokenHeader !== expected && tokenQuery !== expected)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server not configured' });
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('refresh_alerts_for_month', { p_month: null });
    if (error) return res.status(500).json({ error: error.message });
    const ms = Date.now() - t0;
    return res.status(200).json({ ok: true, inserted: data || 0, durationMs: ms });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
