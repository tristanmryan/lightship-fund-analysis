// Vercel serverless: receive client timings and store in Supabase
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, durationMs, labels } = req.body || {};
    if (!name || typeof durationMs !== 'number') {
      return res.status(400).json({ error: 'Missing name or durationMs' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('[metrics] Missing Supabase server env');
      return res.status(500).json({ error: 'Server not configured' });
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const payload = { name, duration_ms: durationMs, labels: labels || null };
    const { error } = await supabase.from('rpc_timings').insert([payload]);
    if (error) {
      console.error('[metrics] Insert failed', error);
      return res.status(500).json({ error: 'Insert failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[metrics] Handler failed', e);
    return res.status(500).json({ error: 'Unhandled error' });
  }
}

