// src/components/Dashboard/NotesPanel.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, TABLES } from '../../services/supabase';
import DecisionIcon from '../common/DecisionIcon';
import { Link2, Search, X, Filter, Download } from 'lucide-react';
import notesService from '../../services/researchNotesService';
import { exportNotesCSV, downloadFile, formatExportFilename } from '../../services/exportService.js';

export default function NotesPanel({ fundId = null, fundTicker = null }) {
  const enableNotes = (process.env.REACT_APP_ENABLE_NOTES || 'false') === 'true';
  const enableVisualRefresh = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';
  
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [body, setBody] = useState('');
  const [decision, setDecision] = useState('');
  const [overrideId, setOverrideId] = useState('');
  const [overrides, setOverrides] = useState([]);
  const [announce, setAnnounce] = useState('');
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [searchDebounceTimeout, setSearchDebounceTimeout] = useState(null);

  const cleanTicker = useMemo(() => (fundTicker || '').toUpperCase(), [fundTicker]);

  // Debounced search implementation
  const handleSearchInputChange = useCallback((value) => {
    setSearchInput(value);
    
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }
    
    const timeout = setTimeout(() => {
      setSearchTerm(value.toLowerCase().trim());
    }, 300); // 300ms debounce
    
    setSearchDebounceTimeout(timeout);
  }, [searchDebounceTimeout]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimeout) {
        clearTimeout(searchDebounceTimeout);
      }
    };
  }, [searchDebounceTimeout]);
  
  // Text highlighting utility
  const highlightText = useCallback((text, searchTerm) => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === searchTerm.toLowerCase()) {
        return (
          <mark
            key={index}
            style={{
              backgroundColor: '#fef08a',
              color: '#92400e',
              padding: '0 2px',
              borderRadius: '2px',
              fontWeight: '600'
            }}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  }, []);
  
  // Priority mapping for filtering
  const getPriorityFromDecision = (decision) => {
    switch (decision) {
      case 'reject': return 'high';
      case 'monitor': return 'medium';
      case 'approve': 
      case 'hold': return 'low';
      default: return 'medium';
    }
  };

  // Filtered notes based on search and priority
  const filteredNotes = useMemo(() => {
    let filtered = Array.isArray(notes) ? notes.filter(Boolean) : [];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(note => {
        const fundName = cleanTicker.toLowerCase();
        const noteBody = (note.body || '').toLowerCase();
        const noteDecision = (note.decision || '').toLowerCase();
        
        return (
          fundName.includes(searchTerm) ||
          noteBody.includes(searchTerm) ||
          noteDecision.includes(searchTerm)
        );
      });
    }
    
    // Apply priority filter
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(note => {
        const priority = getPriorityFromDecision(note.decision);
        return priority === selectedPriority;
      });
    }
    
    return filtered;
  }, [notes, searchTerm, selectedPriority, cleanTicker]);
  
  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
    setSelectedPriority('all');
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
      setSearchDebounceTimeout(null);
    }
  }, [searchDebounceTimeout]);
  
  // Export filtered notes function
  const handleExportNotes = useCallback(() => {
    try {
      const blob = exportNotesCSV({
        notes: filteredNotes,
        fundTicker: cleanTicker,
        searchTerm,
        selectedPriority,
        metadata: {
          exportType: 'Research Notes',
          totalNotes: (Array.isArray(notes) ? notes.length : 0),
          filteredCount: filteredNotes.length
        }
      });
      
      const filename = formatExportFilename({ 
        scope: `notes_${cleanTicker || 'all'}_${selectedPriority !== 'all' ? selectedPriority : 'all'}${searchTerm ? '_filtered' : ''}`, 
        asOf: null, 
        ext: 'csv' 
      });
      
      downloadFile(blob, filename, 'text/csv;charset=utf-8');
      
      setAnnounce(`Exported ${filteredNotes.length} notes to CSV`);
      setTimeout(() => setAnnounce(''), 2000);
    } catch (error) {
      console.error('Failed to export notes:', error);
      alert('Failed to export notes. Please try again.');
    }
  }, [filteredNotes, cleanTicker, searchTerm, selectedPriority, notes]);

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
    <div className="card" style={{ padding: enableVisualRefresh ? 16 : 12 }} data-testid="notes-panel">
      <div style={{ 
        fontWeight: 600, 
        marginBottom: enableVisualRefresh ? 16 : 8,
        fontSize: enableVisualRefresh ? '1.125rem' : '1rem',
        color: enableVisualRefresh ? '#1f2937' : 'inherit'
      }}>Research notes</div>
      <div aria-live="polite" style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(1px, 1px, 1px, 1px)' }}>{announce}</div>
      
      {/* Search and Filter Controls */}
      {notes.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: enableVisualRefresh ? 12 : 8,
          backgroundColor: enableVisualRefresh ? '#f8fafc' : '#f9fafb',
          border: enableVisualRefresh ? '1px solid #e2e8f0' : '1px solid #e5e7eb',
          borderRadius: enableVisualRefresh ? 8 : 6
        }}>
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 8
          }}>
            {/* Search Input */}
            <div style={{ 
              position: 'relative', 
              flex: '1 1 250px',
              minWidth: '200px'
            }}>
              <Search 
                size={16} 
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6b7280'
                }}
              />
              <input
                type="text"
                placeholder="Search notes by fund name or content..."
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 32px 8px 32px',
                  border: '1px solid #d1d5db',
                  borderRadius: enableVisualRefresh ? 6 : 4,
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: 2
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            {/* Priority Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={14} style={{ color: '#6b7280' }} />
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: enableVisualRefresh ? 6 : 4,
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Priority</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            
            {/* Export Button */}
            {filteredNotes.length > 0 && (
              <button
                onClick={handleExportNotes}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 12px',
                  border: '1px solid #3b82f6',
                  borderRadius: enableVisualRefresh ? 6 : 4,
                  backgroundColor: enableVisualRefresh ? '#3b82f6' : 'white',
                  color: enableVisualRefresh ? 'white' : '#3b82f6',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title={`Export ${filteredNotes.length} filtered notes to CSV`}
              >
                <Download size={14} />
                <span>Export</span>
              </button>
            )}
          </div>
          
          {/* Search Results Summary */}
          {(searchTerm || selectedPriority !== 'all') && (
            <div style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                Showing {filteredNotes.length} of {notes.length} notes
                {searchTerm && ` matching "${searchInput}"`}
                {selectedPriority !== 'all' && ` with ${selectedPriority} priority`}
              </span>
              {(searchTerm || selectedPriority !== 'all') && (
                <button
                  onClick={clearSearch}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    textDecoration: 'underline'
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gap: enableVisualRefresh ? 12 : 8, marginBottom: enableVisualRefresh ? 16 : 12 }}>
        <textarea
          placeholder="Add a research note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onAdd(); } }}
          style={{ 
            width: '100%', 
            minHeight: 70, 
            padding: enableVisualRefresh ? 12 : 8, 
            border: enableVisualRefresh ? '1px solid #d1d5db' : '1px solid #e5e7eb', 
            borderRadius: enableVisualRefresh ? 8 : 6,
            fontSize: '0.875rem',
            lineHeight: '1.5',
            resize: 'vertical'
          }}
        />
        <div style={{ display: 'flex', gap: enableVisualRefresh ? 12 : 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            data-testid="decision-select" 
            value={decision} 
            onChange={(e) => setDecision(e.target.value)} 
            style={{ 
              padding: enableVisualRefresh ? 10 : 8, 
              border: enableVisualRefresh ? '1px solid #d1d5db' : '1px solid #e5e7eb', 
              borderRadius: enableVisualRefresh ? 8 : 6,
              fontSize: '0.875rem'
            }}
          >
            <option value="">Decision (optional)</option>
            <option value="approve">✓ Approve</option>
            <option value="monitor">⚠ Monitor</option>
            <option value="reject">✗ Reject</option>
            <option value="hold">⏸ Hold</option>
          </select>
          <select 
            data-testid="override-select" 
            value={overrideId} 
            onChange={(e) => setOverrideId(e.target.value)} 
            style={{ 
              padding: enableVisualRefresh ? 10 : 8, 
              border: enableVisualRefresh ? '1px solid #d1d5db' : '1px solid #e5e7eb', 
              borderRadius: enableVisualRefresh ? 8 : 6,
              fontSize: '0.875rem'
            }}
          >
            <option value="">Link to Override (optional)</option>
            {overrides.map(o => (
              <option key={o.id} value={o.id}>{o.override_type} override — {new Date(o.created_at).toLocaleDateString()}</option>
            ))}
          </select>
          <button 
            onClick={onAdd} 
            className={enableVisualRefresh ? "btn" : "btn btn-primary"} 
            disabled={!body.trim()}
            style={enableVisualRefresh ? {
              padding: '10px 16px',
              backgroundColor: body.trim() ? '#3b82f6' : '#93c5fd',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: body.trim() ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s ease'
            } : {}}
          >
            Add Note
          </button>
        </div>
      </div>
      {filteredNotes.length === 0 ? (
        <div style={{ 
          color: '#6b7280', 
          textAlign: 'center', 
          padding: enableVisualRefresh ? 24 : 16,
          backgroundColor: enableVisualRefresh ? '#f8fafc' : '#f9fafb',
          borderRadius: enableVisualRefresh ? 8 : 6,
          border: enableVisualRefresh ? '1px solid #e2e8f0' : '1px solid #e5e7eb'
        }}>
          {searchTerm || selectedPriority !== 'all' ? (
            <div>
              <div style={{ marginBottom: 8, fontWeight: '500' }}>No matching notes found</div>
              <div style={{ fontSize: '0.875rem' }}>Try adjusting your search or filter criteria</div>
            </div>
          ) : (
            notes.length === 0 ? "No notes yet." : "No notes match your criteria."
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: enableVisualRefresh ? 12 : 8 }}>
          {filteredNotes.map(n => {
            const bodyText = String(n?.body || '');
            const tooLong = bodyText.length > 400;
            const shortText = tooLong ? bodyText.slice(0, 400) + '…' : bodyText;
            const highlightedShortText = highlightText(shortText, searchTerm);
            const priority = getPriorityFromDecision(n.decision);
            const priorityColors = {
              high: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
              medium: { bg: '#fefbf2', border: '#fed7aa', text: '#92400e' },
              low: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' }
            };
            const priorityColor = priorityColors[priority] || priorityColors.medium;
            
            return (
              <div 
                key={n.id || Math.random()} 
                style={{ 
                  padding: enableVisualRefresh ? 12 : 8, 
                  borderBottom: enableVisualRefresh ? '1px solid #e5e7eb' : '1px solid #f3f4f6',
                  backgroundColor: enableVisualRefresh ? 'white' : 'transparent',
                  borderRadius: enableVisualRefresh ? 6 : 0,
                  border: enableVisualRefresh ? '1px solid #e5e7eb' : 'none',
                  marginBottom: enableVisualRefresh ? 8 : 0,
                  transition: 'all 0.2s ease'
                }} 
                data-testid="note-item"
                onMouseEnter={(e) => {
                  if (enableVisualRefresh) {
                    e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (enableVisualRefresh) {
                    e.target.style.boxShadow = 'none';
                  }
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  fontSize: enableVisualRefresh ? '0.8125rem' : 12, 
                  color: '#6b7280',
                  marginBottom: 6
                }}>
                  <span>{n?.created_at ? new Date(n.created_at).toLocaleString() : '—'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        backgroundColor: priorityColor.bg,
                        color: priorityColor.text,
                        border: `1px solid ${priorityColor.border}`,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: '0.6875rem',
                        fontWeight: '500',
                        textTransform: 'uppercase'
                      }}
                    >
                      {priority} priority
                    </span>
                    <span>by {n?.created_by || '—'}</span>
                  </div>
                </div>
                {n?.decision && (
                  <div style={{ 
                    fontSize: enableVisualRefresh ? '0.8125rem' : 12, 
                    color: '#374151', 
                    marginTop: 4, 
                    marginBottom: 6,
                    display:'flex', 
                    alignItems:'center', 
                    gap: 6 
                  }} data-testid="note-decision">
                    <DecisionIcon decision={n.decision} />
                    <span>Decision: <strong>{highlightText(n.decision, searchTerm)}</strong></span>
                  </div>
                )}
                {n?.override_id && (
                  <div style={{ 
                    fontSize: enableVisualRefresh ? '0.8125rem' : 12, 
                    color: '#374151', 
                    marginTop: 4, 
                    marginBottom: 6,
                    display:'flex', 
                    alignItems:'center', 
                    gap: 6 
                  }}>
                    <Link2 size={12} aria-hidden />
                    <span>Linked to override</span>
                  </div>
                )}
                <div style={{ 
                  marginTop: 6,
                  fontSize: enableVisualRefresh ? '0.875rem' : '0.8125rem',
                  lineHeight: '1.5',
                  color: '#374151'
                }} data-testid="note-body">
                  {highlightedShortText}
                </div>
                {tooLong && (
                  <button
                    onClick={(e)=>{ e.preventDefault(); 
                      const highlightedFullText = highlightText(bodyText, searchTerm);
                      // For full text display, we'll use a simple alert for now
                      // In a real app, you might want to use a modal
                      alert(bodyText);
                    }} 
                    style={{ 
                      fontSize: enableVisualRefresh ? '0.8125rem' : 12,
                      color: '#3b82f6',
                      background: 'none',
                      border: 'none',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      marginTop: 4
                    }}
                  >
                    Show more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

