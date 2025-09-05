// src/components/Dashboard/ScoreTooltip.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';
import { METRICS_CONFIG } from '../../services/scoring.js';
import { getScoreColor, getScoreLabel } from '../../services/scoringPolicy';
import { formatNumber } from '../../utils/formatters';
import { getFundScoringHistory } from '../../services/scoringHistory.js';

const ENABLE_VISUAL_REFRESH = (process.env.REACT_APP_ENABLE_VISUAL_REFRESH || 'false') === 'true';

/**
 * Score Tooltip Component
 * Provides detailed explanations for fund scores with contribution breakdowns
 */
const ScoreTooltip = ({ 
  fund, 
  score, 
  children, 
  placement = 'bottom',
  showContributions = true,
  maxContributions = 5
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [history, setHistory] = useState([]);
  const [recentDelta, setRecentDelta] = useState(null);
  const tooltipRef = useRef(null);
  const triggerRef = useRef(null);

  const scoreValue = score ?? fund?.scores?.final ?? 0;
  const breakdown = fund?.scores?.breakdown || {};

  // Calculate position on show
  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const trigger = triggerRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      let top = trigger.bottom + 8;
      let left = trigger.left + (trigger.width / 2) - (tooltip.width / 2);

      // Adjust for placement
      if (placement === 'top') {
        top = trigger.top - tooltip.height - 8;
      } else if (placement === 'left') {
        top = trigger.top + (trigger.height / 2) - (tooltip.height / 2);
        left = trigger.left - tooltip.width - 8;
      } else if (placement === 'right') {
        top = trigger.top + (trigger.height / 2) - (tooltip.height / 2);
        left = trigger.right + 8;
      }

      // Keep within viewport
      if (left < 8) left = 8;
      if (left + tooltip.width > viewport.width - 8) {
        left = viewport.width - tooltip.width - 8;
      }
      if (top < 8) top = 8;
      if (top + tooltip.height > viewport.height - 8) {
        top = viewport.height - tooltip.height - 8;
      }

      setPosition({ top, left });
    }
  }, [isVisible, placement]);

  // Load score history on first show for trending/mini-chart
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isVisible) return;
        const ticker = fund?.ticker || fund?.symbol || fund?.fund_ticker;
        if (!ticker) return;
        if (history && history.length > 0) return; // already loaded
        const rows = await getFundScoringHistory(String(ticker).toUpperCase(), 12);
        if (cancelled) return;
        setHistory(rows || []);
        if ((rows || []).length >= 2) {
          const last = rows[rows.length - 1]?.score ?? null;
          const prev = rows[rows.length - 2]?.score ?? null;
          if (last != null && prev != null) setRecentDelta(Math.round((last - prev) * 10) / 10);
        }
      } catch {
        if (!cancelled) { setHistory([]); setRecentDelta(null); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, fund?.ticker]);

  // Get top contributors
  const contributors = Object.entries(breakdown)
    .map(([key, info]) => ({
      key,
      label: METRICS_CONFIG.labels[key] || key,
      contribution: info.reweightedContribution || info.weightedZScore || 0,
      percentile: info.percentile || 50,
      value: info.value,
      weight: info.weight
    }))
    .filter(item => Number.isFinite(item.contribution))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, maxContributions);

  const clearHideTimer = () => { if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; } };
  const handleShow = () => { clearHideTimer(); setIsVisible(true); };
  const handleHide = () => { clearHideTimer(); hideTimerRef.current = setTimeout(() => setIsVisible(false), 200); };

  if (!fund && !score) return children;

  const scoreColor = getScoreColor(scoreValue);
  const scoreLabel = getScoreLabel(scoreValue);

  // Confidence based on metrics coverage (server-side scoring provides these fields)
  const metricsUsed = Number(fund?.scores?.metricsUsed || 0);
  const totalMetrics = Number(fund?.scores?.totalPossibleMetrics || 0);
  const coverage = totalMetrics > 0 ? metricsUsed / totalMetrics : null;
  const confidenceLabel = (() => {
    if (coverage == null) return null;
    if (coverage >= 0.85) return 'High';
    if (coverage >= 0.6) return 'Medium';
    return 'Low';
  })();

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        style={{ 
          display: 'inline-block',
          cursor: 'help',
          position: 'relative'
        }}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 1000,
            maxWidth: 320,
            backgroundColor: '#FFFFFF',
            border: ENABLE_VISUAL_REFRESH ? '2px solid #E5E7EB' : '1px solid #D1D5DB',
            borderRadius: ENABLE_VISUAL_REFRESH ? 12 : 8,
            padding: ENABLE_VISUAL_REFRESH ? 16 : 12,
            boxShadow: ENABLE_VISUAL_REFRESH 
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' 
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            fontSize: 14,
            lineHeight: 1.4,
            pointerEvents: 'auto'
          }}
          onMouseEnter={handleShow}
          onMouseLeave={handleHide}
        >
          {/* Score Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid #E5E7EB'
          }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: scoreColor
              }}
            />
            <div>
              <div style={{ 
                fontWeight: 600, 
                color: '#1F2937',
                fontSize: ENABLE_VISUAL_REFRESH ? 16 : 14
              }}>
                Score: {formatNumber(scoreValue, 1)}
              </div>
              <div style={{ 
                fontSize: 12, 
                color: scoreColor,
                fontWeight: 500
              }}>
                {scoreLabel} Performance
              </div>
            </div>
            {typeof recentDelta === 'number' && (
              <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {recentDelta >= 0 ? (
                  <TrendingUp size={14} color="#059669" />
                ) : (
                  <TrendingDown size={14} color="#DC2626" />
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: recentDelta >= 0 ? '#059669' : '#DC2626' }}>
                  {recentDelta >= 0 ? '+' : ''}{formatNumber(recentDelta, 1)} (recent)
                </span>
              </div>
            )}
          </div>

          {/* Confidence / Fund Info */}
          {confidenceLabel && (
            <div style={{
              marginBottom: 10,
              fontSize: 12,
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontWeight: 600 }}>Confidence:</span>
              <span style={{
                fontWeight: 600,
                color: confidenceLabel === 'High' ? '#059669' : confidenceLabel === 'Medium' ? '#d97706' : '#b91c1c'
              }}>{confidenceLabel}</span>
              <span style={{ color: '#6B7280' }}>({metricsUsed}/{totalMetrics} metrics)</span>
            </div>
          )}

          {/* Fund Info */}
          {fund && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ 
                fontWeight: 600, 
                color: '#1F2937',
                fontSize: 13
              }}>
                {fund.name || fund.Symbol || 'Unknown Fund'}
              </div>
              {fund.ticker && (
                <div style={{ 
                  fontSize: 12, 
                  color: '#6B7280',
                  fontFamily: 'monospace'
                }}>
                  {fund.ticker}
                </div>
              )}
            </div>
          )}

          {/* Explanation */}
          <div style={{
            marginBottom: contributors.length > 0 ? 12 : 0,
            fontSize: 12,
            color: '#4B5563',
            lineHeight: 1.5
          }}>
            This score represents the fund's overall performance relative to peers in its asset class, 
            incorporating risk-adjusted returns, consistency, and cost efficiency.
          </div>

          {/* Top Contributors */}
          {showContributions && contributors.length > 0 && (
            <div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <Info size={12} />
                Key Factors
              </div>
              
              <div style={{ display: 'grid', gap: 6 }}>
                {contributors.map(contributor => {
                  const isPositive = contributor.contribution > 0;
                  const Icon = isPositive ? TrendingUp : TrendingDown;
                  
                  return (
                    <div
                      key={contributor.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        backgroundColor: isPositive ? '#F0FDF4' : '#FEF2F2',
                        borderRadius: 6,
                        border: `1px solid ${isPositive ? '#BBF7D0' : '#FECACA'}`
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flex: 1,
                        minWidth: 0
                      }}>
                        <Icon 
                          size={12} 
                          style={{ 
                            color: isPositive ? '#059669' : '#DC2626',
                            flexShrink: 0
                          }} 
                        />
                        <div style={{
                          fontSize: 11,
                          color: isPositive ? '#065F46' : '#7F1D1D',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {contributor.label}
                        </div>
                      </div>
                      
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isPositive ? '#059669' : '#DC2626',
                        textAlign: 'right',
                        flexShrink: 0
                      }}>
                        {isPositive ? '+' : ''}{formatNumber(contributor.contribution, 1)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {Object.keys(breakdown).length > maxContributions && (
                <div style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#6B7280',
                  textAlign: 'center',
                  fontStyle: 'italic'
                }}>
                  ... and {Object.keys(breakdown).length - maxContributions} other factors
                </div>
              )}
            </div>
          )}

          {/* Mini score history chart */}
          {Array.isArray(history) && history.length >= 2 && (
            <div style={{ marginTop: 10 }}>
              <MiniScoreChart history={history} />
            </div>
          )}
        </div>
      )}
    </>
  );
};

function MiniScoreChart({ history }) {
  const w = 280, h = 80, pad = 8;
  const points = (history || []).map(r => ({ x: new Date(r.date).getTime(), y: Number(r.score || 0) }));
  if (points.length < 2) return null;
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const sx = (v) => pad + ((v - minX) / ((maxX - minX) || 1)) * (w - pad * 2);
  const sy = (v) => (h - pad) - ((v - minY) / ((maxY - minY) || 1)) * (h - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} role="img" aria-label="Score history mini-chart">
      <rect x={0} y={0} width={w} height={h} fill="#F9FAFB" rx={6} />
      <path d={d} fill="none" stroke="#3B82F6" strokeWidth={2} />
      <circle cx={sx(last.x)} cy={sy(last.y)} r={3} fill="#3B82F6" />
    </svg>
  );
}

export default ScoreTooltip;
