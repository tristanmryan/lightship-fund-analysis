// src/components/Tags/TagManager.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Tag, Settings, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { 
  applyTagRules, 
  getTagStatistics, 
  filterByTags, 
  getSuggestedActions,
  TAG_CATEGORIES,
  DEFAULT_TAG_RULES,
  TAG_CATEGORY_MAP
} from '../../services/tagEngine.js';

/**
 * Tag Manager Component
 * Manages automatic tagging, filtering, and tag-based insights
 */
const TagManager = ({ funds, benchmarkData, onFilterChange }) => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterMode, setFilterMode] = useState('any'); // 'any' or 'all'
  const [showTaggedOnly, setShowTaggedOnly] = useState(false);
  const [expandedFund, setExpandedFund] = useState(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);

  // Apply tag rules to funds
  const taggedFunds = useMemo(() => {
    const context = {
      benchmarks: benchmarkData,
      assetClassAverages: null // Will be calculated by applyTagRules
    };
    
    return applyTagRules(funds, context);
  }, [funds, benchmarkData]);

  // Get tag statistics
  const tagStats = useMemo(() => {
    return getTagStatistics(taggedFunds);
  }, [taggedFunds]);

  // Filter funds based on selected tags
  const filteredFunds = useMemo(() => {
    let filtered = taggedFunds;
    
    if (selectedTags.length > 0) {
      filtered = filterByTags(filtered, selectedTags, filterMode);
    }
    
    if (showTaggedOnly) {
      filtered = filtered.filter(f => f.autoTags && f.autoTags.length > 0);
    }
    
    return filtered;
  }, [taggedFunds, selectedTags, filterMode, showTaggedOnly]);

  // Notify parent of filter changes
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filteredFunds);
    }
  }, [filteredFunds, onFilterChange]);

  // Tag display component
  const TagBadge = ({ tag, clickable = true, showCount = false }) => {
    const isSelected = selectedTags.includes(tag.id);
    const count = showCount ? tagStats.tagCounts[tag.id] || 0 : null;
    
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.25rem 0.75rem',
          backgroundColor: isSelected ? tag.color : `${tag.color}20`,
          color: isSelected ? 'white' : tag.color,
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '500',
          cursor: clickable ? 'pointer' : 'default',
          border: `1px solid ${tag.color}`,
          marginRight: '0.5rem',
          marginBottom: '0.5rem',
          transition: 'all 0.2s'
        }}
        onClick={() => {
          if (!clickable) return;
          
          if (isSelected) {
            setSelectedTags(selectedTags.filter(id => id !== tag.id));
          } else {
            setSelectedTags([...selectedTags, tag.id]);
          }
        }}
      >
        <span style={{ marginRight: '0.25rem' }}>{tag.icon}</span>
        {tag.name}
        {count !== null && (
          <span style={{ 
            marginLeft: '0.5rem',
            padding: '0 0.375rem',
            backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            borderRadius: '9999px',
            fontSize: '0.6875rem'
          }}>
            {count}
          </span>
        )}
      </span>
    );
  };

  // Fund row with tags
  const FundRowWithTags = ({ fund }) => {
    const tags = fund.autoTags || [];
    const actions = getSuggestedActions(fund);
    const isExpanded = expandedFund === fund.Symbol;
    
    return (
      <div style={{
        marginBottom: '0.75rem',
        padding: '1rem',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        transition: 'all 0.2s'
      }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', cursor: 'pointer' }}
          onClick={() => setExpandedFund(isExpanded ? null : fund.Symbol)}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {fund.Symbol} - {fund.displayName}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              {fund['Asset Class']} | Score: {fund.scores?.final || '-'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {tags.map((tag, i) => (
                <TagBadge key={i} tag={tag} clickable={false} />
              ))}
              {tags.length === 0 && (
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No tags</span>
              )}
            </div>
          </div>
          <div style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}>
            ▼
          </div>
        </div>
        
        {isExpanded && actions.length > 0 && (
          <div style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Suggested Actions:
            </div>
            <ul style={{ marginLeft: '1.5rem', fontSize: '0.875rem', color: '#374151' }}>
              {actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem' 
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
          Smart Tags & Insights
        </h3>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowRuleEditor(!showRuleEditor)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e5e7eb',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}
          >
            <Settings size={16} />
            Manage Rules
          </button>
        </div>
      </div>

      {/* Tag Statistics Summary */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        marginBottom: '1rem'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Tags Applied</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{tagStats.totalTags}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Tagged Funds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {funds.length - tagStats.untaggedFunds.length} / {funds.length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Active Filters</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{selectedTags.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Filtered Funds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{filteredFunds.length}</div>
          </div>
        </div>
      </div>

      {/* Tag Filter Controls */}
      <div style={{
        padding: '1rem',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        marginBottom: '1rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h4 style={{ fontWeight: '600' }}>Filter by Tags</h4>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              style={{
                padding: '0.375rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            >
              <option value="any">Match Any Tag</option>
              <option value="all">Match All Tags</option>
            </select>
            
            <button
              onClick={() => setShowTaggedOnly(!showTaggedOnly)}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: showTaggedOnly ? '#3b82f6' : '#e5e7eb',
                color: showTaggedOnly ? 'white' : '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem'
              }}
            >
              {showTaggedOnly ? <Eye size={14} /> : <EyeOff size={14} />}
              Tagged Only
            </button>
            
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Tag Categories */}
        {Object.entries(TAG_CATEGORIES).map(([key, category]) => {
          const categoryTags = DEFAULT_TAG_RULES.filter(rule => {
            // Check if this rule has any occurrences
            if ((tagStats.tagCounts[rule.id] || 0) === 0) return false;
            
            // Check if the rule belongs to this category
            const ruleCategory = TAG_CATEGORY_MAP?.[rule.id] || TAG_CATEGORIES.CUSTOM;
            return ruleCategory === category;
          });
          
          if (categoryTags.length === 0) return null;
          
          return (
            <div key={key} style={{ marginBottom: '1rem' }}>
              <div style={{ 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                color: '#6b7280',
                marginBottom: '0.5rem'
              }}>
                {category}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {categoryTags.map(rule => (
                  <TagBadge 
                    key={rule.id}
                    tag={rule}
                    showCount={true}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tagged Funds List */}
      <div>
        <h4 style={{ fontWeight: '600', marginBottom: '0.75rem' }}>
          {showTaggedOnly ? 'Tagged' : 'Filtered'} Funds ({filteredFunds.length})
        </h4>
        
        {filteredFunds.length > 0 ? (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredFunds
              .sort((a, b) => (b.autoTags?.length || 0) - (a.autoTags?.length || 0))
              .slice(0, 20)
              .map((fund, i) => (
                <FundRowWithTags key={i} fund={fund} />
              ))}
            
            {filteredFunds.length > 20 && (
              <div style={{
                textAlign: 'center',
                padding: '1rem',
                color: '#6b7280',
                fontSize: '0.875rem'
              }}>
                Showing top 20 of {filteredFunds.length} funds
              </div>
            )}
          </div>
        ) : (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem',
            color: '#6b7280'
          }}>
            <Tag size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
            <p>No funds match the selected filters</p>
          </div>
        )}
      </div>

      {/* Rule Editor Modal */}
      {showRuleEditor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowRuleEditor(false)}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Tag Rules Configuration
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Default Rules</h4>
              {DEFAULT_TAG_RULES.map(rule => (
                <div key={rule.id} style={{
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.375rem',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <TagBadge tag={rule} clickable={false} />
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {rule.description}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                      Applied to {tagStats.tagCounts[rule.id] || 0} funds
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                onClick={() => setShowRuleEditor(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagManager;