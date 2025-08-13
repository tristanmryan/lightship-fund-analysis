// src/components/Dashboard/NotesPanel.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase, TABLES } from '../../services/supabase';
import DecisionIcon from '../common/DecisionIcon';
import { Link2 } from 'lucide-react';
import notesService from '../../services/researchNotesService';

export default function NotesPanel({ fundId = null, fundTicker = null }) {
  const enableNotes = (process.env.REACT_APP_ENABLE_NOTES || 'false') === 'true';
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [body, setBody] = useState('');
  const [decision, setDecision] = useState('');
  const [overrideId, setOverrideId] = useState('');
  const [overrides, setOverrides] = useState([]);
  const [announce, setAnnounce] = useState('');

  const cleanTicker = useMemo(() => (fundTicker || '').toUpperCase(), [fundTicker]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await notesService.listNotes({ fundId, fundTicker: cleanTicker });
        setNotes(list);
        if (cleanTicker) {
          const { data } = await supabase
            .from(TABLES.FUND_OVERRIDES)
            .select('id, override_type, asset_class_id, benchmark_id, fund_ticker, created_at')
            .eq('fund_ticker', cleanTicker)
            .order('created_at', { ascending: false });
          setOverrides(data || []);
        } else {
          setOverrides([]);
        }
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [fundId, cleanTicker]);

  async function onAdd() {
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      const note = await notesService.addNote({
        fundId,
        fundTicker: cleanTicker || null,
        overrideId: overrideId || null,
        body: trimmed,
        decision: decision || null
      });
      setNotes(prev => [note, ...(Array.isArray(prev) ? prev : [])]);
      setBody('');
      setDecision('');
      setOverrideId('');
      try { setAnnounce('Note added'); setTimeout(()=> setAnnounce(''), 1500); } catch {}
    } catch (e) { alert(e.message); }
  }

  if (!enableNotes) return null;
  if (loading) return <div className="card" style={{ padding: 12 }}>Loading notes…</div>;
  if (error) return <div className="card" style={{ padding: 12, color: '#b91c1c' }}>Notes error: {error}</div>;

  return (
    <div className="card" style={{ padding: 12 }} data-testid="notes-panel">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Research notes</div>
      <div aria-live="polite" style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(1px, 1px, 1px, 1px)' }}>{announce}</div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        <textarea
          placeholder="Add a research note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onAdd(); } }}
          style={{ width: '100%', minHeight: 70, padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select data-testid="decision-select" value={decision} onChange={(e) => setDecision(e.target.value)} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <option value="">Decision (optional)</option>
            <option value="approve">Approve</option>
            <option value="monitor">Monitor</option>
            <option value="reject">Reject</option>
            <option value="hold">Hold</option>
          </select>
          <select data-testid="override-select" value={overrideId} onChange={(e) => setOverrideId(e.target.value)} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <option value="">Link to Override (optional)</option>
            {overrides.map(o => (
              <option key={o.id} value={o.id}>{o.override_type} override — {new Date(o.created_at).toLocaleDateString()}</option>
            ))}
          </select>
          <button onClick={onAdd} className="btn btn-primary" disabled={!body.trim()}>Add Note</button>
        </div>
      </div>
      {(Array.isArray(notes) ? notes.filter(Boolean).length : 0) === 0 ? (
        <div style={{ color: '#6b7280' }}>No notes yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {(Array.isArray(notes) ? notes : []).filter(Boolean).map(n => {
            const bodyText = String(n?.body || '');
            const tooLong = bodyText.length > 400;
            const short = tooLong ? bodyText.slice(0, 400) + '…' : bodyText;
            return (
              <div key={n.id || Math.random()} style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }} data-testid="note-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                  <span>{n?.created_at ? new Date(n.created_at).toLocaleString() : '—'}</span>
                  <span>by {n?.created_by || '—'}</span>
                </div>
                {n?.decision && (
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 2, display:'flex', alignItems:'center', gap:6 }} data-testid="note-decision">
                    <DecisionIcon decision={n.decision} />
                    <span>Decision: <strong>{n.decision}</strong></span>
                  </div>
                )}
                {n?.override_id && (
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 2, display:'flex', alignItems:'center', gap:6 }}>
                    <Link2 size={12} aria-hidden />
                    <span>Linked to override</span>
                  </div>
                )}
                <div style={{ marginTop: 4 }} data-testid="note-body">{short}</div>
                {tooLong && (
                  <a href="#" onClick={(e)=>{ e.preventDefault(); alert(bodyText); }} style={{ fontSize: 12 }}>Show more</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

