
// src/components/Trading/Trading.jsx
import React from 'react';
import ProfessionalTable from '../tables/ProfessionalTable';
import flowsService from '../../services/flowsService';
import { getAdvisorOptions, getAdvisorName } from '../../config/advisorNames';
import { buildCSV, formatExportFilename, downloadFile } from '../../services/exportService';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactCurrencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function formatCurrency(value, { compact = false, signed = false } = {}) {
  if (value == null || Number.isNaN(value)) return '--';
  const formatter = compact ? compactCurrencyFormatter : currencyFormatter;
  const formatted = formatter.format(Math.abs(Number(value)));
  if (!signed) return formatted;
  const prefix = Number(value) >= 0 ? '+' : '-';
  return `${prefix}${formatted}`;
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '--';
  return numberFormatter.format(Number(value));
}

function safeMonthLabel(month) {
  if (!month) return '';
  try {
    const d = new Date(month);
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return month;
  }
}

function monthAbbrev(month) {
  if (!month) return '';
  try {
    const d = new Date(month);
    return d.toLocaleString('en-US', { month: 'short' });
  } catch {
    return month;
  }
}

const MONTH_LIMIT = 24;

const FLOW_CHART_MODES = [
  { value: 'net', label: 'Net' },
  { value: 'inflows', label: 'Inflows' },
  { value: 'outflows', label: 'Outflows' }
];

