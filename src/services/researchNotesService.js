// src/services/researchNotesService.js
import { supabase, TABLES } from './supabase';
import authService from './authService';

const DECISIONS = ['approve','monitor','reject','hold'];

export async function listNotes({ fundId = null, fundTicker = null } = {}) {
  let query = supabase.from(TABLES.FUND_RESEARCH_NOTES)
    .select('*')
    .order('created_at', { ascending: false });

  if (fundId) {
    query = query.eq('fund_id', fundId);
  } else if (fundTicker) {
    query = query.eq('fund_ticker', (fundTicker || '').toUpperCase());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addNote({ fundId = null, fundTicker = null, overrideId = null, body, decision = null }) {
  if (!body || String(body).trim().length === 0) {
    throw new Error('Note body is required');
  }
  const createdBy = authService.getCurrentUser?.()?.id || 'guest';
  const payload = {
    fund_id: fundId || null,
    fund_ticker: fundTicker ? String(fundTicker).toUpperCase() : null,
    override_id: overrideId || null,
    body: String(body),
    decision: decision && DECISIONS.includes(decision) ? decision : null,
    created_by: createdBy
  };
  const { data, error } = await supabase
    .from(TABLES.FUND_RESEARCH_NOTES)
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

const researchNotesService = { listNotes, addNote };
export default researchNotesService;

