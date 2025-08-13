// src/components/common/StatusIcon.jsx
import React from 'react';
import { CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';

export default function StatusIcon({ level = 'good', size = 14, strokeWidth = 1.75, style = {} }) {
  const map = { good: CheckCircle2, fair: AlertTriangle, poor: XOctagon };
  const color = level === 'good' ? '#16a34a' : level === 'fair' ? '#f59e0b' : '#dc2626';
  const Icon = map[level] || CheckCircle2;
  return <Icon size={size} strokeWidth={strokeWidth} color={color} aria-hidden style={style} />;
}