function FlowStoryChart({ data = [], mode = 'net', height = 320 }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div style={{ height, background: '#f3f4f6', borderRadius: 12 }} />;
  }

  const palette = {
    net: {
      gradient: [
        { offset: '0%', color: 'rgba(16,185,129,0.5)' },
        { offset: '50%', color: 'rgba(59,130,246,0.3)' },
        { offset: '100%', color: 'rgba(239,68,68,0.45)' }
      ],
      line: '#1f2937',
      label: 'Net flow'
    },
    inflows: {
      gradient: [
        { offset: '0%', color: 'rgba(56,189,248,0.5)' },
        { offset: '60%', color: 'rgba(59,130,246,0.35)' },
        { offset: '100%', color: 'rgba(16,185,129,0.4)' }
      ],
      line: '#0f766e',
      label: 'Inflows'
    },
    outflows: {
      gradient: [
        { offset: '0%', color: 'rgba(248,113,113,0.2)' },
        { offset: '65%', color: 'rgba(239,68,68,0.45)' },
        { offset: '100%', color: 'rgba(153,27,27,0.6)' }
      ],
      line: '#b91c1c',
      label: 'Outflows'
    }
  };

  const theme = palette[mode] || palette.net;
  const width = 960;
  const padX = 64;
  const padY = 32;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;

  const points = data.map((row) => {
    const net = Number(row.net_flow || 0);
    const inflows = Number(row.inflows || 0);
    const outflows = Number(row.outflows || 0);
    let value = net;
    if (mode === 'inflows') value = inflows;
    if (mode === 'outflows') value = -Math.abs(outflows);
    return {
      month: row.month,
      net,
      inflows,
      outflows,
      value
    };
  });

  const xs = points.map((p) => new Date(p.month).getTime());
  const values = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...values, 0);
  let maxY = Math.max(...values, 0);

  if (mode === 'inflows') {
    minY = 0;
    maxY = Math.max(...values, 0);
  }

  if (mode === 'outflows') {
    maxY = 0;
    minY = Math.min(...values, 0);
  }

  if (minY === maxY) {
    const pad = Math.max(Math.abs(minY), 1);
    minY -= pad;
    maxY += pad;
  }

  const xScale = (value) => {
    if (maxX === minX) return padX + plotWidth / 2;
    return padX + ((value - minX) / (maxX - minX)) * plotWidth;
  };
  const yScale = (value) => {
    if (maxY === minY) return padY + plotHeight / 2;
    return padY + (1 - (value - minY) / (maxY - minY)) * plotHeight;
  };

  const scaledPoints = points.map((p) => ({
    ...p,
    x: xScale(new Date(p.month).getTime()),
    y: yScale(p.value)
  }));

  const zeroY = yScale(0);
  const zeroClamped = Math.max(padY, Math.min(zeroY, height - padY));
  const hasPositive = maxY > 0;
  const hasNegative = minY < 0;
  const positiveRectHeight = hasPositive ? (zeroY <= padY ? plotHeight : zeroClamped - padY) : 0;
  const negativeRectHeight = hasNegative ? (zeroY >= height - padY ? plotHeight : height - padY - zeroClamped) : 0;

  const areaPath = [
    `M ${scaledPoints[0].x} ${zeroY}`,
    ...scaledPoints.map((p) => `L ${p.x} ${p.y}`),
    `L ${scaledPoints[scaledPoints.length - 1].x} ${zeroY}`,
    'Z'
  ].join(' ');

  const linePath = scaledPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const tickCount = Math.min(6, scaledPoints.length);
  const tickEvery = Math.max(1, Math.floor(scaledPoints.length / tickCount));
  const ticks = scaledPoints.filter((_, idx) => idx % tickEvery === 0 || idx === scaledPoints.length - 1);

  const latestPoint = scaledPoints[scaledPoints.length - 1];
  const previousPoint = scaledPoints.length > 1 ? scaledPoints[scaledPoints.length - 2] : null;
  const momentum = previousPoint ? latestPoint.value - previousPoint.value : 0;
  const momentumMagnitude = Math.abs(momentum);
  let momentumText = '';
  if (momentum !== 0) {
    if (mode === 'outflows') {
      momentumText = momentum < 0
        ? `Selling pressure increasing ${formatCurrency(momentumMagnitude, { compact: true })}`
        : `Selling pressure easing ${formatCurrency(momentumMagnitude, { compact: true })}`;
    } else if (mode === 'inflows') {
      momentumText = momentum > 0
        ? `Buying pace rising ${formatCurrency(momentumMagnitude, { compact: true })}`
        : `Buying pace easing ${formatCurrency(momentumMagnitude, { compact: true })}`;
    } else {
      momentumText = momentum > 0
        ? `Momentum rising by ${formatCurrency(momentumMagnitude, { compact: true })}`
        : `Momentum easing by ${formatCurrency(momentumMagnitude, { compact: true })}`;
    }
  }

  const rangeValue = Math.abs(maxY - minY);
  const gradientId = `flowAreaGradient-${mode}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`${theme.label} timeline`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {theme.gradient.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" stroke="#e5e7eb" />
      {hasPositive && positiveRectHeight > 0 && (
        <rect x={padX} y={padY} width={plotWidth} height={positiveRectHeight} fill="rgba(16,185,129,0.08)" />
      )}
      {hasNegative && negativeRectHeight > 0 && (
        <rect x={padX} y={zeroY >= height - padY ? padY : zeroClamped} width={plotWidth} height={negativeRectHeight} fill="rgba(239,68,68,0.08)" />
      )}
      <path d={areaPath} fill={`url(#${gradientId})`} opacity="0.8" />
      <line x1={padX} y1={zeroY} x2={padX + plotWidth} y2={zeroY} stroke="#9ca3af" strokeDasharray="4 4" strokeWidth="1" />
      <path d={linePath} stroke={theme.line} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {scaledPoints.map((p) => (
        <circle key={p.month} cx={p.x} cy={p.y} r={3} fill={theme.line} opacity="0.6" />
      ))}
      {ticks.map((tick) => (
        <g key={`tick-${tick.month}`}>
          <line x1={tick.x} y1={padY + plotHeight} x2={tick.x} y2={padY + plotHeight + 6} stroke="#9ca3af" />
          <text x={tick.x} y={padY + plotHeight + 20} fontSize={11} textAnchor="middle" fill="#4b5563">
            {monthAbbrev(tick.month)}
          </text>
        </g>
      ))}
      <text x={padX} y={padY - 10} fontSize={12} fill="#6b7280">
        {`${theme.label} (${formatCurrency(rangeValue, { compact: true })} range)`}
      </text>
      {latestPoint && (
        <g>
          <circle cx={latestPoint.x} cy={latestPoint.y} r={6} fill={theme.line} />
          <text x={latestPoint.x + 10} y={latestPoint.y - 10} fontSize={12} fill="#111827">
            {formatCurrency(latestPoint.value, { compact: true, signed: mode !== 'inflows' })}
          </text>
          {momentumText && (
            <text x={latestPoint.x + 10} y={latestPoint.y + 8} fontSize={11} fill="#4b5563">
              {momentumText}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
function FlowIntensityGrid({ rows = [], advisorFilter, onSelectAssetClass, interactiveAssetClasses = null }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6b7280' }}>
        No flow intensity data available{advisorFilter ? ' for this advisor selection' : ''}.
      </div>
    );
  }

  const enriched = rows.map((row) => {
    const inflows = Number(row.inflows || 0);
    const outflows = Number(row.outflows || 0);
    const net = Number(row.net_flow != null ? row.net_flow : inflows - outflows);
    const intensity = Math.abs(inflows) + Math.abs(outflows);
    return {
      asset_class: row.asset_class || 'Unclassified',
      inflows,
      outflows,
      net,
      advisors: Number(row.advisors_trading || 0),
      intensity
    };
  });

  const maxIntensity = Math.max(...enriched.map((r) => r.intensity), 0) || 1;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {enriched.map((row) => {
        const intensityRatio = Math.min(1, row.intensity / maxIntensity);
        const positive = row.net >= 0;
        const tone = positive ? 'rgba(16,185,129,' : 'rgba(239,68,68,';
        const background = `${tone}${0.12 + intensityRatio * 0.25})`;
        const barWidth = Math.max(6, Math.round(intensityRatio * 100));
        const hasDetails = interactiveAssetClasses ? interactiveAssetClasses.has(row.asset_class) : true;
        const isInteractive = typeof onSelectAssetClass === 'function' && row.intensity > 0 && hasDetails;
        const card = (
          <div style={{ background, border: '1px solid rgba(17,24,39,0.08)', borderRadius: 12, padding: 16, display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 600, color: '#111827' }}>{row.asset_class}</div>
            <div style={{ fontSize: 12, color: '#4b5563' }}>Intensity {formatCurrency(row.intensity, { compact: true })}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: positive ? '#065f46' : '#991b1b' }}>
              {positive ? 'Net Inflow' : 'Net Outflow'} {formatCurrency(row.net, { compact: true })}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.5)', overflow: 'hidden' }}>
              <div style={{ width: `${barWidth}%`, height: '100%', background: positive ? '#15803d' : '#dc2626' }} />
            </div>
            <div style={{ fontSize: 12, color: '#4b5563' }}>
              Advisors engaged: {row.advisors ? formatNumber(row.advisors) : 'n/a'}
            </div>
            {isInteractive && (
              <div style={{ fontSize: 11, color: '#1d4ed8' }}>Tap to review underlying funds</div>
            )}
          </div>
        );

        if (!isInteractive) {
          return (
            <div key={row.asset_class} style={{ cursor: 'default' }}>
              {card}
            </div>
          );
        }

        return (
          <button
            key={row.asset_class}
            type="button"
            onClick={() => onSelectAssetClass(row.asset_class)}
            style={{ all: 'unset', cursor: 'pointer' }}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
function FlowBubbleField({ data = [], height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Not enough trade volume data yet.
      </div>
    );
  }

  const width = 960;
  const padX = 48;
  const padY = 32;
  const columns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(data.length))));
  const rows = Math.ceil(data.length / columns);
  const cellWidth = (width - padX * 2) / columns;
  const cellHeight = (height - padY * 2) / Math.max(rows, 1);
  const maxVolume = Math.max(...data.map((d) => d.total_volume), 1);
  const maxAdvisors = Math.max(...data.map((d) => d.advisors_trading || 0), 1);

  const bubbles = data.map((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cx = padX + column * cellWidth + cellWidth / 2;
    const cy = padY + row * cellHeight + cellHeight / 2;
    const volumeRatio = Math.sqrt(Math.abs(item.total_volume) / maxVolume);
    const radius = Math.max(22, volumeRatio * Math.min(cellWidth, cellHeight) * 0.45);
    const advisorsRatio = (item.advisors_trading || 0) / maxAdvisors;
    const baseColor = item.net_flow >= 0 ? [16, 185, 129] : [239, 68, 68];
    const opacity = 0.2 + advisorsRatio * 0.6;
    const fill = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${opacity.toFixed(2)})`;
    return { ...item, cx, cy, radius, fill };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Trading volume bubbles">
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" stroke="#e5e7eb" />
      {bubbles.map((bubble) => (
        <g key={bubble.ticker}>
          <circle cx={bubble.cx} cy={bubble.cy} r={bubble.radius} fill={bubble.fill} stroke="rgba(17,24,39,0.12)" strokeWidth="1" />
          <text x={bubble.cx} y={bubble.cy - 6} fontSize={14} fontWeight="600" textAnchor="middle" fill="#111827">
            {bubble.ticker}
          </text>
          <text x={bubble.cx} y={bubble.cy + 12} fontSize={11} textAnchor="middle" fill="#1f2937">
            {formatCurrency(bubble.net_flow, { compact: true, signed: true })}
          </text>
          <text x={bubble.cx} y={bubble.cy + 28} fontSize={10} textAnchor="middle" fill="#4b5563">
            {formatCurrency(bubble.total_volume, { compact: true })} volume | {formatNumber(bubble.advisors_trading || 0)} advisors
          </text>
        </g>
      ))}
    </svg>
  );
}
function AdvisorSpotlights({ cards = [], month }) {
  if (!cards || cards.length === 0) {
    return (
      <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Advisor trading leaders will surface once trades post for {safeMonthLabel(month)}.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {cards.map((card) => {
        const positive = card.net_flow >= 0;
        return (
          <div key={card.advisor_id} style={{ borderRadius: 12, border: '1px solid rgba(17,24,39,0.08)', padding: 16, background: '#ffffff', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1f2937', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16 }}>
                  {card.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{card.displayName}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{positive ? 'Net buyer' : 'Net seller'}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: positive ? '#047857' : '#b91c1c', background: positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', padding: '4px 8px', borderRadius: 999 }}>
                {formatCurrency(card.net_flow, { compact: true, signed: true })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, fontSize: 12, color: '#4b5563' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{formatCurrency(card.total_volume, { compact: true })}</div>
                <div>Total volume</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{formatNumber(card.trades)}</div>
                <div>Trades</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{formatNumber(card.distinct_tickers)}</div>
                <div>Tickers touched</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{formatCurrency(card.avg_trade, { compact: true })}</div>
                <div>Avg trade size</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FlowMomentumPanel({ momentum, onSelectMonth }) {
  const positives = momentum?.positives || [];
  const negatives = momentum?.negatives || [];

  if ((positives.length + negatives.length) === 0) {
    return (
      <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Momentum highlights will appear once we have at least two months of flows.
      </div>
    );
  }

  const renderItem = (item, tone) => {
    const accent = tone === 'positive' ? '#047857' : '#b91c1c';
    const deltaLabel = formatCurrency(Math.abs(item.delta), { compact: true });
    const changeText = tone === 'positive' ? `Up ${deltaLabel}` : `Down ${deltaLabel}`;
    return (
      <button
        key={item.month}
        type="button"
        onClick={() => onSelectMonth?.(item.month)}
        style={{
          textAlign: 'left',
          background: 'rgba(255,255,255,0.9)',
          border: `1px solid rgba(17,24,39,0.12)`,
          borderRadius: 12,
          padding: '12px 14px',
          display: 'grid',
          gap: 6,
          cursor: 'pointer'
        }}
      >
        <div style={{ fontWeight: 600, color: '#111827' }}>{safeMonthLabel(item.month)}</div>
        <div style={{ fontSize: 12, color: '#4b5563' }}>Net {formatCurrency(item.net_flow, { signed: true })}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: accent }}>{changeText} vs {monthAbbrev(item.prev_month)}</div>
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700, color: '#065f46' }}>Accelerating flows</div>
          {positives.length
            ? positives.map((item) => renderItem(item, 'positive'))
            : <div style={{ fontSize: 12, color: '#6b7280' }}>No month beat the prior period yet.</div>}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700, color: '#b91c1c' }}>Cooling flows</div>
          {negatives.length
            ? negatives.map((item) => renderItem(item, 'negative'))
            : <div style={{ fontSize: 12, color: '#6b7280' }}>No month pulled back this cycle.</div>}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>Click a month to jump the dashboard to that period.</div>
    </div>
  );
}

function AssetClassModal({ assetClass, entries = [], onClose, month, advisorName }) {
  if (!assetClass) return null;

  const sorted = entries.slice().sort((a, b) => Math.abs(Number(b.net_flow || 0)) - Math.abs(Number(a.net_flow || 0)));
  const totals = sorted.reduce((acc, row) => {
    acc.inflows += Number(row.inflows || 0);
    acc.outflows += Number(row.outflows || 0);
    acc.net += Number(row.net_flow || 0);
    acc.advisors += Number(row.advisors_trading || 0);
    return acc;
  }, { inflows: 0, outflows: 0, net: 0, advisors: 0 });

  const columns = [
    { key: 'ticker', label: 'Ticker', width: '90px', accessor: (row) => row.ticker, render: (value) => <span style={{ fontWeight: 600 }}>{value}</span> },
    { key: 'name', label: 'Fund', width: '220px', accessor: (row) => row.name || '' },
    { key: 'net_flow', label: 'Net Flow', width: '130px', numeric: true, align: 'right', accessor: (row) => row.net_flow, render: (value) => formatCurrency(value) },
    { key: 'inflows', label: 'Inflows', width: '120px', numeric: true, align: 'right', accessor: (row) => row.inflows, render: (value) => formatCurrency(value) },
    { key: 'outflows', label: 'Outflows', width: '120px', numeric: true, align: 'right', accessor: (row) => row.outflows, render: (value) => formatCurrency(value) },
    { key: 'advisors_trading', label: 'Advisors', width: '110px', numeric: true, align: 'right', accessor: (row) => row.advisors_trading, render: (value) => value != null ? formatNumber(value) : 'n/a' }
  ];

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: 24,
          width: 'min(900px, 94vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 45px rgba(15,23,42,0.25)',
          display: 'grid',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>{assetClass} · {safeMonthLabel(month)}</h3>
            <div style={{ fontSize: 12, color: '#4b5563' }}>
              {advisorName ? `${advisorName} view` : 'Firm-wide view'} · {entries.length} funds
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <KPI label="Net Flow" value={totals.net} currency strong />
          <KPI label="Inflows" value={totals.inflows} currency />
          <KPI label="Outflows" value={totals.outflows} currency />
          <KPI label="Advisors" value={totals.advisors} />
        </div>

        <ProfessionalTable
          data={sorted}
          columns={columns}
          onRowClick={(row) => {
            if (!row?.ticker) return;
            window.open(`/portfolios?ticker=${encodeURIComponent(row.ticker)}`, '_self');
          }}
        />
      </div>
    </div>
  );
}
function HistoricalComparisonCard({ currentNet = 0, trailingAvg = null, seasonalAvg = null, month }) {
  const baselineOptions = [
    { label: 'Trailing 6 mo', value: trailingAvg },
    { label: 'Seasonal typical', value: seasonalAvg }
  ].filter((opt) => opt.value != null);

  if (!month || baselineOptions.length === 0) {
    return (
      <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Historical benchmarks will populate as flow history deepens.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, color: '#4b5563' }}>Current net flow ({safeMonthLabel(month)})</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: currentNet >= 0 ? '#047857' : '#b91c1c' }}>
          {formatCurrency(currentNet, { signed: true })}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {baselineOptions.map((baseline) => {
          const delta = currentNet - baseline.value;
          const positive = delta >= 0;
          const pct = baseline.value !== 0 ? Math.abs(delta) / Math.abs(baseline.value) : null;
          const barWidth = Math.min(100, pct != null ? Math.round(pct * 100) : 100);
          return (
            <div key={baseline.label} style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4b5563' }}>
                <span>{baseline.label}</span>
                <span>{formatCurrency(baseline.value, { signed: true })}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(209,213,219,0.4)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(15, barWidth)}%`,
                    height: '100%',
                    background: positive ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: positive ? '#047857' : '#b91c1c', fontWeight: 600 }}>
                {positive ? 'Above typical' : 'Below typical'} by {formatCurrency(delta, { signed: true })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function MiniBarChart({ data = [], labelKey = 'ticker', valueKey = 'value', width = 480, height = 200, color = '#10b981' }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div style={{ height, background: '#f3f4f6', borderRadius: 12 }} />;
  }
  const padLeft = 120;
  const padRight = 24;
  const padY = 16;
  const innerWidth = width - padLeft - padRight;
  const barGap = 8;
  const rows = data.slice(0, Math.min(8, data.length));
  const barHeight = Math.max(14, Math.floor((height - padY * 2 - (rows.length - 1) * barGap) / rows.length));
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(Number(row[valueKey]) || 0)));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" stroke="#e5e7eb" />
      {rows.map((row, index) => {
        const value = Math.abs(Number(row[valueKey]) || 0);
        const w = (value / maxValue) * innerWidth;
        const y = padY + index * (barHeight + barGap);
        return (
          <g key={`${row[labelKey]}-${index}`}>
            <text x={16} y={y + barHeight * 0.7} fontSize={12} fill="#374151">{row[labelKey]}</text>
            <rect x={padLeft} y={y} width={w} height={barHeight} fill={color} rx={4} ry={4} />
            <text x={padLeft + w + 8} y={y + barHeight * 0.7} fontSize={11} fill="#1f2937">
              {formatCurrency(value, { compact: true })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KPI({ label, value, currency = false, strong = false }) {
  const formatted = currency ? formatCurrency(value) : formatNumber(value);
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: strong ? 800 : 700, fontSize: 18, color: '#111827' }}>{formatted}</div>
    </div>
  );
}
export default function Trading() {
  const [month, setMonth] = React.useState('');
  const [months, setMonths] = React.useState([]);
  const [advisorName, setAdvisorName] = React.useState('');
  const [topBuys, setTopBuys] = React.useState([]);
  const [topSells, setTopSells] = React.useState([]);
  const [flowTrend, setFlowTrend] = React.useState([]);
  const [alerts, setAlerts] = React.useState([]);
  const [kpis, setKpis] = React.useState({ total_inflows: 0, total_outflows: 0, net_flow: 0, distinct_tickers: 0, advisors_trading: 0 });
  const [drillFor, setDrillFor] = React.useState(null);
  const [drillData, setDrillData] = React.useState({ rows: [], summary: null, loading: false });
  const [assetClassFlows, setAssetClassFlows] = React.useState([]);
  const [advisorLeaders, setAdvisorLeaders] = React.useState([]);
  const [assetClassModal, setAssetClassModal] = React.useState(null);
  const [flowChartMode, setFlowChartMode] = React.useState('net');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ms = await flowsService.listMonths(MONTH_LIMIT);
        if (cancelled) return;
        const sorted = (ms || []).slice().sort((a, b) => new Date(b) - new Date(a));
        setMonths(sorted);
        if (sorted.length > 0) {
          setMonth((current) => (current && sorted.includes(current) ? current : sorted[0]));
        }
      } catch (error) {
        console.warn('Unable to load flow months', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!month) return;
    let cancelled = false;
    (async () => {
      try {
        const limitMovers = 120;
        const [
          buys,
          sells,
          trend,
          k,
          advisors,
          assetClasses
        ] = await Promise.all([
          flowsService.getTopMovers({ month, advisorNameOrTeam: advisorName, direction: 'inflow', limit: limitMovers }),
          flowsService.getTopMovers({ month, advisorNameOrTeam: advisorName, direction: 'outflow', limit: limitMovers }),
          flowsService.getNetFlowTrend(advisorName, 18),
          flowsService.getMonthKPIs({ month, advisorNameOrTeam: advisorName }),
          flowsService.getTopAdvisorActivity({ month, advisorNameOrTeam: advisorName, limit: 6 }),
          advisorName ? Promise.resolve(null) : flowsService.getFlowByAssetClass({ month })
        ]);
        if (cancelled) return;

        setTopBuys(buys || []);
        setTopSells(sells || []);
        setFlowTrend(trend || []);
        let mergedMonths;
        setMonths((prev) => {
          const combined = new Set(prev || []);
          (trend || []).forEach((row) => {
            if (row?.month) combined.add(row.month);
          });
          if (month) combined.add(month);
          mergedMonths = Array.from(combined).sort((a, b) => new Date(b) - new Date(a));
          return mergedMonths;
        });
        if (mergedMonths && mergedMonths.length > 0) {
          setMonth((current) => (current && mergedMonths.includes(current) ? current : mergedMonths[0]));
        }
        setKpis(k || { total_inflows: 0, total_outflows: 0, net_flow: 0, distinct_tickers: 0, advisors_trading: 0 });
        setAdvisorLeaders(advisors || []);
        if (!advisorName) {
          setAssetClassFlows(assetClasses || []);
        }

        const signals = [];
        (sells || []).slice(0, 10).forEach((row) => {
          if (row.is_recommended) {
            signals.push({
              id: `sell-${row.ticker}`,
              message: `${row.ticker} recommended yet showing outflows ${formatCurrency(row.net_flow, { compact: true })}`
            });
          }
        });
        (buys || []).slice(0, 10).forEach((row) => {
          if (!row.is_recommended) {
            signals.push({
              id: `buy-${row.ticker}`,
              message: `${row.ticker} non-recommended attracting ${formatCurrency(row.net_flow, { compact: true })}`
            });
          }
        });
        setAlerts(signals);
      } catch (error) {
        console.warn('Unable to load trading data', error);
        if (!cancelled) {
          setTopBuys([]);
          setTopSells([]);
          setFlowTrend([]);
          setAdvisorLeaders([]);
          if (!advisorName) setAssetClassFlows([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [month, advisorName]);

  React.useEffect(() => {
    if (!drillFor || !month) return;
    let cancelled = false;
    (async () => {
      try {
        setDrillData((prev) => ({ ...prev, loading: true }));
        const data = await flowsService.getTickerDrilldown({ month, advisorNameOrTeam: advisorName, ticker: drillFor });
        if (!cancelled) setDrillData({ ...(data || { rows: [], summary: null }), loading: false });
      } catch (error) {
        console.warn('Unable to load ticker drilldown', error);
        if (!cancelled) setDrillData({ rows: [], summary: null, loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [drillFor, month, advisorName]);
  const combinedMoves = React.useMemo(() => {
    const map = new Map();
    [...topBuys, ...topSells].forEach((row) => {
      const ticker = String(row.ticker || '').toUpperCase();
      if (!ticker) return;
      const inflows = Number(row.inflows || 0);
      const outflows = Number(row.outflows || 0);
      const net = Number(row.net_flow || 0);
      const entry = map.get(ticker) || {
        ticker,
        name: row.name || ticker,
        asset_class: row.asset_class || 'Unclassified',
        net_flow: 0,
        inflows: 0,
        outflows: 0,
        total_volume: 0,
        advisors_trading: 0
      };
      entry.net_flow += net;
      entry.inflows += Math.max(0, inflows);
      entry.outflows += Math.max(0, outflows);
      entry.total_volume += Math.abs(inflows) + Math.abs(outflows) || Math.abs(net);
      entry.advisors_trading = Math.max(entry.advisors_trading, Number(row.advisors_trading || 0));
      map.set(ticker, entry);
    });
    return Array.from(map.values());
  }, [topBuys, topSells]);

  const assetClassDetailsMap = React.useMemo(() => {
    const map = new Map();
    combinedMoves.forEach((row) => {
      const key = row.asset_class || 'Unclassified';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [combinedMoves]);

  const assetClassesWithDetails = React.useMemo(() => {
    const entries = [];
    assetClassDetailsMap.forEach((value, key) => {
      if (Array.isArray(value) && value.length > 0) entries.push(key);
    });
    return new Set(entries);
  }, [assetClassDetailsMap]);

  const assetClassModalEntries = assetClassModal ? (assetClassDetailsMap.get(assetClassModal) || []) : [];

  const handleAssetClassSelect = React.useCallback((assetClass) => {
    if (!assetClass) return;
    const entries = assetClassDetailsMap.get(assetClass) || [];
    if (entries.length === 0) return;
    setAssetClassModal(assetClass);
  }, [assetClassDetailsMap]);

  const closeAssetClassModal = React.useCallback(() => setAssetClassModal(null), []);

  const bubbleData = React.useMemo(() => (
    combinedMoves
      .filter((row) => row.total_volume > 0)
      .sort((a, b) => b.total_volume - a.total_volume)
      .slice(0, 12)
  ), [combinedMoves]);

  const intensityRows = React.useMemo(() => {
    if (advisorName) {
      const grouped = new Map();
      combinedMoves.forEach((row) => {
        const key = row.asset_class || 'Unclassified';
        const entry = grouped.get(key) || {
          asset_class: key,
          inflows: 0,
          outflows: 0,
          net_flow: 0,
          advisors_trading: 0
        };
        entry.inflows += row.inflows;
        entry.outflows += row.outflows;
        entry.net_flow += row.net_flow;
        entry.advisors_trading += Number(row.advisors_trading || 0);
        grouped.set(key, entry);
      });
      return Array.from(grouped.values());
    }
    return assetClassFlows;
  }, [advisorName, combinedMoves, assetClassFlows]);

  const chartTrend = React.useMemo(() => (flowTrend || []).slice(-12), [flowTrend]);

  const flowComparisons = React.useMemo(() => {
    if (!flowTrend || flowTrend.length === 0) return null;
    const ordered = [...flowTrend].sort((a, b) => new Date(a.month) - new Date(b.month));
    const latest = ordered[ordered.length - 1];
    if (!latest) return null;
    const history = ordered.slice(0, -1);
    const trailing = history.slice(-6);
    const trailingAvg = trailing.length ? trailing.reduce((sum, row) => sum + Number(row.net_flow || 0), 0) / trailing.length : null;
    const latestDate = new Date(latest.month);
    const seasonalMatches = history.filter((row) => {
      const d = new Date(row.month);
      return d.getUTCMonth() === latestDate.getUTCMonth();
    });
    const seasonalAvg = seasonalMatches.length ? seasonalMatches.reduce((sum, row) => sum + Number(row.net_flow || 0), 0) / seasonalMatches.length : null;
    const prior = history.length ? history[history.length - 1] : null;
    const momentum = prior ? Number(latest.net_flow || 0) - Number(prior.net_flow || 0) : 0;
    return { latest, trailingAvg, seasonalAvg, momentum };
  }, [flowTrend]);

  const flowMomentum = React.useMemo(() => {
    if (!flowTrend || flowTrend.length < 2) return { positives: [], negatives: [] };
    const ordered = [...flowTrend].sort((a, b) => new Date(a.month) - new Date(b.month));
    const deltas = [];
    for (let i = 1; i < ordered.length; i += 1) {
      const current = ordered[i];
      const prev = ordered[i - 1];
      const delta = Number(current.net_flow || 0) - Number(prev.net_flow || 0);
      deltas.push({
        month: current.month,
        net_flow: Number(current.net_flow || 0),
        prev_month: prev.month,
        delta
      });
    }
    const positives = deltas.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4);
    const negatives = deltas.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 4);
    return { positives, negatives };
  }, [flowTrend]);

  const flowHeadline = React.useMemo(() => {
    if (!flowComparisons?.latest) {
      return { headline: 'No flow data yet', subhead: '' };
    }
    const net = Number(flowComparisons.latest.net_flow || 0);
    const direction = net >= 0 ? 'net inflows' : 'net outflows';
    const magnitude = formatCurrency(net, { compact: true, signed: true });
    const momentum = flowComparisons.momentum || 0;
    const momentumText = momentum > 0 ? `Momentum rising by ${formatCurrency(momentum, { compact: true })}` :
      momentum < 0 ? `Momentum easing by ${formatCurrency(Math.abs(momentum), { compact: true })}` :
      'Momentum holding steady';
    const trailing = flowComparisons.trailingAvg != null ? `Typical month: ${formatCurrency(flowComparisons.trailingAvg, { compact: true, signed: true })}` : '';
    const seasonal = flowComparisons.seasonalAvg != null ? `Seasonal baseline: ${formatCurrency(flowComparisons.seasonalAvg, { compact: true, signed: true })}` : '';
    const subParts = [momentumText, trailing, seasonal].filter(Boolean);
    return {
      headline: `${magnitude} ${direction}`,
      subhead: subParts.join(' | ')
    };
  }, [flowComparisons]);

  const handleMomentumSelect = React.useCallback((value) => {
    if (value) setMonth(value);
  }, [setMonth]);

  const advisorCards = React.useMemo(() => {
    const grouped = new Map();
    (advisorLeaders || []).forEach((row) => {
      const displayName = getAdvisorName(row.advisor_id);
      const key = displayName || row.advisor_id || 'Unknown';
      const existing = grouped.get(key) || {
        displayName: key,
        advisor_ids: new Set(),
        net_flow: 0,
        total_volume: 0,
        buy_volume: 0,
        sell_volume: 0,
        trades: 0,
        tickers: new Set()
      };
      existing.advisor_ids.add(row.advisor_id);
      existing.net_flow += Number(row.net_flow || 0);
      existing.total_volume += Number(row.total_volume || 0);
      existing.buy_volume += Number(row.buy_volume || 0);
      existing.sell_volume += Number(row.sell_volume || 0);
      existing.trades += Number(row.trades || 0);
      if (Array.isArray(row.tickers)) {
        row.tickers.forEach((ticker) => existing.tickers.add(String(ticker).toUpperCase()));
      } else if (row.distinct_tickers) {
        // Preserve at least the count if we lack the specific symbols
        existing.distinct_tickers = (existing.distinct_tickers || 0) + Number(row.distinct_tickers || 0);
      }
      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).map((entry) => {
      const initials = entry.displayName ? entry.displayName.slice(0, 2).toUpperCase() : '??';
      const distinctTickers = entry.tickers.size > 0 ? entry.tickers.size : (entry.distinct_tickers || 0);
      return {
        advisor_id: Array.from(entry.advisor_ids || []).join(','),
        displayName: entry.displayName,
        initials,
        net_flow: entry.net_flow,
        total_volume: entry.total_volume,
        buy_volume: entry.buy_volume,
        sell_volume: entry.sell_volume,
        trades: entry.trades,
        distinct_tickers: distinctTickers,
        avg_trade: entry.trades > 0 ? entry.total_volume / entry.trades : 0
      };
    }).sort((a, b) => b.total_volume - a.total_volume);
  }, [advisorLeaders]);

  const advisorCoverage = React.useMemo(() => {
    const totalVolume = advisorCards.reduce((sum, row) => sum + Math.abs(Number(row.total_volume || 0)), 0);
    const firmVolume = Math.abs(Number(kpis.total_inflows || 0)) + Math.abs(Number(kpis.total_outflows || 0));
    const pct = firmVolume > 0 ? totalVolume / firmVolume : null;
    return { totalVolume, firmVolume, pct };
  }, [advisorCards, kpis.total_inflows, kpis.total_outflows]);

  const sortedTrendRows = React.useMemo(() => (
    (flowTrend || []).map((row) => ({
      month: row.month,
      displayMonth: safeMonthLabel(row.month),
      net: Number(row.net_flow || 0),
      inflows: Number(row.inflows || 0),
      outflows: Number(row.outflows || 0)
    })).sort((a, b) => new Date(b.month) - new Date(a.month))
  ), [flowTrend]);

  const sortedMonths = React.useMemo(() => (
    (months || []).slice().sort((a, b) => new Date(b) - new Date(a))
  ), [months]);

  const totalMonthsAvailable = sortedMonths.length;
  const latestMonthAvailable = totalMonthsAvailable ? sortedMonths[0] : null;
  const oldestMonthAvailable = totalMonthsAvailable ? sortedMonths[sortedMonths.length - 1] : null;

  const coverageColumns = React.useMemo(() => ([
    { key: 'displayMonth', label: 'Month', width: '140px', accessor: (row) => row.displayMonth },
    { key: 'net', label: 'Net Flow', width: '130px', numeric: true, align: 'right', accessor: (row) => row.net, render: (value) => formatCurrency(value) },
    { key: 'inflows', label: 'Inflows', width: '130px', numeric: true, align: 'right', accessor: (row) => row.inflows, render: (value) => formatCurrency(value) },
    { key: 'outflows', label: 'Outflows', width: '130px', numeric: true, align: 'right', accessor: (row) => row.outflows, render: (value) => formatCurrency(value) }
  ]), []);

  const flowSignalsIntro = React.useMemo(() => {
    if (!alerts || alerts.length === 0) {
      return advisorName ? 'No unusual flow signals for this selection.' : 'Flows are tracking without major anomalies.';
    }
    return advisorName ? 'Advisor-specific signals to review:' : 'Firm-wide flow signals to review:';
  }, [alerts, advisorName]);
  const FLOWS_COLUMNS = React.useMemo(() => ([
    { key: 'ticker', label: 'Ticker', width: '90px', accessor: (row) => row.ticker, render: (value) => <span style={{ fontWeight: 600 }}>{value}</span> },
    { key: 'name', label: 'Fund', width: '220px', accessor: (row) => row.name || '' },
    { key: 'asset_class', label: 'Asset Class', width: '150px', accessor: (row) => row.asset_class || '' },
    { key: 'is_recommended', label: 'Recommended', width: '130px', accessor: (row) => row.is_recommended ? 'Yes' : 'No' },
    { key: 'net_flow', label: 'Net Flow', width: '140px', numeric: true, align: 'right', accessor: (row) => row.net_flow ?? row.amount ?? null, render: (value) => formatCurrency(value) },
    { key: 'advisors_trading', label: 'Advisors', width: '110px', numeric: true, align: 'right', accessor: (row) => row.advisors_trading ?? row.advisorCount ?? null },
    { key: 'firmAUM', label: 'Firm AUM', width: '140px', numeric: true, align: 'right', accessor: (row) => row.firmAUM ?? null, render: (value) => formatCurrency(value) }
  ]), []);

  function exportTop(kind) {
    const rows = kind === 'buys' ? topBuys : topSells;
    const header = ['Ticker', 'Fund', 'Asset Class', 'Recommended', 'Net Flow', 'Advisors Trading', 'Firm AUM'];
    const body = (rows || []).map((row) => [
      row.ticker,
      row.name || '',
      row.asset_class || '',
      row.is_recommended ? 'Yes' : 'No',
      Number(row.net_flow || 0),
      Number(row.advisors_trading || 0),
      Number(row.firmAUM || 0)
    ]);
    const csv = buildCSV([header, ...body]);
    const filename = formatExportFilename({ scope: `trading_${kind}`, asOf: month, ext: 'csv' });
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
  }

  return (
    <div className="trading-page" style={{ display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Trading Activity</h1>
        <div className="filters" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280' }}>Month</label><br />
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {(months || []).map((m) => (
                <option key={m} value={m}>{safeMonthLabel(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280' }}>Advisor</label><br />
            <select value={advisorName} onChange={(event) => setAdvisorName(event.target.value)}>
              <option value="">All Advisors</option>
              {getAdvisorOptions().map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Monthly Flow Story</h2>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#111827', marginTop: 4 }}>{flowHeadline.headline}</div>
            {flowHeadline.subhead && <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>{flowHeadline.subhead}</div>}
            <div style={{ display: 'inline-flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {FLOW_CHART_MODES.map((option) => {
                const active = option.value === flowChartMode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFlowChartMode(option.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: active ? '1px solid rgba(17,24,39,0.6)' : '1px solid rgba(17,24,39,0.15)',
                      background: active ? '#1f2937' : '#ffffff',
                      color: active ? '#ffffff' : '#1f2937',
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, minWidth: 280 }}>
            <KPI label="Inflows" value={kpis.total_inflows} currency />
            <KPI label="Outflows" value={kpis.total_outflows} currency />
            <KPI label="Net Flow" value={kpis.net_flow} currency strong />
            <KPI label="Tickers Traded" value={kpis.distinct_tickers} />
            <KPI label="Advisors Trading" value={kpis.advisors_trading} />
          </div>
        </div>
        <FlowStoryChart data={chartTrend} mode={flowChartMode} />
      </div>
      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Trading Data Diagnostics</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <KPI label="Months Captured" value={totalMonthsAvailable} />
          <KPI label="Funds Tracked (month)" value={combinedMoves.length} />
          {totalMonthsAvailable > 0 && (
            <div style={{
              padding: '12px 14px',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              background: '#f9fafb',
              fontSize: 12,
              color: '#374151'
            }}>
              Coverage: {safeMonthLabel(oldestMonthAvailable)} → {safeMonthLabel(latestMonthAvailable)}
            </div>
          )}
        </div>
        <ProfessionalTable
          data={sortedTrendRows}
          columns={coverageColumns}
          onRowClick={(row) => setMonth(row.month)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Flow Intensity by Asset Class</h3>
          <FlowIntensityGrid
            rows={intensityRows}
            advisorFilter={advisorName}
            onSelectAssetClass={handleAssetClassSelect}
            interactiveAssetClasses={assetClassesWithDetails}
          />
        </div>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Advisor Activity Spotlights</h3>
          <AdvisorSpotlights cards={advisorCards} month={month} />
          {advisorCoverage.pct != null && (
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              Spotlight volume covers {Math.round(Math.min(advisorCoverage.pct, 1) * 100)}% of firm trading this month
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Momentum Highlights</h3>
        <FlowMomentumPanel momentum={flowMomentum} onSelectMonth={handleMomentumSelect} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Trading Volume Pulse</h3>
          <FlowBubbleField data={bubbleData} />
        </div>
        <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Current vs Typical</h3>
          <HistoricalComparisonCard
            currentNet={flowComparisons?.latest?.net_flow || 0}
            trailingAvg={flowComparisons?.trailingAvg ?? null}
            seasonalAvg={flowComparisons?.seasonalAvg ?? null}
            month={flowComparisons?.latest?.month || month}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Flow Signals</h3>
            <div style={{ fontSize: 12, color: '#4b5563' }}>{flowSignalsIntro}</div>
          </div>
          <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => exportTop('buys')}>Download Top Buys CSV</button>
            <button className="btn btn-secondary" onClick={() => exportTop('sells')}>Download Top Sells CSV</button>
          </div>
        </div>
        {(alerts || []).length === 0 ? (
          <div style={{ color: '#6b7280' }}>No actionable alerts.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: '#111827' }}>
            {alerts.map((alert) => (<li key={alert.id}>{alert.message}</li>))}
          </ul>
        )}
      </div>
      <div className="trading-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="trading-card card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Top Buys</h3>
          <ProfessionalTable data={topBuys.slice(0, 12)} columns={FLOWS_COLUMNS} onRowClick={(row) => setDrillFor(String(row?.ticker || '').toUpperCase())} />
        </div>
        <div className="trading-card card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Top Sells</h3>
          <ProfessionalTable data={topSells.slice(0, 12)} columns={FLOWS_COLUMNS} onRowClick={(row) => setDrillFor(String(row?.ticker || '').toUpperCase())} />
        </div>
      </div>

      <div className="chart-section card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Top Inflows and Outflows</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Top Inflows</div>
            <MiniBarChart
              data={(topBuys || []).map((row) => ({ ticker: row.ticker, value: Number(row.net_flow || 0) })).filter((row) => row.value > 0)}
              color="#10b981"
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Top Outflows</div>
            <MiniBarChart
              data={(topSells || []).map((row) => ({ ticker: row.ticker, value: Math.abs(Number(row.net_flow || 0)) })).filter((row) => row.value > 0)}
              color="#ef4444"
            />
          </div>
        </div>
      </div>

      {drillFor && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0 }}>
              Details - {drillFor} - {month}{advisorName ? ` - ${advisorName}` : ''}
            </h3>
            <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn" href={`/portfolios?ticker=${encodeURIComponent(drillFor)}`} target="_self" rel="noreferrer">Open Portfolios By Fund</a>
              <button className="btn btn-secondary" onClick={() => setDrillFor(null)}>Close</button>
            </div>
          </div>
          {drillData.loading ? (
            <div style={{ color: '#6b7280' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {drillData.summary && (
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <KPI label="Buy Trades" value={drillData.summary.buy_trades} />
                  <KPI label="Sell Trades" value={drillData.summary.sell_trades} />
                  <KPI label="Buy Amount" value={drillData.summary.buy_amount} currency />
                  <KPI label="Sell Amount" value={drillData.summary.sell_amount} currency />
                  <KPI label="Net Flow" value={drillData.summary.net_flow} currency strong />
                </div>
              )}
              <ProfessionalTable
                data={drillData.rows}
                columns={[
                  { key: 'advisor_id', label: 'Advisor', width: '120px', accessor: (row) => row.advisor_id },
                  { key: 'buy_trades', label: 'Buy Trades', width: '110px', numeric: true, align: 'right', accessor: (row) => row.buy_trades },
                  { key: 'sell_trades', label: 'Sell Trades', width: '110px', numeric: true, align: 'right', accessor: (row) => row.sell_trades },
                  { key: 'buy_amount', label: 'Buy Amount', width: '140px', numeric: true, align: 'right', accessor: (row) => row.buy_amount, render: (value) => formatCurrency(value) },
                  { key: 'sell_amount', label: 'Sell Amount', width: '140px', numeric: true, align: 'right', accessor: (row) => row.sell_amount, render: (value) => formatCurrency(value) },
                  { key: 'net_flow', label: 'Net Flow', width: '140px', numeric: true, align: 'right', accessor: (row) => row.net_flow, render: (value) => formatCurrency(value, { signed: true }) }
                ]}
              />
            </div>
          )}
        </div>
      )}
      {assetClassModal && (
        <AssetClassModal
          assetClass={assetClassModal}
          entries={assetClassModalEntries}
          onClose={closeAssetClassModal}
          month={month}
          advisorName={advisorName}
        />
      )}
    </div>
  );
}
