// src/components/Dashboard/MetricExplanationPanel.jsx
import React, { useState, useMemo } from 'react';
import { Info, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { formatNumber, formatPercent } from '../../utils/formatters';
import { METRICS_CONFIG } from '../../services/scoring';

/**
 * Metric Explanation Panel Component
 * Provides detailed breakdowns and explanations of metrics for client presentations
 * Designed to help advisors explain scores and build client confidence
 */
const MetricExplanationPanel = ({ fund, benchmark }) => {
  const [expandedMetrics, setExpandedMetrics] = useState(new Set());
  const [selectedMetric, setSelectedMetric] = useState(null);

  // Extract and process metric data
  const metricData = useMemo(() => {
    if (!fund?.scores?.breakdown) return [];
    
    const breakdown = fund.scores.breakdown;
    const data = Object.entries(breakdown)
      .map(([key, info]) => {
        const label = METRICS_CONFIG.labels[key] || key;
        const contribution = info.reweightedContribution || info.weightedZScore || 0;
        const zScore = info.zScore || 0;
        const percentile = info.percentile || 50;
        const weight = info.weight || 0;
        const coverage = info.coverage || null;
        const value = info.value;
        
        // Get benchmark comparison if available
        let benchmarkValue = null;
        let benchmarkDelta = null;
        if (benchmark?.fund) {
          switch (key) {
            case 'ytd':
              benchmarkValue = benchmark.fund.ytd_return;
              break;
            case 'oneYear':
              benchmarkValue = benchmark.fund.one_year_return;
              break;
            case 'threeYear':
              benchmarkValue = benchmark.fund.three_year_return;
              break;
            case 'fiveYear':
              benchmarkValue = benchmark.fund.five_year_return;
              break;
            case 'tenYear':
              benchmarkValue = benchmark.fund.ten_year_return;
              break;
            case 'sharpeRatio3Y':
              benchmarkValue = benchmark.fund.sharpe_ratio;
              break;
            case 'stdDev3Y':
              benchmarkValue = benchmark.fund.standard_deviation_3y || benchmark.fund.standard_deviation;
              break;
            case 'stdDev5Y':
              benchmarkValue = benchmark.fund.standard_deviation_5y || benchmark.fund.standard_deviation;
              break;
            case 'upCapture3Y':
              benchmarkValue = benchmark.fund.up_capture_ratio;
              break;
            case 'downCapture3Y':
              benchmarkValue = benchmark.fund.down_capture_ratio;
              break;
            case 'alpha5Y':
              benchmarkValue = benchmark.fund.alpha;
              break;
            case 'expenseRatio':
              benchmarkValue = benchmark.fund.expense_ratio;
              break;
            case 'managerTenure':
              benchmarkValue = benchmark.fund.manager_tenure;
              break;
          }
          
          if (benchmarkValue != null && value != null) {
            benchmarkDelta = value - benchmarkValue;
          }
        }
        
        return {
          key,
          label,
          contribution: Math.round(contribution * 1000) / 1000,
          zScore: Math.round(zScore * 1000) / 1000,
          percentile,
          weight,
          coverage,
          value,
          benchmarkValue,
          benchmarkDelta,
          isPositive: contribution >= 0,
          absContribution: Math.abs(contribution),
          weightSource: info.weightSource || 'resolved'
        };
      })
      .filter(item => Number.isFinite(item.contribution))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return data;
  }, [fund, benchmark]);

  // Get metric explanation and context
  const getMetricExplanation = (metricKey) => {
    const explanations = {
      ytd: {
        description: 'Year-to-date return shows how the fund has performed since the beginning of the current year.',
        interpretation: 'Higher YTD returns indicate stronger recent performance, though this is a short-term measure.',
        context: 'Useful for understanding recent momentum but should be considered alongside longer-term metrics.'
      },
      oneYear: {
        description: 'One-year return measures the fund\'s performance over the past 12 months.',
        interpretation: 'This metric helps assess how the fund has performed through recent market cycles.',
        context: 'A good indicator of recent performance but can be volatile due to market conditions.'
      },
      threeYear: {
        description: 'Three-year return provides a medium-term view of fund performance.',
        interpretation: 'This period typically covers multiple market cycles and economic conditions.',
        context: 'Often considered a sweet spot for performance evaluation - long enough for trends to emerge, short enough to be relevant.'
      },
      fiveYear: {
        description: 'Five-year return shows how the fund has performed over a longer investment horizon.',
        interpretation: 'This metric helps identify funds that can sustain performance through various market conditions.',
        context: 'Five years is often the minimum period recommended for evaluating investment performance.'
      },
      tenYear: {
        description: 'Ten-year return measures long-term performance and consistency.',
        interpretation: 'This metric demonstrates the fund\'s ability to deliver results over multiple market cycles.',
        context: 'Long-term performance is crucial for retirement planning and wealth building.'
      },
      sharpeRatio3Y: {
        description: 'Sharpe ratio measures risk-adjusted returns by comparing excess returns to volatility.',
        interpretation: 'Higher Sharpe ratios indicate better risk-adjusted performance.',
        context: 'A Sharpe ratio above 1.0 is considered good, above 2.0 is excellent.'
      },
      stdDev3Y: {
        description: 'Standard deviation measures the fund\'s volatility or price fluctuations.',
        interpretation: 'Lower standard deviation means more stable, predictable performance.',
        context: 'Important for understanding how much the fund\'s value might fluctuate.'
      },
      stdDev5Y: {
        description: 'Five-year standard deviation provides a longer-term view of volatility.',
        interpretation: 'This metric shows how consistent the fund\'s risk profile has been.',
        context: 'Longer-term volatility measures are more reliable for risk assessment.'
      },
      upCapture3Y: {
        description: 'Up capture ratio shows how well the fund performs in rising markets.',
        interpretation: 'Higher up capture means the fund captures more of the upside when markets rise.',
        context: 'Important for understanding how the fund behaves in favorable market conditions.'
      },
      downCapture3Y: {
        description: 'Down capture ratio measures performance in declining markets.',
        interpretation: 'Lower down capture means the fund loses less in falling markets.',
        context: 'Critical for understanding downside protection and risk management.'
      },
      alpha5Y: {
        description: 'Alpha measures excess return relative to what would be expected given the fund\'s risk level.',
        interpretation: 'Positive alpha indicates the fund is outperforming its risk-adjusted expectations.',
        context: 'Alpha is a key measure of active management skill and value added.'
      },
      expenseRatio: {
        description: 'Expense ratio represents the annual cost of owning the fund as a percentage of assets.',
        interpretation: 'Lower expense ratios mean more of your returns stay in your pocket.',
        context: 'Expense ratios directly impact net returns and compound over time.'
      },
      managerTenure: {
        description: 'Manager tenure shows how long the current management team has been in place.',
        interpretation: 'Longer tenure often indicates stability and consistent strategy execution.',
        context: 'Manager changes can impact fund performance and strategy consistency.'
      }
    };
    
    return explanations[metricKey] || {
      description: 'This metric measures an aspect of fund performance.',
      interpretation: 'The value indicates how this metric contributes to the overall score.',
      context: 'Consider this metric in the context of your overall investment strategy.'
    };
  };

  // Get performance assessment
  const getPerformanceAssessment = (metric) => {
    const { contribution, percentile, coverage } = metric;
    
    if (contribution >= 0.5) {
      return { level: 'excellent', icon: CheckCircle, color: '#059669', text: 'Strong positive contributor' };
    } else if (contribution >= 0.2) {
      return { level: 'good', icon: CheckCircle, color: '#059669', text: 'Good positive contributor' };
    } else if (contribution >= -0.2) {
      return { level: 'neutral', icon: HelpCircle, color: '#6B7280', text: 'Neutral impact' };
    } else if (contribution >= -0.5) {
      return { level: 'caution', icon: AlertTriangle, color: '#F59E0B', text: 'Negative contributor' };
    } else {
      return { level: 'poor', icon: XCircle, color: '#DC2626', text: 'Significant negative impact' };
    }
  };

  // Toggle metric expansion
  const toggleMetric = (metricKey) => {
    const newExpanded = new Set(expandedMetrics);
    if (newExpanded.has(metricKey)) {
      newExpanded.delete(metricKey);
    } else {
      newExpanded.add(metricKey);
    }
    setExpandedMetrics(newExpanded);
  };

  // Format metric value based on type
  const formatMetricValue = (value, metricKey) => {
    if (value == null || isNaN(value)) return '—';
    
    switch (metricKey) {
      case 'ytd':
      case 'oneYear':
      case 'threeYear':
      case 'fiveYear':
      case 'tenYear':
      case 'stdDev3Y':
      case 'stdDev5Y':
      case 'upCapture3Y':
      case 'downCapture3Y':
      case 'expenseRatio':
        return formatPercent(value, 2);
      case 'sharpeRatio3Y':
      case 'alpha5Y':
        return formatNumber(value, 2);
      case 'managerTenure':
        return `${formatNumber(value, 1)} years`;
      default:
        return formatNumber(value, 2);
    }
  };

  if (!fund?.scores?.breakdown) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: '#6B7280',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        border: '1px solid #E5E7EB'
      }}>
        <Info size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <div>No metric breakdown available for this fund</div>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: '#FFFFFF', 
      borderRadius: 8, 
      border: '1px solid #E5E7EB',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: 16, 
              fontWeight: 600, 
              color: '#1F2937' 
            }}>
              Metric Analysis & Explanations
            </h3>
            <p style={{ 
              margin: '4px 0 0 0', 
              fontSize: 12, 
              color: '#6B7280' 
            }}>
              Detailed breakdown of how each metric contributes to the overall score
            </p>
          </div>
          
          {benchmark && (
            <div style={{ 
              fontSize: 12, 
              color: '#6B7280',
              padding: '6px 12px',
              backgroundColor: '#EFF6FF',
              borderRadius: 6,
              border: '1px solid #DBEAFE'
            }}>
              vs {benchmark.ticker}
            </div>
          )}
        </div>
      </div>

      {/* Metric list */}
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        {metricData.map((metric) => {
          const isExpanded = expandedMetrics.has(metric.key);
          const assessment = getPerformanceAssessment(metric);
          const explanation = getMetricExplanation(metric.key);
          const Icon = assessment.icon;
          
          return (
            <div key={metric.key} style={{ borderBottom: '1px solid #F3F4F6' }}>
              {/* Metric header */}
              <div 
                style={{ 
                  padding: '16px 20px',
                  cursor: 'pointer',
                  backgroundColor: isExpanded ? '#F8FAFC' : '#FFFFFF',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => toggleMetric(metric.key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon size={16} style={{ color: assessment.color }} />
                    <div>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 600, 
                        color: '#1F2937',
                        marginBottom: 2
                      }}>
                        {metric.label}
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <span>{assessment.text}</span>
                        {metric.coverage !== null && (
                          <span style={{ 
                            padding: '2px 6px',
                            backgroundColor: metric.coverage >= 0.8 ? '#D1FAE5' : 
                                           metric.coverage >= 0.6 ? '#FEF3C7' : '#FEE2E2',
                            color: metric.coverage >= 0.8 ? '#065F46' : 
                                   metric.coverage >= 0.6 ? '#92400E' : '#991B1B',
                            borderRadius: 4,
                            fontSize: 10
                          }}>
                            {Math.round(metric.coverage * 100)}% coverage
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Contribution */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: 16, 
                        fontWeight: 600, 
                        color: metric.isPositive ? '#059669' : '#DC2626' 
                      }}>
                        {metric.isPositive ? '+' : ''}{formatNumber(metric.contribution, 2)}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>contribution</div>
                    </div>
                    
                    {/* Fund value */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2937' }}>
                        {formatMetricValue(metric.value, metric.key)}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>fund value</div>
                    </div>
                    
                    {/* Benchmark comparison */}
                    {benchmark && metric.benchmarkValue != null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2937' }}>
                          {formatMetricValue(metric.benchmarkValue, metric.key)}
                        </div>
                        <div style={{ 
                          fontSize: 11, 
                          color: metric.benchmarkDelta >= 0 ? '#059669' : '#DC2626' 
                        }}>
                          {metric.benchmarkDelta >= 0 ? '+' : ''}{formatNumber(metric.benchmarkDelta, 2)} vs bench
                        </div>
                      </div>
                    )}
                    
                    {/* Expand/collapse indicator */}
                    <div style={{ 
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      color: '#6B7280'
                    }}>
                      ▼
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Expanded content */}
              {isExpanded && (
                <div style={{ 
                  padding: '0 20px 16px 20px',
                  backgroundColor: '#F8FAFC',
                  borderTop: '1px solid #E5E7EB'
                }}>
                  {/* Metric details */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16,
                    marginBottom: 16
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Weight</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2937' }}>
                        {formatNumber(metric.weight, 3)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Z-Score</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2937' }}>
                        {formatNumber(metric.zScore, 3)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Percentile</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2937' }}>
                        {metric.percentile}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Weight Source</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2937' }}>
                        {metric.weightSource}
                      </div>
                    </div>
                  </div>
                  
                  {/* Explanation */}
                  <div style={{ 
                    backgroundColor: '#FFFFFF',
                    padding: 16,
                    borderRadius: 6,
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        What this metric measures:
                      </div>
                      <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
                        {explanation.description}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        How to interpret this value:
                      </div>
                      <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
                        {explanation.interpretation}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        Context for investors:
                      </div>
                      <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
                        {explanation.context}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Footer */}
      <div style={{ 
        padding: '12px 20px', 
        borderTop: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB',
        fontSize: 12,
        color: '#6B7280'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} style={{ color: '#059669' }} />
            <span>Strong contributor</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: '#F59E0B' }} />
            <span>Needs attention</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <XCircle size={14} style={{ color: '#DC2626' }} />
            <span>Significant concern</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricExplanationPanel; 