// src/components/Dashboard/ScoreAnalysisSection.jsx
import React, { useState } from 'react';
import { BarChart3, FileText, TrendingUp, Target, Info, Download, Share2 } from 'lucide-react';
import ScoreBreakdownChart from './ScoreBreakdownChart';
import MetricExplanationPanel from './MetricExplanationPanel';

/**
 * Score Analysis Section Component
 * Combines chart visualizations and detailed explanations in a unified interface
 * Designed for advisor-client meetings with professional presentation capabilities
 */
const ScoreAnalysisSection = ({ fund, benchmark, funds }) => {
  const [activeTab, setActiveTab] = useState('charts'); // 'charts' | 'explanations' | 'summary'
  const [selectedChartType, setSelectedChartType] = useState('waterfall');

  // Tab configuration
  const tabs = [
    { 
      key: 'charts', 
      label: 'Score Breakdown Charts', 
      icon: BarChart3,
      description: 'Visual representations of metric contributions'
    },
    { 
      key: 'explanations', 
      label: 'Detailed Explanations', 
      icon: FileText,
      description: 'In-depth analysis of each metric and its impact'
    },
    { 
      key: 'summary', 
      label: 'Executive Summary', 
      icon: TrendingUp,
      description: 'Key insights and recommendations for clients'
    }
  ];

  // Generate executive summary
  const generateExecutiveSummary = () => {
    if (!fund?.scores?.breakdown) return null;

    const breakdown = fund.scores.breakdown;
    const finalScore = fund.scores?.final || 0;
    
    // Analyze top contributors
    const contributors = Object.entries(breakdown)
      .map(([key, info]) => ({
        key,
        label: info.label || key,
        contribution: info.reweightedContribution || info.weightedZScore || 0,
        value: info.value,
        percentile: info.percentile || 50
      }))
      .filter(item => Number.isFinite(item.contribution))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const topPositive = contributors.filter(c => c.contribution > 0).slice(0, 3);
    const topNegative = contributors.filter(c => c.contribution < 0).slice(0, 3);
    
    // Generate insights
    const insights = [];
    if (finalScore >= 70) {
      insights.push('This fund demonstrates exceptional performance across multiple metrics');
      insights.push('Strong risk-adjusted returns with consistent execution');
    } else if (finalScore >= 60) {
      insights.push('This fund shows above-average performance with room for improvement');
      insights.push('Good fundamentals with some areas that could be enhanced');
    } else if (finalScore >= 50) {
      insights.push('This fund performs in line with peer expectations');
      insights.push('Average performance with balanced risk-return profile');
    } else if (finalScore >= 40) {
      insights.push('This fund shows below-average performance');
      insights.push('Several metrics indicate areas of concern');
    } else {
      insights.push('This fund demonstrates significant performance challenges');
      insights.push('Multiple metrics suggest fundamental issues');
    }

    // Generate recommendations
    const recommendations = [];
    if (topPositive.length > 0) {
      recommendations.push(`Leverage strong performance in ${topPositive[0].label} as a key selling point`);
    }
    if (topNegative.length > 0) {
      recommendations.push(`Address concerns about ${topNegative[0].label} performance`);
    }
    if (finalScore < 50) {
      recommendations.push('Consider alternative funds with stronger overall profiles');
    } else {
      recommendations.push('This fund may be suitable for appropriate risk tolerance levels');
    }

    return {
      score: finalScore,
      scoreLevel: finalScore >= 70 ? 'Exceptional' : 
                 finalScore >= 60 ? 'Above Average' : 
                 finalScore >= 50 ? 'Average' : 
                 finalScore >= 40 ? 'Below Average' : 'Poor',
      topPositive,
      topNegative,
      insights,
      recommendations,
      peerComparison: `This fund ranks in the ${finalScore >= 70 ? 'top 10%' : 
                                       finalScore >= 60 ? 'top 25%' : 
                                       finalScore >= 50 ? 'middle 50%' : 
                                       finalScore >= 40 ? 'bottom 25%' : 'bottom 10%'} of its asset class`
    };
  };

  // Export functionality
  const exportAnalysis = () => {
    // Implementation for exporting analysis data
    console.log('Exporting score analysis...');
  };

  // Share functionality
  const shareAnalysis = () => {
    // Implementation for sharing analysis
    console.log('Sharing score analysis...');
  };

  if (!fund?.scores?.breakdown) {
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center', 
        color: '#6B7280',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        border: '1px solid #E5E7EB'
      }}>
        <Info size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
          No Score Analysis Available
        </div>
        <div style={{ fontSize: 14 }}>
          This fund doesn't have scoring data available for analysis.
        </div>
      </div>
    );
  }

  const summary = generateExecutiveSummary();

  return (
    <div style={{ 
      backgroundColor: '#FFFFFF', 
      borderRadius: 8, 
      border: '1px solid #E5E7EB',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '20px 24px', 
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: 20, 
              fontWeight: 600, 
              color: '#1F2937' 
            }}>
              Score Analysis Dashboard
            </h2>
            <p style={{ 
              margin: '8px 0 0 0', 
              fontSize: 14, 
              color: '#6B7280' 
            }}>
              Professional analysis tools for client presentations
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={exportAnalysis}
              style={{
                padding: '8px 16px',
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                backgroundColor: '#FFFFFF',
                color: '#374151',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s'
              }}
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={shareAnalysis}
              style={{
                padding: '8px 16px',
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                backgroundColor: '#FFFFFF',
                color: '#374151',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s'
              }}
            >
              <Share2 size={16} />
              Share
            </button>
          </div>
        </div>

        {/* Score overview */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 24,
          padding: '16px',
          backgroundColor: '#FFFFFF',
          borderRadius: 6,
          border: '1px solid #E5E7EB'
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Final Score</div>
            <div style={{ 
              fontSize: 32, 
              fontWeight: 700, 
              color: summary?.score >= 60 ? '#059669' : 
                     summary?.score >= 50 ? '#F59E0B' : '#DC2626'
            }}>
              {summary?.score || 0}
            </div>
          </div>
          
          <div style={{ height: 40, width: 1, backgroundColor: '#E5E7EB' }} />
          
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Performance Level</div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 600, 
              color: '#1F2937' 
            }}>
              {summary?.scoreLevel || 'Unknown'}
            </div>
          </div>
          
          <div style={{ height: 40, width: 1, backgroundColor: '#E5E7EB' }} />
          
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Peer Ranking</div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 500, 
              color: '#1F2937' 
            }}>
              {summary?.peerComparison || 'Not available'}
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '16px 20px',
                border: 'none',
                borderBottom: `3px solid ${isActive ? '#3B82F6' : 'transparent'}`,
                backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF',
                color: isActive ? '#1E40AF' : '#6B7280',
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s'
              }}
            >
              <Icon size={20} />
              <div>{tab.label}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{tab.description}</div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: '24px' }}>
        {activeTab === 'charts' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                fontSize: 16, 
                fontWeight: 600, 
                color: '#1F2937' 
              }}>
                Score Breakdown Visualization
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: 14, 
                color: '#6B7280' 
              }}>
                Choose a chart type to visualize how different metrics contribute to the overall score
              </p>
            </div>
            
            <ScoreBreakdownChart 
              fund={fund} 
              chartType={selectedChartType}
            />
          </div>
        )}

        {activeTab === 'explanations' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                fontSize: 16, 
                fontWeight: 600, 
                color: '#1F2937' 
              }}>
                Detailed Metric Analysis
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: 14, 
                color: '#6B7280' 
              }}>
                Click on any metric to see detailed explanations and benchmark comparisons
              </p>
            </div>
            
            <MetricExplanationPanel 
              fund={fund} 
              benchmark={benchmark}
            />
          </div>
        )}

        {activeTab === 'summary' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                fontSize: 16, 
                fontWeight: 600, 
                color: '#1F2937' 
              }}>
                Executive Summary
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: 14, 
                color: '#6B7280' 
              }}>
                Key insights and recommendations for client presentations
              </p>
            </div>
            
            {summary && (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Key Insights */}
                <div style={{ 
                  backgroundColor: '#F0F9FF', 
                  padding: '20px', 
                  borderRadius: 8,
                  border: '1px solid #BAE6FD'
                }}>
                  <h4 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: '#0C4A6E' 
                  }}>
                    Key Insights
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#0C4A6E' }}>
                    {summary.insights.map((insight, index) => (
                      <li key={index} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Top Contributors */}
                <div style={{ 
                  backgroundColor: '#F0FDF4', 
                  padding: '20px', 
                  borderRadius: 8,
                  border: '1px solid #BBF7D0'
                }}>
                  <h4 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: '#166534' 
                  }}>
                    Top Positive Contributors
                  </h4>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {summary.topPositive.map((contributor, index) => (
                      <div key={contributor.key} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 6,
                        border: '1px solid #DCFCE7'
                      }}>
                        <span style={{ fontWeight: 500, color: '#166534' }}>
                          {contributor.label}
                        </span>
                        <span style={{ 
                          fontWeight: 600, 
                          color: '#059669',
                          fontSize: 14
                        }}>
                          +{contributor.contribution.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Areas of Concern */}
                {summary.topNegative.length > 0 && (
                  <div style={{ 
                    backgroundColor: '#FEF2F2', 
                    padding: '20px', 
                    borderRadius: 8,
                    border: '1px solid #FECACA'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 12px 0', 
                      fontSize: 16, 
                      fontWeight: 600, 
                      color: '#991B1B' 
                    }}>
                      Areas of Concern
                    </h4>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {summary.topNegative.map((contributor, index) => (
                        <div key={contributor.key} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 12px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: 6,
                          border: '1px solid #FEE2E2'
                        }}>
                          <span style={{ fontWeight: 500, color: '#991B1B' }}>
                            {contributor.label}
                          </span>
                          <span style={{ 
                            fontWeight: 600, 
                            color: '#DC2626',
                            fontSize: 14
                          }}>
                            {contributor.contribution.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div style={{ 
                  backgroundColor: '#FFFBEB', 
                  padding: '20px', 
                  borderRadius: 8,
                  border: '1px solid #FDE68A'
                }}>
                  <h4 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: '#92400E' 
                  }}>
                    Recommendations for Advisors
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#92400E' }}>
                    {summary.recommendations.map((recommendation, index) => (
                      <li key={index} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreAnalysisSection; 