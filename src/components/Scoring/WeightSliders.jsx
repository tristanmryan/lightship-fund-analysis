/**
 * WeightSliders.jsx - Interactive weight slider component
 * 
 * This component provides real-time weight adjustment sliders with
 * immediate visual feedback and validation warnings.
 */

import React, { useCallback, useMemo } from 'react';
import { AlertTriangle, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { METRICS as METRICS_REGISTRY } from '../../services/metricsRegistry.js';

// Category styling
const CATEGORY_COLORS = {
  'Returns': '#10B981',
  'Risk': '#3B82F6',
  'Risk Metrics': '#3B82F6',
  'Cost': '#F59E0B',
  'Management': '#8B5CF6',
  'Other': '#6B7280'
};

const WeightSliders = ({ weights, onWeightChange, validation, diffSummary, coverageMap }) => {
  
  // Group metrics by category
  const metricsByCategory = useMemo(() => {
    const grouped = {};
    Object.entries(METRICS_REGISTRY).forEach(([key, config]) => {
      const cat = config.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ key, ...config });
    });
    // Stable sort by label within category
    Object.values(grouped).forEach(list => list.sort((a, b) => a.label.localeCompare(b.label)));
    return grouped;
  }, []);
  
  // Handle slider change with immediate feedback
  const handleSliderChange = useCallback((metric, event) => {
    const value = parseFloat(event.target.value);
    onWeightChange(metric, value);
  }, [onWeightChange]);
  
  // Get slider color based on weight value and metric type
  const getSliderColor = useCallback((metric, weight) => {
    const config = METRICS_REGISTRY[metric];
    if (!config) return '#9CA3AF';
    
    const categoryColor = CATEGORY_COLORS[config.category] || '#6B7280';
    
    // Return appropriate color with intensity
    if (weight === 0) return '#E5E7EB';
    return categoryColor;
  }, []);
  
  // Format weight for display
  const formatWeight = useCallback((weight) => {
    if (weight === 0) return '0%';
    return `${(weight * 100).toFixed(1)}%`;
  }, []);
  
  // Check if metric has custom weight
  const hasCustomWeight = useCallback((metric) => {
    return diffSummary?.differences?.[metric] !== undefined;
  }, [diffSummary]);
  
  // Get difference from default
  const getWeightDifference = useCallback((metric) => {
    const diff = diffSummary?.differences?.[metric];
    if (!diff) return null;
    return diff.difference;
  }, [diffSummary]);
  
  const totalWeight = useMemo(() => {
    return Object.values(weights).reduce((sum, weight) => sum + Math.abs(weight), 0);
  }, [weights]);
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px',
      flex: 1,
      overflow: 'auto'
    }}>
      {/* Validation Summary */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div style={{
          padding: '12px',
          backgroundColor: validation.errors.length > 0 ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${validation.errors.length > 0 ? '#FECACA' : '#FED7AA'}`,
          borderRadius: '6px'
        }}>
          {validation.errors.length > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: validation.warnings.length > 0 ? '8px' : '0'
            }}>
              <AlertTriangle size={16} style={{ color: '#DC2626' }} />
              <span style={{ fontSize: '14px', color: '#DC2626', fontWeight: '500' }}>
                Errors: {validation.errors.join('; ')}
              </span>
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} style={{ color: '#D97706' }} />
              <span style={{ fontSize: '14px', color: '#D97706' }}>
                Warnings: {validation.warnings.join('; ')}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Weight Summary */}
      <div style={{
        padding: '12px',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px', color: '#374151' }}>
          Total Weight: <strong>{formatWeight(totalWeight)}</strong>
        </span>
        
        {diffSummary?.hasCustomWeights && (
          <span style={{ 
            fontSize: '12px', 
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Info size={12} />
            {diffSummary.totalDifferences} customized
          </span>
        )}
      </div>
      
      {/* Metric Sliders by Category */}
      {Object.entries(metricsByCategory).map(([category, metrics]) => {
        const visible = metrics.filter(({ key }) => (weights?.[key] ?? 0) > 0);
        if (visible.length === 0) return null;
        return (
          <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Category Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingBottom: '8px',
              borderBottom: `2px solid ${CATEGORY_COLORS[category] || '#E5E7EB'}`
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: CATEGORY_COLORS[category] || '#E5E7EB'
              }} />
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827'
              }}>
                {category}
              </h3>
            </div>
            
            {/* Metrics in Category */}
            {visible.map(({ key, label, description, isHigherBetter }) => {
              const weight = weights[key] || 0;
              const customWeight = hasCustomWeight(key);
              const difference = getWeightDifference(key);
              const coverage = coverageMap?.[key] ?? null;
              
              return (
                <div key={key} style={{
                  padding: '16px',
                  backgroundColor: customWeight ? '#FEF7FF' : '#FEFEFE',
                  border: `1px solid ${customWeight ? '#E879F9' : '#E5E7EB'}`,
                  borderRadius: '8px'
                }}>
                  {/* Metric Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <label style={{
                          fontSize: '15px',
                          fontWeight: '500',
                          color: '#111827'
                        }}>
                          {label}
                        </label>
                        
                        {isHigherBetter ? (
                          <TrendingUp size={14} style={{ color: '#059669' }} />
                        ) : (
                          <TrendingDown size={14} style={{ color: '#DC2626' }} />
                        )}
                        
                        {customWeight && (
                          <div style={{
                            padding: '2px 6px',
                            backgroundColor: '#E879F9',
                            color: 'white',
                            fontSize: '10px',
                            borderRadius: '10px',
                            fontWeight: '500'
                          }}>
                            CUSTOM
                          </div>
                        )}
                        {typeof coverage === 'number' && (
                          <div style={{
                            padding: '2px 6px',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            fontSize: '10px',
                            borderRadius: '10px',
                            fontWeight: 500
                          }}>
                            {Math.round(coverage * 100)}% coverage
                          </div>
                        )}
                      </div>
                      
                      <div style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        marginBottom: '4px'
                      }}>
                        {description}
                      </div>
                      
                      {difference && (
                        <div style={{
                          fontSize: '12px',
                          color: difference > 0 ? '#059669' : '#DC2626',
                          fontWeight: '500'
                        }}>
                          {difference > 0 ? '+' : ''}{formatWeight(difference)} vs default
                        </div>
                      )}
                    </div>
                    
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#111827',
                      minWidth: '60px',
                      textAlign: 'right'
                    }}>
                      {formatWeight(weight)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button
                      onClick={() => onWeightChange(key, 0)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #E5E7EB',
                        borderRadius: 6,
                        backgroundColor: 'white',
                        color: '#6B7280',
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Disable metric
                    </button>
                  </div>
                  
                  {/* Slider */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={weight}
                      onChange={(e) => handleSliderChange(key, e)}
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '4px',
                        background: `linear-gradient(to right, ${getSliderColor(key, weight)} 0%, ${getSliderColor(key, weight)} ${weight * 100}%, #E5E7EB ${weight * 100}%, #E5E7EB 100%)`,
                        outline: 'none',
                        cursor: 'pointer',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    />
                    
                    {/* Slider styling for different browsers */}
                    <style>
                      {`
                      input[type="range"]::-webkit-slider-thumb {
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: ${getSliderColor(key, weight)};
                        cursor: pointer;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                      }
                      
                      input[type="range"]::-moz-range-thumb {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: ${getSliderColor(key, weight)};
                        cursor: pointer;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                      }
                      `}
                    </style>
                    
                    {/* Slider marks */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      paddingX: '2px'
                    }}>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>0%</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>25%</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>50%</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>75%</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>100%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      
      {/* Performance Note */}
      <div style={{
        padding: '12px',
        backgroundColor: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1E40AF',
        textAlign: 'center'
      }}>
        💡 Scores update in real-time as you adjust weights. Target: &lt;50ms response time.
      </div>
    </div>
  );
};

export default WeightSliders;
