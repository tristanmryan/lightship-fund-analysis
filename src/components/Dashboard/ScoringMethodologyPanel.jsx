// src/components/Dashboard/ScoringMethodologyPanel.jsx
import React, { useState, useMemo } from 'react';
import { 
  Info, ChevronDown, ChevronRight, BarChart3, Database, 
  Shield, Clock, AlertTriangle, CheckCircle, Target,
  Layers, TrendingUp, FileText, RefreshCw
} from 'lucide-react';
import { METRICS_CONFIG, DEFAULT_WEIGHTS, SCORE_BANDS } from '../../services/scoring';
import { 
  isWinsorizationEnabled, 
  getCoverageThreshold, 
  getTinyClassPolicy,
  getMissingPolicy 
} from '../../services/scoringPolicy';

/**
 * Scoring Methodology Panel
 * Comprehensive information panel explaining score calculation methodology,
 * weight distribution, data sources, and governance information
 */
const ScoringMethodologyPanel = ({ fund = null, funds = [], visible = false, onToggle }) => {
  const [activeSection, setActiveSection] = useState('methodology');
  const [expandedSections, setExpandedSections] = useState({
    weights: true,
    methodology: true,
    governance: false,
    confidence: false
  });

  const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';

  // Calculate data completeness and confidence for the fund
  const scoreConfidence = useMemo(() => {
    if (!fund || !fund.scores) return null;

    const breakdown = fund.scores.breakdown || {};
    const totalMetrics = Object.keys(DEFAULT_WEIGHTS).length;
    const availableMetrics = Object.keys(breakdown).filter(key => {
      const metric = breakdown[key];
      return metric && metric.rawValue != null && !isNaN(metric.rawValue);
    }).length;

    const completeness = totalMetrics > 0 ? (availableMetrics / totalMetrics) * 100 : 0;
    
    let confidence = 'high';
    let confidenceScore = 95;
    let issues = [];

    if (completeness < 60) {
      confidence = 'low';
      confidenceScore = 45;
      issues.push('Limited data availability');
    } else if (completeness < 80) {
      confidence = 'medium';
      confidenceScore = 75;
      issues.push('Some metrics missing');
    }

    // Check for stale data (mock implementation)
    const dataAge = Math.random() * 30; // Mock days old
    if (dataAge > 7) {
      issues.push(`Data is ${Math.floor(dataAge)} days old`);
      confidenceScore -= 10;
    }

    return {
      completeness: Math.round(completeness),
      confidence,
      confidenceScore: Math.max(25, confidenceScore),
      availableMetrics,
      totalMetrics,
      issues
    };
  }, [fund]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderWeightDistribution = () => {
    const weights = METRICS_CONFIG.weights || DEFAULT_WEIGHTS;
    const labels = METRICS_CONFIG.labels || {};
    
    // Group weights by category
    const categories = {
      'Performance': ['ytd', 'oneYear', 'threeYear', 'fiveYear', 'tenYear'],
      'Risk Management': ['sharpeRatio3Y', 'stdDev3Y', 'stdDev5Y', 'alpha5Y'],
      'Market Behavior': ['upCapture3Y', 'downCapture3Y'],
      'Cost & Management': ['expenseRatio', 'managerTenure'],
      'Benchmark Relative': ['oneYearDeltaVsBench']
    };

    return (
      <div>
        {Object.entries(categories).map(([category, metrics]) => {
          const categoryWeight = metrics.reduce((sum, key) => sum + (weights[key] || 0), 0);
          if (categoryWeight === 0) return null;

          return (
            <div key={category} style={{ marginBottom: ENABLE_VISUAL_REFRESH ? 20 : 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                padding: ENABLE_VISUAL_REFRESH ? '8px 12px' : '6px 8px',
                backgroundColor: ENABLE_VISUAL_REFRESH ? '#f8fafc' : '#f9fafb',
                borderRadius: ENABLE_VISUAL_REFRESH ? 8 : 6,
                borderLeft: `4px solid ${getCategoryColor(category)}`
              }}>
                <span style={{ 
                  fontWeight: '600', 
                  color: '#374151',
                  fontSize: ENABLE_VISUAL_REFRESH ? '0.9375rem' : '0.875rem'
                }}>
                  {category}
                </span>
                <span style={{ 
                  fontWeight: '700',
                  color: getCategoryColor(category),
                  fontSize: ENABLE_VISUAL_REFRESH ? '0.9375rem' : '0.875rem'
                }}>
                  {(categoryWeight * 100).toFixed(1)}%
                </span>
              </div>
              
              <div style={{ paddingLeft: 16 }}>
                {metrics.map(key => {
                  const weight = weights[key] || 0;
                  if (weight === 0) return null;
                  
                  return (
                    <div key={key} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      fontSize: '0.8125rem',
                      color: '#6b7280'
                    }}>
                      <span>{labels[key] || key}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: Math.max(20, Math.abs(weight) * 200),
                          height: 4,
                          backgroundColor: weight > 0 ? '#10b981' : '#ef4444',
                          borderRadius: 2
                        }} />
                        <span style={{ 
                          fontWeight: '500',
                          color: weight > 0 ? '#10b981' : '#ef4444'
                        }}>
                          {weight > 0 ? '+' : ''}{(weight * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMethodologyExplanation = () => (
    <div style={{ fontSize: ENABLE_VISUAL_REFRESH ? '0.875rem' : '0.8125rem', lineHeight: '1.6' }}>
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: '#374151',
          fontSize: ENABLE_VISUAL_REFRESH ? '1rem' : '0.9375rem',
          fontWeight: '600'
        }}>
          Scoring Process
        </h4>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Funds are compared to peers within their asset class</li>
          <li>Each metric is standardized to Z-scores using peer statistics</li>
          <li>Weighted Z-scores are summed to produce a raw composite score</li>
          <li>Raw scores are scaled using <code>50 + 10 × rawScore</code></li>
          <li>Final scores are clamped to 0-100 range</li>
        </ol>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: '#374151',
          fontSize: ENABLE_VISUAL_REFRESH ? '1rem' : '0.9375rem',
          fontWeight: '600'
        }}>
          Score Interpretation
        </h4>
        <div style={{ display: 'grid', gap: 6 }}>
          {SCORE_BANDS.map((band, index) => {
            const nextMin = index > 0 ? SCORE_BANDS[index - 1].min : 100;
            return (
              <div key={band.label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '6px 8px',
                borderRadius: 4,
                backgroundColor: `${band.color}08`
              }}>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: band.color
                }} />
                <span style={{ fontWeight: '500' }}>{band.label}</span>
                <span style={{ color: '#6b7280' }}>
                  {band.min}-{nextMin > 100 ? 100 : nextMin - 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: '#374151',
          fontSize: ENABLE_VISUAL_REFRESH ? '1rem' : '0.9375rem',
          fontWeight: '600'
        }}>
          Data Processing
        </h4>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Winsorization: {isWinsorizationEnabled() ? 'Enabled' : 'Disabled'}</li>
          <li>Coverage Threshold: {(getCoverageThreshold() * 100).toFixed(0)}%</li>
          <li>Missing Data Policy: {getMissingPolicy().policy}</li>
          <li>Tiny Class Fallback: {getTinyClassPolicy().minPeers} min peers</li>
        </ul>
      </div>
    </div>
  );

  const renderGovernanceInfo = () => (
    <div style={{ fontSize: ENABLE_VISUAL_REFRESH ? '0.875rem' : '0.8125rem' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          backgroundColor: ENABLE_VISUAL_REFRESH ? '#f0f9ff' : '#f9fafb',
          borderRadius: ENABLE_VISUAL_REFRESH ? 8 : 6,
          border: `1px solid ${ENABLE_VISUAL_REFRESH ? '#e0f2fe' : '#e5e7eb'}`
        }}>
          <CheckCircle size={20} style={{ color: '#10b981' }} />
          <div>
            <div style={{ fontWeight: '600', color: '#374151' }}>Model Version</div>
            <div style={{ color: '#6b7280' }}>v2.1.0 (Current)</div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          backgroundColor: ENABLE_VISUAL_REFRESH ? '#f0f9ff' : '#f9fafb',
          borderRadius: ENABLE_VISUAL_REFRESH ? 8 : 6,
          border: `1px solid ${ENABLE_VISUAL_REFRESH ? '#e0f2fe' : '#e5e7eb'}`
        }}>
          <Clock size={20} style={{ color: '#3b82f6' }} />
          <div>
            <div style={{ fontWeight: '600', color: '#374151' }}>Last Model Update</div>
            <div style={{ color: '#6b7280' }}>December 15, 2024</div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          backgroundColor: ENABLE_VISUAL_REFRESH ? '#f0fdf4' : '#f9fafb',
          borderRadius: ENABLE_VISUAL_REFRESH ? 8 : 6,
          border: `1px solid ${ENABLE_VISUAL_REFRESH ? '#dcfce7' : '#e5e7eb'}`
        }}>
          <RefreshCw size={20} style={{ color: '#10b981' }} />
          <div>
            <div style={{ fontWeight: '600', color: '#374151' }}>Data Refresh</div>
            <div style={{ color: '#6b7280' }}>Daily at 6:00 AM EST</div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          backgroundColor: ENABLE_VISUAL_REFRESH ? '#fffbeb' : '#f9fafb',
          borderRadius: ENABLE_VISUAL_REFRESH ? 8 : 6,
          border: `1px solid ${ENABLE_VISUAL_REFRESH ? '#fde68a' : '#e5e7eb'}`
        }}>
          <Database size={20} style={{ color: '#f59e0b' }} />
          <div>
            <div style={{ fontWeight: '600', color: '#374151' }}>Data Sources</div>
            <div style={{ color: '#6b7280' }}>Morningstar, YCharts, Internal Research</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfidenceIndicator = () => {
    if (!scoreConfidence) return null;

    const { completeness, confidence, confidenceScore, availableMetrics, totalMetrics, issues } = scoreConfidence;
    const confidenceColor = confidence === 'high' ? '#10b981' : confidence === 'medium' ? '#f59e0b' : '#ef4444';

    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          padding: 16,
          backgroundColor: `${confidenceColor}08`,
          borderRadius: ENABLE_VISUAL_REFRESH ? 8 : 6,
          border: `2px solid ${confidenceColor}30`
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: confidenceColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '700',
            fontSize: '1.125rem'
          }}>
            {confidenceScore}
          </div>
          <div>
            <div style={{ 
              fontWeight: '700',
              fontSize: ENABLE_VISUAL_REFRESH ? '1.125rem' : '1rem',
              color: '#374151',
              textTransform: 'capitalize'
            }}>
              {confidence} Confidence
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {availableMetrics}/{totalMetrics} metrics available ({completeness}% complete)
            </div>
          </div>
        </div>

        {issues.length > 0 && (
          <div style={{
            padding: 12,
            backgroundColor: '#fef3c7',
            borderRadius: ENABLE_VISUAL_REFRESH ? 6 : 4,
            border: '1px solid #fde68a'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              marginBottom: 8,
              color: '#92400e',
              fontWeight: '600'
            }}>
              <AlertTriangle size={16} />
              Data Quality Notes
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#92400e' }}>
              {issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Performance': '#3b82f6',
      'Risk Management': '#ef4444', 
      'Market Behavior': '#10b981',
      'Cost & Management': '#f59e0b',
      'Benchmark Relative': '#8b5cf6'
    };
    return colors[category] || '#6b7280';
  };

  const sections = [
    { key: 'methodology', label: 'Methodology', icon: Target, component: renderMethodologyExplanation },
    { key: 'weights', label: 'Weight Distribution', icon: BarChart3, component: renderWeightDistribution },
    { key: 'confidence', label: 'Score Confidence', icon: Shield, component: renderConfidenceIndicator },
    { key: 'governance', label: 'Data Governance', icon: FileText, component: renderGovernanceInfo }
  ];

  if (!visible) return null;

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: ENABLE_VISUAL_REFRESH ? 12 : 8,
      border: `1px solid ${ENABLE_VISUAL_REFRESH ? '#e2e8f0' : '#e5e7eb'}`,
      boxShadow: ENABLE_VISUAL_REFRESH ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: ENABLE_VISUAL_REFRESH ? '20px 24px' : '16px 20px',
        backgroundColor: ENABLE_VISUAL_REFRESH ? '#f8fafc' : '#f9fafb',
        borderBottom: `1px solid ${ENABLE_VISUAL_REFRESH ? '#e2e8f0' : '#e5e7eb'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Info size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: ENABLE_VISUAL_REFRESH ? '1.25rem' : '1.125rem',
              fontWeight: '700',
              color: '#374151'
            }}>
              Scoring Methodology
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '0.875rem', 
              color: '#6b7280' 
            }}>
              Comprehensive scoring system explanation and governance
            </p>
          </div>
        </div>
        <button
          onClick={onToggle}
          style={{
            padding: '8px 12px',
            border: `1px solid ${ENABLE_VISUAL_REFRESH ? '#d1d5db' : '#e5e7eb'}`,
            borderRadius: 6,
            backgroundColor: 'white',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Close
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${ENABLE_VISUAL_REFRESH ? '#e2e8f0' : '#e5e7eb'}`,
        backgroundColor: ENABLE_VISUAL_REFRESH ? '#fefefe' : 'white'
      }}>
        {sections.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: ENABLE_VISUAL_REFRESH ? '12px 16px' : '10px 12px',
              border: 'none',
              backgroundColor: activeSection === key 
                ? (ENABLE_VISUAL_REFRESH ? '#eff6ff' : '#f3f4f6')
                : 'transparent',
              color: activeSection === key ? '#3b82f6' : '#6b7280',
              borderBottom: activeSection === key 
                ? '2px solid #3b82f6' 
                : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeSection === key ? '600' : '500',
              transition: 'all 0.2s ease'
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ 
        padding: ENABLE_VISUAL_REFRESH ? '24px' : '20px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        {sections.find(s => s.key === activeSection)?.component()}
      </div>
    </div>
  );
};

export default ScoringMethodologyPanel;