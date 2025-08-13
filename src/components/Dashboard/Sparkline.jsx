// src/components/Dashboard/Sparkline.jsx
import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function Sparkline({ values = [], width = 160, height = 48, stroke = '#3b82f6', fill = 'rgba(59,130,246,0.1)' }) {
  const data = (values || []).filter(v => v != null && !isNaN(v));
  if (data.length === 0) return (
    <div style={{ color: '#6b7280', fontSize: 12, display:'flex', alignItems:'center', gap:6 }}>
      <AlertCircle size={12} aria-hidden />
      <span>No data</span>
    </div>
  );

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Area path
  const areaPath = `M0,${height} L${points} L${width},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="sparkline">
      <path d={areaPath} fill={fill} stroke="none" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

